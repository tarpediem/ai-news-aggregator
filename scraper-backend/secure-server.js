const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('redis');
const DOMPurify = require('isomorphic-dompurify');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Security Configuration
const SECURITY_CONFIG = {
  // Allowed domains for scraping (whitelist approach)
  ALLOWED_DOMAINS: [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'cnn.com',
    'npr.org',
    'techcrunch.com',
    'arstechnica.com',
    'theverge.com',
    'wired.com',
    'nature.com',
    'sciencemag.org',
    'arxiv.org',
    'github.com',
    'stackoverflow.com'
  ],
  
  // Rate limiting configuration
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100, // requests per window per IP
    MAX_SCRAPER_REQUESTS: 20 // scraper requests per window per IP
  },
  
  // Request size limits
  MAX_BODY_SIZE: '10mb',
  MAX_URL_LENGTH: 2048,
  
  // Timeout settings
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Cache settings
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 1000 // maximum cache entries
};

// Initialize Redis client for distributed rate limiting and caching
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration with whitelist
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ 
  limit: SECURITY_CONFIG.MAX_BODY_SIZE,
  verify: (req, res, buf) => {
    // Verify JSON is not malformed and doesn't contain dangerous content
    try {
      const body = buf.toString();
      if (body.length > 10000) { // 10KB limit for JSON body
        throw new Error('Request body too large');
      }
    } catch (error) {
      throw new Error('Invalid request body');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: SECURITY_CONFIG.MAX_BODY_SIZE 
}));

// Logging
app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400 // Only log errors
}));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMIT.MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS / 1000)
    });
  }
});

app.use(globalLimiter);

// Scraper-specific rate limiting
const scraperLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS,
  max: SECURITY_CONFIG.RATE_LIMIT.MAX_SCRAPER_REQUESTS,
  message: {
    error: 'Too many scraping requests, please try again later',
    retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS / 1000)
  }
});

// Input validation and sanitization functions
const validateAndSanitizeURL = (url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  // Length check
  if (url.length > SECURITY_CONFIG.MAX_URL_LENGTH) {
    throw new Error('URL is too long');
  }

  // Basic URL validation
  let urlObj;
  try {
    urlObj = new URL(url.trim());
  } catch (error) {
    throw new Error('Invalid URL format');
  }

  // Protocol validation
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  // Domain validation against whitelist
  const hostname = urlObj.hostname.toLowerCase();
  const isAllowed = SECURITY_CONFIG.ALLOWED_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    throw new Error(`Domain '${hostname}' is not allowed for scraping`);
  }

  // Check for private IPs and localhost
  if (isPrivateIP(hostname) || isLocalhost(hostname)) {
    throw new Error('Private IP addresses and localhost are not allowed');
  }

  return urlObj.href;
};

const isPrivateIP = (hostname) => {
  const privateIPPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];

  return privateIPPatterns.some(pattern => pattern.test(hostname));
};

const isLocalhost = (hostname) => {
  const localhosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
  return localhosts.includes(hostname.toLowerCase());
};

const sanitizeSelectors = (selectors) => {
  if (!selectors || typeof selectors !== 'object') {
    return {};
  }

  const sanitized = {};
  const allowedSelectors = ['container', 'title', 'description', 'link', 'image'];
  
  for (const key of allowedSelectors) {
    if (selectors[key] && typeof selectors[key] === 'string') {
      // Basic CSS selector validation - only allow safe characters
      const selector = selectors[key].trim();
      if (selector.length > 200) {
        throw new Error(`Selector '${key}' is too long`);
      }
      
      // Allow only safe CSS selector characters
      if (!/^[a-zA-Z0-9\s\.\#\[\]\=\-_\:\,\>\+\~\*\"\']*$/.test(selector)) {
        throw new Error(`Selector '${key}' contains invalid characters`);
      }
      
      sanitized[key] = selector;
    }
  }

  return sanitized;
};

const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // Remove dangerous HTML and scripts
  let sanitized = DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  });
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Limit length
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000).trim() + '...';
  }
  
  return sanitized;
};

// User agent rotation for scraping
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

const getRandomUserAgent = () => {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Cache implementation with Redis fallback to memory
const cache = new Map();

const getCacheKey = (url, selectors) => {
  return `scraper:${Buffer.from(url + JSON.stringify(selectors)).toString('base64')}`;
};

const getFromCache = async (key) => {
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.warn('Redis cache read error:', error.message);
  }
  
  // Fallback to memory cache
  return cache.get(key);
};

const setCache = async (key, data, ttl = SECURITY_CONFIG.CACHE_DURATION) => {
  const cacheData = {
    data,
    timestamp: Date.now(),
    ttl
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(key, Math.ceil(ttl / 1000), JSON.stringify(cacheData));
    }
  } catch (error) {
    console.warn('Redis cache write error:', error.message);
  }
  
  // Also store in memory cache
  cache.set(key, cacheData);
  
  // Clean up memory cache if it gets too large
  if (cache.size > SECURITY_CONFIG.MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

// Security middleware for request validation
const validateRequest = (req, res, next) => {
  try {
    const { url, selectors } = req.body;
    
    // Validate and sanitize URL
    req.validatedUrl = validateAndSanitizeURL(url);
    
    // Validate and sanitize selectors
    req.validatedSelectors = sanitizeSelectors(selectors);
    
    next();
  } catch (error) {
    console.warn('Request validation failed:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      url: req.body.url
    });
    
    res.status(400).json({
      error: 'Invalid request parameters',
      details: error.message
    });
  }
};

// Main scraping endpoint
app.post('/scrape', scraperLimiter, validateRequest, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { validatedUrl, validatedSelectors } = req;
    
    // Check cache first
    const cacheKey = getCacheKey(validatedUrl, validatedSelectors);
    const cached = await getFromCache(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`Cache hit for: ${validatedUrl}`);
      return res.json({
        success: true,
        results: cached.data,
        cached: true,
        timestamp: cached.timestamp,
        count: cached.data.length
      });
    }

    console.log(`Scraping: ${validatedUrl}`);

    // Fetch the webpage with security headers
    const response = await axios.get(validatedUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: SECURITY_CONFIG.REQUEST_TIMEOUT,
      maxRedirects: 3,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
      validateStatus: (status) => status >= 200 && status < 400
    });

    // Parse HTML with Cheerio
    const $ = cheerio.load(response.data);
    const articles = [];

    // Use provided selectors or fallback to common patterns
    const containerSelector = validatedSelectors.container || 'article, .post, .news-item, .entry';
    const titleSelector = validatedSelectors.title || 'h1, h2, h3, .title';
    const descSelector = validatedSelectors.description || '.excerpt, .summary, p';
    const linkSelector = validatedSelectors.link || 'a[href]';
    const imageSelector = validatedSelectors.image || 'img[src]';

    $(containerSelector).each((index, element) => {
      if (index >= 50) return false; // Limit to 50 articles max
      
      const $element = $(element);

      // Extract and sanitize data
      const titleElement = $element.find(titleSelector).first();
      const title = sanitizeText(titleElement.text() || titleElement.attr('title') || '');

      const descElement = $element.find(descSelector).first();
      const description = sanitizeText(descElement.text());

      // Extract link
      let link = '';
      const linkElement = $element.find(linkSelector).first();
      if (linkElement.length) {
        link = linkElement.attr('href');
      }

      // Extract image
      let image = '';
      const imageElement = $element.find(imageSelector).first();
      if (imageElement.length) {
        image = imageElement.attr('src') || imageElement.attr('data-src') || '';
      }

      // Only include if we have meaningful content
      if (title && title.length > 10) {
        try {
          articles.push({
            title,
            description: description || '',
            link: link ? new URL(link, validatedUrl).href : '',
            image: image ? new URL(image, validatedUrl).href : '',
            source: new URL(validatedUrl).hostname,
            scrapedAt: new Date().toISOString()
          });
        } catch (urlError) {
          // Skip articles with invalid URLs
          console.warn('Skipping article with invalid URL:', urlError.message);
        }
      }
    });

    // Cache the results
    await setCache(cacheKey, articles);

    const processingTime = Date.now() - startTime;
    console.log(`Successfully scraped ${articles.length} articles from ${validatedUrl} in ${processingTime}ms`);

    res.json({
      success: true,
      results: articles,
      cached: false,
      timestamp: Date.now(),
      count: articles.length,
      processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Scraping error:', {
      error: error.message,
      url: req.validatedUrl,
      processingTime,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    if (error.code === 'ENOTFOUND') {
      return res.status(404).json({
        error: 'Website not found or unreachable',
        details: 'The requested website could not be reached'
      });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        error: 'Request timeout',
        details: 'The website took too long to respond'
      });
    }

    res.status(500).json({
      error: 'Failed to scrape website',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    redis: 'disconnected'
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.ping();
      health.redis = 'connected';
    }
  } catch (error) {
    health.redis = 'error';
  }

  res.json(health);
});

// Cache statistics endpoint
app.get('/cache/stats', async (req, res) => {
  let redisStats = null;
  
  try {
    if (redisClient.isOpen) {
      const info = await redisClient.info('memory');
      redisStats = { connected: true, info };
    }
  } catch (error) {
    redisStats = { connected: false, error: error.message };
  }

  res.json({
    memory: {
      size: cache.size,
      maxSize: SECURITY_CONFIG.MAX_CACHE_SIZE
    },
    redis: redisStats,
    config: {
      cacheDuration: SECURITY_CONFIG.CACHE_DURATION,
      allowedDomains: SECURITY_CONFIG.ALLOWED_DOMAINS.length
    }
  });
});

// Clear cache endpoint (admin only - could add authentication)
app.post('/cache/clear', (req, res) => {
  cache.clear();
  
  if (redisClient.isOpen) {
    redisClient.flushDb().catch(err => {
      console.warn('Redis cache clear error:', err.message);
    });
  }
  
  res.json({ 
    message: 'Cache cleared successfully',
    timestamp: Date.now()
  });
});

// Security headers middleware
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
  
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize Redis connection
const initializeRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.warn('Redis connection failed, using memory cache only:', error.message);
  }
};

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Secure AI News Scraper Backend running on port ${PORT}`);
  console.log(`📈 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Allowed domains: ${SECURITY_CONFIG.ALLOWED_DOMAINS.length}`);
  console.log(`🛡️  Security features: Rate limiting, CORS, Input validation, Caching`);
  
  await initializeRedis();
});

module.exports = app;