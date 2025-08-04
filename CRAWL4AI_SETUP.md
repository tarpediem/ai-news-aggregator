# AI News Hub with Crawl4AI - Setup Guide

## Overview
This enhanced version of AI News Hub uses Crawl4AI Docker for advanced web scraping and OpenAI for content summarization. Crawl4AI provides better JavaScript rendering, anti-bot bypassing, and structured content extraction.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Scraper Backend │────▶│   Crawl4AI      │
│  (React + Vite) │     │   (Express.js)   │     │   (Docker)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   OpenAI API     │
                        │  (Summarization) │
                        └──────────────────┘
```

## Prerequisites
- Docker and Docker Compose installed
- OpenAI API key (for content summarization)
- 4GB+ RAM recommended
- Internet connection

## Quick Start

### 1. Clone and navigate to the project
```bash
cd ai-news-app
```

### 2. Set up environment variables
```bash
# Copy the template
cp .env.docker .env

# Edit .env and add your API keys:
# - OPENAI_API_KEY=sk-your-openai-key-here
# - CRAWL4AI_API_TOKEN=your-custom-token-here (or keep default)
```

### 3. Start with Docker
```bash
./start-docker.sh
```

This will:
- Pull the Crawl4AI Docker image
- Build the application containers
- Start all services
- Show real-time logs

### 4. Access the application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8001
- Crawl4AI Health: http://localhost:11235/health

## Features Added with Crawl4AI

### 1. Advanced Web Scraping
- **JavaScript Rendering**: Crawl4AI can handle dynamic content loaded by JavaScript
- **Anti-Bot Bypassing**: Simulates real user behavior to avoid detection
- **Structured Extraction**: Automatically extracts markdown content with proper formatting

### 2. AI-Powered Summarization
- Each scraped article is summarized using OpenAI GPT-3.5
- Summaries focus on AI/ML aspects
- Fallback to truncation if OpenAI is not configured

### 3. Intelligent Content Filtering
- Automatically identifies AI-related content
- Filters out non-relevant articles
- Extracts related AI links for deeper exploration

## API Endpoints

### Scrape Single URL
```bash
POST http://localhost:8001/scrape
Content-Type: application/json

{
  "url": "https://openai.com/blog"
}
```

### Batch Scraping
```bash
POST http://localhost:8001/scrape-batch
Content-Type: application/json

{
  "urls": [
    "https://openai.com/blog",
    "https://anthropic.com/news",
    "https://ai.googleblog.com"
  ]
}
```

### Health Check
```bash
GET http://localhost:8001/health
```

## Configuration

### Environment Variables

```env
# Crawl4AI Configuration
CRAWL4AI_API_TOKEN=your_secret_token_here
CRAWL4AI_URL=http://crawl4ai:11235  # Internal Docker network

# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here  # Required for summarization

# Application Settings
NODE_ENV=production
PORT=8001
```

### Crawl4AI Options

The backend uses these Crawl4AI features:
- `extract_markdown`: Convert HTML to clean markdown
- `extract_metadata`: Get page metadata (title, description, images)
- `extract_links`: Find related article links
- `magic`: Enable automatic content extraction
- `simulate_user`: Mimic human browsing behavior
- `bypass_cache`: Force fresh content when needed

## Docker Services

### 1. crawl4ai
- Image: `unclecode/crawl4ai:latest`
- Port: 11235
- Features: Web scraping, JS rendering, anti-bot measures

### 2. scraper-backend
- Custom Node.js service
- Port: 8001
- Features: API endpoints, content filtering, AI summarization

### 3. frontend
- React + Vite application
- Port: 5173
- Features: UI, real-time updates, dark mode

## Troubleshooting

### Issue: "Crawl4AI service unavailable"
```bash
# Check if Crawl4AI is running
docker-compose ps

# View Crawl4AI logs
docker-compose logs crawl4ai

# Restart Crawl4AI
docker-compose restart crawl4ai
```

### Issue: "No AI summaries generated"
- Verify OPENAI_API_KEY is set in .env
- Check OpenAI API quota and limits
- View backend logs: `docker-compose logs scraper-backend`

### Issue: "Docker containers not starting"
```bash
# Stop all containers
docker-compose down

# Remove volumes and rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Advanced Usage

### Custom Crawl4AI Configuration

Edit `crawl4ai-server.js` to modify crawling behavior:

```javascript
const crawlResponse = await axios.post(
  `${CRAWL4AI_URL}/crawl`,
  {
    url: url,
    // Add custom options here
    wait_for_selector: '.article-content',
    screenshot: true,
    pdf: true,
    remove_ads: true
  }
);
```

### Scaling

For production deployment:

1. Use external Redis for caching
2. Run multiple backend instances
3. Use nginx for load balancing
4. Consider Kubernetes deployment

## Development

### Running without Docker

1. Start Crawl4AI manually:
```bash
docker run -p 11235:11235 unclecode/crawl4ai:latest
```

2. Start backend:
```bash
cd scraper-backend
npm install
CRAWL4AI_URL=http://localhost:11235 npm run start:crawl4ai
```

3. Start frontend:
```bash
cd ai-news-app
npm install
npm run dev
```

### Testing

```bash
# Test Crawl4AI connection
curl http://localhost:11235/health

# Test scraping
curl -X POST http://localhost:8001/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://openai.com/blog"}'
```

## Security Considerations

1. **API Token**: Change default CRAWL4AI_API_TOKEN in production
2. **Rate Limiting**: Backend implements rate limiting (30 req/min)
3. **CORS**: Configured for localhost only by default
4. **Input Validation**: All URLs are validated before scraping
5. **Docker Security**: Runs with non-root user

## Performance Tips

1. **Caching**: Results cached for 10 minutes
2. **Batch Processing**: Use batch endpoint for multiple URLs
3. **Selective Scraping**: Target specific page sections
4. **Resource Limits**: Set Docker memory limits for stability

## License
MIT License