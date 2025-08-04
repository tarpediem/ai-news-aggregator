const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting map
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

// Rate limiting middleware
const rateLimit = (req, res, next) => {
  const clientId = req.ip;
  const now = Date.now();
  
  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, { count: 1, windowStart: now });
    return next();
  }
  
  const client = rateLimitMap.get(clientId);
  
  if (now - client.windowStart > RATE_LIMIT_WINDOW) {
    // Reset window
    client.count = 1;
    client.windowStart = now;
    return next();
  }
  
  if (client.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - client.windowStart)) / 1000)
    });
  }
  
  client.count++;
  next();
};

// Cache for scraped results
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to clean and extract text
const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
};

// Helper function to resolve relative URLs
const resolveUrl = (baseUrl, url) => {
  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    return url;
  }
};

// User agent to avoid blocking
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Main scraping endpoint
app.post('/scrape', rateLimit, async (req, res) => {
  try {
    const { url, selectors } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Check cache first
    const cacheKey = `${url}-${JSON.stringify(selectors)}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json({
        success: true,
        results: cached.data,
        cached: true,
        timestamp: cached.timestamp
      });
    }
    
    console.log(`Scraping: ${url}`);
    
    try {
      // Fetch the webpage
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 5000, // Reduced from 30s to 5s for better performance
        maxRedirects: 5
      });
      
      // Parse the HTML
      const $ = cheerio.load(response.data);
      
      const articles = [];
      
      // Use provided selectors or fall back to common patterns
      const containerSelector = selectors.container || 'article, .post, .news-item, .entry, [class*="article"], [class*="post"]';
      const titleSelector = selectors.title || 'h1, h2, h3, .title, [class*="title"], [class*="headline"]';
      const descSelector = selectors.description || '.excerpt, .summary, p, [class*="excerpt"], [class*="summary"], [class*="description"]';
      const linkSelector = selectors.link || 'a[href]';
      const imageSelector = selectors.image || 'img[src], img[data-src], img[data-lazy-src]';
      
      $(containerSelector).each((index, element) => {
        const $element = $(element);
        
        // Extract title
        const titleElement = $element.find(titleSelector).first();
        const title = cleanText(titleElement.text() || titleElement.attr('title') || '');
        
        // Extract description
        const descElement = $element.find(descSelector).first();
        const description = cleanText(descElement.text());
        
        // Extract link
        let link = '';
        const linkElement = $element.find(linkSelector).first();
        if (linkElement.length) {
          link = linkElement.attr('href');
        } else {
          // Try to find a link wrapping the title
          const titleLink = $element.find(`${titleSelector} a, a ${titleSelector}`).first();
          if (titleLink.length) {
            link = titleLink.attr('href') || titleLink.parent('a').attr('href');
          }
        }
        
        // Extract image
        let image = '';
        const imageElement = $element.find(imageSelector).first();
        if (imageElement.length) {
          image = imageElement.attr('src') || imageElement.attr('data-src') || imageElement.attr('data-lazy-src') || '';
        }
        
        // Only include if we have at least a title
        if (title && title.length > 10) {
          articles.push({
            title,
            description: description || '',
            link: link ? resolveUrl(url, link) : '',
            image: image ? resolveUrl(url, image) : '',
            source: new URL(url).hostname
          });
        }
      });
      
      // If no articles found with container selector, try a more aggressive approach
      if (articles.length === 0) {
        console.log('No articles found with container selector, trying alternative approach...');
        
        // Look for any links with substantial text
        $('a').each((index, element) => {
          const $link = $(element);
          const href = $link.attr('href');
          const text = cleanText($link.text());
          
          if (href && text && text.length > 30 && !text.includes('Cookie') && !text.includes('Privacy')) {
            // Find nearby image
            let image = '';
            const $parent = $link.parent();
            const $img = $parent.find('img').first();
            if ($img.length) {
              image = $img.attr('src') || $img.attr('data-src') || '';
            }
            
            // Find nearby description
            let description = '';
            const $nextP = $link.nextAll('p').first();
            if ($nextP.length) {
              description = cleanText($nextP.text());
            }
            
            articles.push({
              title: text,
              description: description,
              link: resolveUrl(url, href),
              image: image ? resolveUrl(url, image) : '',
              source: new URL(url).hostname
            });
          }
        });
      }
      
      // Cache the results
      cache.set(cacheKey, {
        data: articles,
        timestamp: Date.now()
      });
      
      console.log(`Successfully scraped ${articles.length} articles from ${url}`);
      
      res.json({
        success: true,
        results: articles,
        cached: false,
        timestamp: Date.now(),
        count: articles.length
      });
      
    } catch (error) {
      console.error('Axios error:', error.message);
      res.status(500).json({
        error: 'Failed to fetch website',
        details: error.message
      });
    }
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Get cache statistics
app.get('/cache/stats', (req, res) => {
  const stats = {
    size: cache.size,
    keys: Array.from(cache.keys()),
    oldest: cache.size > 0 ? Math.min(...Array.from(cache.values()).map(v => v.timestamp)) : null,
    newest: cache.size > 0 ? Math.max(...Array.from(cache.values()).map(v => v.timestamp)) : null
  };
  
  res.json(stats);
});

// Clear cache endpoint
app.post('/cache/clear', (req, res) => {
  cache.clear();
  res.json({ message: 'Cache cleared successfully' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`AI News Scraper Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}, CACHE_DURATION);

module.exports = app;