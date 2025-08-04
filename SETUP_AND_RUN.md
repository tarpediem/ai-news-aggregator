# AI News Hub - Setup and Run Instructions

## Overview
AI News Hub is a modern web application that aggregates AI-related news from various sources and research papers from ArXiv. It features a beautiful UI with Magic UI components, real-time scraping capabilities, and optimized performance.

## Prerequisites
- Node.js 18+ and npm
- Linux/Mac/Windows with bash support
- Internet connection

## Quick Start

### Option 1: Using the startup script (Recommended)
```bash
cd ai-news-app
./start-app.sh
```

This will:
- Install all dependencies
- Start the scraper backend on port 8001
- Start the frontend on port 5173
- Open http://localhost:5173 in your browser

### Option 2: Manual setup

1. **Start the scraper backend:**
```bash
cd ai-news-app/scraper-backend
npm install
node server.js
```

2. **In a new terminal, start the frontend:**
```bash
cd ai-news-app
npm install
npm run dev
```

3. **Open your browser to http://localhost:5173**

## Features

### 1. News Aggregation
- Scrapes AI news from multiple sources including:
  - OpenAI Blog
  - Google AI Blog
  - Anthropic News
  - MIT Technology Review
  - The Verge AI section
  - VentureBeat AI
  - And more...

### 2. Research Papers
- Fetches latest AI research papers from ArXiv
- Displays paper titles, abstracts, and authors
- Direct links to PDFs

### 3. Search & Filter
- Search across all news articles
- Filter by category (AI, ML, Deep Learning, etc.)
- View trending topics

### 4. Performance Features
- Progressive loading for fast initial render
- Virtual scrolling for large datasets
- Optimized image loading
- Service worker for offline support

### 5. UI Features
- Dark/Light mode toggle
- Responsive design
- Beautiful animations with Framer Motion
- Glassmorphism effects
- Magic UI components

## Environment Configuration

The app uses environment variables configured in `.env`:

```env
# Scraper Backend URL
VITE_SCRAPER_API_URL=http://localhost:8001

# Optional API Keys for fallback methods
VITE_NEWS_API_KEY=
VITE_NEWSDATA_API_KEY=

# Feature Flags
VITE_ENABLE_PROGRESSIVE_LOADING=true
VITE_ENABLE_VIRTUALIZATION=true
VITE_ENABLE_OFFLINE_MODE=true
```

## Troubleshooting

### Issue: "Cannot connect to scraper backend"
- Ensure the backend is running on port 8001
- Check if another service is using port 8001
- Verify the VITE_SCRAPER_API_URL in .env

### Issue: "No news articles found"
- The scraper might be rate-limited
- Try refreshing after a few seconds
- Check browser console for errors

### Issue: "ArXiv papers not loading"
- ArXiv API might be temporarily down
- Check browser console for CORS errors
- The proxy configuration handles CORS issues

## Development Commands

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

```
ai-news-app/
├── src/
│   ├── components/      # React components
│   ├── services/        # API and data services
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript types
│   └── config/          # Configuration constants
├── scraper-backend/     # Express.js scraper service
└── public/              # Static assets
```

## Key Technologies
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **UI Libraries**: Magic UI, Framer Motion, Lucide Icons
- **State Management**: Zustand, React Query
- **Backend**: Express.js, Cheerio, Axios
- **Performance**: Virtual scrolling, Progressive loading, Service Workers

## Security Features
- Rate limiting on backend
- CORS protection
- Input sanitization
- Secure headers with Helmet

## Performance Optimizations
- Caching with 30-minute TTL
- Request batching
- Image optimization
- Code splitting
- Tree shaking

## Contributing
Feel free to submit issues and enhancement requests!

## License
MIT License