/**
 * Service Worker for AI News Aggregator
 * Provides offline caching, performance optimization, and background sync
 */

const CACHE_NAME = 'ai-news-v1';
const STATIC_CACHE = 'ai-news-static-v1';
const API_CACHE = 'ai-news-api-v1';
const IMAGE_CACHE = 'ai-news-images-v1';

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  STATIC: 7 * 24 * 60 * 60 * 1000, // 7 days
  API: 15 * 60 * 1000, // 15 minutes
  IMAGES: 24 * 60 * 60 * 1000, // 24 hours
  FALLBACK: 60 * 60 * 1000, // 1 hour
};

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add more static assets as needed
];

// API endpoints to cache
const API_PATTERNS = [
  /\/api\/news/,
  /\/scrape/,
  /export\.arxiv\.org/,
  /hacker-news\.firebaseio\.com/,
  /newsapi\.org/,
];

// Image patterns to cache
const IMAGE_PATTERNS = [
  /images\.unsplash\.com/,
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old versions of our caches
              return cacheName.startsWith('ai-news-') && 
                     !cacheName.includes('v1');
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle network requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other special URLs
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  event.respondWith(handleRequest(request));
});

/**
 * Handle different types of requests with appropriate caching strategies
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Static assets - cache first
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
      return await cacheFirst(request, STATIC_CACHE, CACHE_DURATIONS.STATIC);
    }
    
    // API requests - network first with cache fallback
    if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
      return await networkFirst(request, API_CACHE, CACHE_DURATIONS.API);
    }
    
    // Images - cache first with network fallback
    if (IMAGE_PATTERNS.some(pattern => pattern.test(url.href))) {
      return await cacheFirst(request, IMAGE_CACHE, CACHE_DURATIONS.IMAGES);
    }
    
    // Other requests - network first
    return await networkFirst(request, CACHE_NAME, CACHE_DURATIONS.FALLBACK);
    
  } catch (error) {
    console.error('[SW] Request failed:', error);
    return await getOfflineFallback(request);
  }
}

/**
 * Cache first strategy - serve from cache, update in background
 */
async function cacheFirst(request, cacheName, maxAge) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
      // Serve from cache
      backgroundFetch(request, cache);
      return cachedResponse;
    }
    
    // Cache miss or expired - fetch from network
    const networkResponse = await fetch(request.clone());
    
    if (networkResponse.ok) {
      // Cache the response for future use
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Network failed - try to serve stale cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving stale cache due to network error');
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Network first strategy - try network, fallback to cache
 */
async function networkFirst(request, cacheName, maxAge) {
  try {
    const cache = await caches.open(cacheName);
    
    // Try network first
    const networkResponse = await Promise.race([
      fetch(request.clone()),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 3000)
      )
    ]);
    
    if (networkResponse.ok) {
      // Cache successful response
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    // Network failed - try cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
      console.log('[SW] Serving cached response due to network failure');
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Background fetch to update cache without blocking response
 */
function backgroundFetch(request, cache) {
  // Don't await this - let it run in background
  fetch(request.clone())
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    })
    .catch(error => {
      console.log('[SW] Background fetch failed:', error.message);
    });
}

/**
 * Check if cached response is expired
 */
function isExpired(response, maxAge) {
  const cached = response.headers.get('sw-cached-at');
  if (!cached) return true;
  
  const cachedAt = parseInt(cached, 10);
  return Date.now() - cachedAt > maxAge;
}

/**
 * Add timestamp to response headers
 */
async function addTimestamp(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('sw-cached-at', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Get offline fallback response
 */
async function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // API request fallback
  if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
    return new Response(
      JSON.stringify({
        articles: [],
        error: 'Offline - cached data not available',
        offline: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  // Image fallback
  if (IMAGE_PATTERNS.some(pattern => pattern.test(url.href))) {
    // Return placeholder image
    const placeholderSVG = `
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f1f5f9"/>
        <text x="50%" y="50%" font-family="Arial" font-size="16" fill="#64748b" text-anchor="middle">
          Offline
        </text>
      </svg>
    `;
    
    return new Response(placeholderSVG, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  }
  
  // HTML fallback
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>AI News - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 2rem;">
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </body>
    </html>
    `,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

/**
 * Background sync for data updates
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'news-sync') {
    console.log('[SW] Background sync: news-sync');
    event.waitUntil(syncNewsData());
  }
});

/**
 * Sync news data in background
 */
async function syncNewsData() {
  try {
    // This would typically fetch fresh data
    console.log('[SW] Syncing news data...');
    // Implementation would depend on your API structure
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

/**
 * Message handling for communication with main thread
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_STATS') {
    getCacheStats().then(stats => {
      event.ports[0].postMessage(stats);
    });
  }
});

/**
 * Get cache statistics
 */
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    stats[cacheName] = keys.length;
  }
  
  return stats;
}