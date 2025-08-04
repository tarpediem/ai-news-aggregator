const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8001;

// Initialize OpenAI for summarization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Crawl4AI configuration
const CRAWL4AI_URL = process.env.CRAWL4AI_URL || 'http://localhost:11235';
const CRAWL4AI_API_TOKEN = process.env.CRAWL4AI_API_TOKEN || 'your_secret_token';

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

const rateLimit = (req, res, next) => {
  const clientId = req.ip;
  const now = Date.now();
  
  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, { count: 1, windowStart: now });
    return next();
  }
  
  const client = rateLimitMap.get(clientId);
  
  if (now - client.windowStart > RATE_LIMIT_WINDOW) {
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
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Helper function to summarize content using OpenAI
async function summarizeContent(content, maxLength = 150) {
  if (!process.env.OPENAI_API_KEY) {
    // If no API key, return truncated content
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise summaries of AI news articles. Keep summaries under 150 characters, focusing on the key AI/ML aspects.'
        },
        {
          role: 'user',
          content: `Summarize this AI news article in one sentence (max 150 chars): ${content.substring(0, 1000)}`
        }
      ],
      max_tokens: 60,
      temperature: 0.5,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error summarizing content:', error);
    return content.substring(0, maxLength) + '...';
  }
}

// Helper function to extract AI-related content
function extractAIContent(markdown, metadata) {
  const aiKeywords = [
    'artificial intelligence', 'machine learning', 'deep learning', 
    'neural network', 'ai', 'ml', 'gpt', 'llm', 'transformer',
    'computer vision', 'nlp', 'natural language processing'
  ];
  
  const content = markdown.toLowerCase();
  const hasAIContent = aiKeywords.some(keyword => content.includes(keyword));
  
  if (!hasAIContent) {
    return null;
  }
  
  // Extract title
  const titleMatch = markdown.match(/^#\s+(.+)$/m) || 
                     metadata.title || 
                     'AI News Article';
  const title = Array.isArray(titleMatch) ? titleMatch[1] : titleMatch;
  
  // Extract first paragraph as description
  const paragraphs = markdown.split(/\n\n+/);
  const description = paragraphs.find(p => p.length > 50 && !p.startsWith('#')) || '';
  
  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    fullContent: markdown
  };
}

// Main scraping endpoint using Crawl4AI
app.post('/scrape', rateLimit, async (req, res) => {
  try {
    const { url, selectors } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Check cache
    const cacheKey = `${url}-crawl4ai`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json({
        success: true,
        results: cached.data,
        cached: true,
        timestamp: cached.timestamp
      });
    }
    
    console.log(`Crawling with Crawl4AI: ${url}`);
    
    try {
      // Call Crawl4AI API
      const crawlResponse = await axios.post(
        `${CRAWL4AI_URL}/crawl`,
        {
          url: url,
          api_token: CRAWL4AI_API_TOKEN,
          bypass_cache: false,
          extract_markdown: true,
          extract_screenshot: false,
          extract_links: true,
          extract_metadata: true,
          use_cookies: false,
          magic: true, // Enable automatic content extraction
          simulate_user: true,
          override_navigator: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CRAWL4AI_API_TOKEN}`
          },
          timeout: 30000
        }
      );
      
      const crawlData = crawlResponse.data;
      
      if (!crawlData.success) {
        throw new Error('Crawl4AI request failed');
      }
      
      // Extract articles from the crawled content
      const articles = [];
      const markdown = crawlData.markdown || '';
      const metadata = crawlData.metadata || {};
      const links = crawlData.links || [];
      
      // Try to extract AI-related content from the page
      const aiContent = extractAIContent(markdown, metadata);
      
      if (aiContent) {
        // Summarize the content
        const summary = await summarizeContent(aiContent.description || aiContent.fullContent);
        
        articles.push({
          title: aiContent.title,
          description: summary,
          link: url,
          image: metadata.og_image || metadata.twitter_image || '',
          source: new URL(url).hostname,
          fullContent: aiContent.fullContent
        });
      }
      
      // Also extract links to other AI articles
      const aiLinks = links.filter(link => {
        const href = (link.href || '').toLowerCase();
        const text = (link.text || '').toLowerCase();
        return (
          href.includes('ai') || href.includes('artificial-intelligence') ||
          href.includes('machine-learning') || href.includes('ml') ||
          text.includes('ai') || text.includes('artificial intelligence') ||
          text.includes('machine learning')
        );
      }).slice(0, 10); // Limit to 10 related links
      
      // For each AI-related link, we could potentially crawl it too
      // But for now, just add them as references
      for (const link of aiLinks) {
        if (link.href && link.text && link.href !== url) {
          articles.push({
            title: link.text,
            description: 'Click to read more about this AI topic',
            link: link.href.startsWith('http') ? link.href : new URL(link.href, url).href,
            image: '',
            source: new URL(url).hostname,
            isReference: true
          });
        }
      }
      
      // Cache the results
      cache.set(cacheKey, {
        data: articles,
        timestamp: Date.now()
      });
      
      console.log(`Successfully crawled ${articles.length} AI-related items from ${url}`);
      
      res.json({
        success: true,
        results: articles,
        cached: false,
        timestamp: Date.now(),
        count: articles.length,
        crawl4ai: true
      });
      
    } catch (error) {
      console.error('Crawl4AI error:', error.message);
      
      // Fallback to simple extraction if Crawl4AI fails
      res.status(500).json({
        error: 'Failed to crawl website',
        details: error.message,
        suggestion: 'Crawl4AI service may be unavailable. Please ensure Docker container is running.'
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

// Batch crawling endpoint for multiple URLs
app.post('/scrape-batch', rateLimit, async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs array is required' });
    }
    
    const results = [];
    
    for (const urlConfig of urls) {
      try {
        const response = await axios.post(
          `http://localhost:${PORT}/scrape`,
          {
            url: urlConfig.url || urlConfig,
            selectors: urlConfig.selectors
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': req.ip // Pass through IP for rate limiting
            }
          }
        );
        
        if (response.data.results) {
          results.push(...response.data.results);
        }
      } catch (error) {
        console.error(`Failed to scrape ${urlConfig.url || urlConfig}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      results: results,
      total: results.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Batch scraping error:', error);
    res.status(500).json({
      error: 'Batch scraping failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Crawl4AI health
    const crawl4aiHealth = await axios.get(`${CRAWL4AI_URL}/health`, {
      timeout: 5000
    }).then(() => true).catch(() => false);
    
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      crawl4ai: crawl4aiHealth ? 'connected' : 'disconnected',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
      cache_size: cache.size
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Cache management endpoints
app.get('/cache/stats', (req, res) => {
  const stats = {
    size: cache.size,
    keys: Array.from(cache.keys()),
    memory: process.memoryUsage()
  };
  res.json(stats);
});

app.post('/cache/clear', (req, res) => {
  cache.clear();
  res.json({ message: 'Cache cleared successfully' });
});

// Error handling
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
  console.log(`AI News Scraper with Crawl4AI running on port ${PORT}`);
  console.log(`Crawl4AI endpoint: ${CRAWL4AI_URL}`);
  console.log(`OpenAI summarization: ${process.env.OPENAI_API_KEY ? 'enabled' : 'disabled'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Clean up old cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}, CACHE_DURATION);

module.exports = app;