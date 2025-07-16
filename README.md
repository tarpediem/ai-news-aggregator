# AI News Aggregator

A modern React-based news aggregation application that scrapes and displays the latest AI news from various sources across the web.

## Features

### 🔥 Core Features
- **Real-time News Scraping**: Uses Craw4ai to scrape AI news from major sources
- **Multiple News Sources**: Aggregates from OpenAI, Google AI, Anthropic, MIT Tech Review, The Verge, and more
- **arXiv Papers Integration**: Fetches latest AI research papers from arXiv
- **Smart Categorization**: Automatically categorizes news by AI, ML, Deep Learning, etc.
- **Search & Filter**: Search articles and filter by categories
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works on desktop and mobile devices

### 🚀 Technical Features
- **Modern React Stack**: React 19, TypeScript, Vite
- **State Management**: TanStack Query for server state management
- **Styling**: Tailwind CSS with custom dark mode support
- **UI Components**: Magic UI components for enhanced UX
- **Web Scraping**: Craw4ai backend service with fallback mechanisms
- **Caching**: Intelligent caching for better performance
- **Error Handling**: Graceful fallbacks when scraping fails

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Quick Start
1. Install dependencies:
   ```bash
   npm install
   cd scraper-backend
   npm install
   cd ..
   ```

2. Start the full stack:
   ```bash
   ./start-full-stack.sh
   ```

3. Open your browser:
   - **Frontend**: http://localhost:5173
   - **Backend API**: http://localhost:8000

### Environment Variables

Create a `.env` file in the root directory:
```env
# Optional: NewsAPI.org key for additional sources
VITE_NEWS_API_KEY=your_newsapi_key_here

# Optional: Custom scraper backend endpoint
VITE_SCRAPER_ENDPOINT=http://localhost:8000/scrape
```

## News Sources

### Primary Sources (Web Scraping)
- **OpenAI Blog** - Latest OpenAI announcements and research
- **Google AI Blog** - Google's AI developments and research
- **Anthropic News** - Anthropic's AI safety and research updates
- **MIT Technology Review** - AI section for tech analysis
- **The Verge AI** - AI industry news and analysis
- **VentureBeat AI** - AI business and startup news
- **AI News** - Dedicated AI news publication
- **Towards Data Science** - AI and ML tutorials and insights

### Fallback Sources
- **RSS Feeds** - MIT Tech Review, VentureBeat, AI News RSS
- **NewsAPI.org** - TechCrunch, Wired, The Verge (requires API key)
- **Hacker News** - AI-related discussions and links
- **arXiv API** - Latest AI research papers

## Usage

The application will automatically:
1. Scrape configured AI news sources
2. Parse and categorize articles
3. Display them in a clean, organized interface
4. Allow filtering by categories and searching
5. Fall back to alternative sources if primary scraping fails

No additional configuration is needed - the app works out of the box!

---

**Happy news aggregating!** 🤖📰