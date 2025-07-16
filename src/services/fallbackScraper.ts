import axios from 'axios';
import type { NewsArticle, NewsCategory } from '../types/news';

// RSS and API endpoints for AI news sources
const RSS_SOURCES = [
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'tech-news' as NewsCategory,
    sourceId: 'mit-tech-review'
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    category: 'industry' as NewsCategory,
    sourceId: 'venturebeat'
  },
  {
    name: 'AI News RSS',
    url: 'https://artificialintelligence-news.com/feed/',
    category: 'artificial-intelligence' as NewsCategory,
    sourceId: 'ai-news'
  }
];

// NewsAPI.org sources (requires API key)
const NEWS_API_SOURCES = [
  {
    domain: 'techcrunch.com',
    q: 'artificial intelligence OR machine learning OR AI',
    category: 'tech-news' as NewsCategory
  },
  {
    domain: 'wired.com',
    q: 'artificial intelligence OR AI',
    category: 'tech-news' as NewsCategory
  },
  {
    domain: 'theverge.com',
    q: 'artificial intelligence OR AI OR machine learning',
    category: 'tech-news' as NewsCategory
  }
];

class FallbackScraper {
  private newsApiKey: string | null;
  private corsProxy = 'https://api.allorigins.win/get?url=';

  constructor() {
    this.newsApiKey = import.meta.env.VITE_NEWS_API_KEY || null;
  }

  async fetchFromRSS(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    for (const source of RSS_SOURCES) {
      try {
        const response = await axios.get(`${this.corsProxy}${encodeURIComponent(source.url)}`);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response.data.contents, 'text/xml');
        
        const items = xmlDoc.querySelectorAll('item');
        
        Array.from(items).slice(0, 5).forEach((item, index) => {
          const title = item.querySelector('title')?.textContent || '';
          const description = item.querySelector('description')?.textContent || '';
          const link = item.querySelector('link')?.textContent || '';
          const pubDate = item.querySelector('pubDate')?.textContent || '';
          
          if (title && this.isAIRelated(title + ' ' + description)) {
            articles.push({
              id: `${source.sourceId}-${Date.now()}-${index}`,
              title: this.cleanHtml(title),
              description: this.cleanHtml(description),
              url: link,
              urlToImage: this.extractImageFromDescription(description) || 
                         `https://via.placeholder.com/400x200?text=${encodeURIComponent(source.name)}`,
              publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              source: {
                id: source.sourceId,
                name: source.name,
                category: source.category
              },
              author: source.name,
              category: source.category,
              tags: this.extractTags(title + ' ' + description),
              relevanceScore: this.calculateRelevanceScore(title + ' ' + description)
            });
          }
        });
        
      } catch (error) {
        console.error(`Error fetching RSS from ${source.name}:`, error);
      }
    }

    return articles;
  }

  async fetchFromNewsAPI(): Promise<NewsArticle[]> {
    if (!this.newsApiKey) {
      console.warn('NewsAPI key not configured');
      return [];
    }

    const articles: NewsArticle[] = [];

    for (const source of NEWS_API_SOURCES) {
      try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: source.q,
            domains: source.domain,
            apiKey: this.newsApiKey,
            sortBy: 'publishedAt',
            pageSize: 10,
            language: 'en'
          }
        });

        const newsArticles = response.data.articles || [];
        
        newsArticles.forEach((article: any, index: number) => {
          if (this.isAIRelated(article.title + ' ' + article.description)) {
            articles.push({
              id: `newsapi-${source.domain}-${Date.now()}-${index}`,
              title: article.title,
              description: article.description || '',
              url: article.url,
              urlToImage: article.urlToImage || 
                         `https://via.placeholder.com/400x200?text=${encodeURIComponent(source.domain)}`,
              publishedAt: article.publishedAt,
              source: {
                id: source.domain.replace('.com', ''),
                name: article.source.name,
                category: source.category
              },
              author: article.author || article.source.name,
              category: source.category,
              tags: this.extractTags(article.title + ' ' + article.description),
              relevanceScore: this.calculateRelevanceScore(article.title + ' ' + article.description)
            });
          }
        });
        
      } catch (error) {
        console.error(`Error fetching from NewsAPI for ${source.domain}:`, error);
      }
    }

    return articles;
  }

  async fetchHackerNews(): Promise<NewsArticle[]> {
    try {
      // Get top stories from Hacker News
      const topStoriesResponse = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
      const topStories = topStoriesResponse.data.slice(0, 50); // Get first 50 stories

      const articles: NewsArticle[] = [];

      // Fetch details for each story
      for (let i = 0; i < Math.min(topStories.length, 20); i++) {
        const storyId = topStories[i];
        try {
          const storyResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
          const story = storyResponse.data;

          if (story.title && story.url && this.isAIRelated(story.title)) {
            articles.push({
              id: `hackernews-${storyId}`,
              title: story.title,
              description: story.text ? this.cleanHtml(story.text) : 'Discussion on Hacker News',
              url: story.url,
              urlToImage: 'https://via.placeholder.com/400x200?text=Hacker+News',
              publishedAt: new Date(story.time * 1000).toISOString(),
              source: {
                id: 'hackernews',
                name: 'Hacker News',
                category: 'Tech News'
              },
              author: story.by || 'Hacker News',
              category: 'tech-news',
              tags: this.extractTags(story.title),
              relevanceScore: this.calculateRelevanceScore(story.title)
            });
          }
        } catch (error) {
          console.error(`Error fetching Hacker News story ${storyId}:`, error);
        }
      }

      return articles;
    } catch (error) {
      console.error('Error fetching Hacker News:', error);
      return [];
    }
  }

  private isAIRelated(text: string): boolean {
    const aiKeywords = [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'ai', 'ml', 'gpt', 'llm', 'openai', 'google ai', 'deepmind', 'anthropic',
      'computer vision', 'natural language processing', 'nlp', 'robotics',
      'automation', 'algorithm', 'chatbot', 'transformer', 'bert', 'tensorflow',
      'pytorch', 'data science', 'predictive analytics'
    ];

    const lowerText = text.toLowerCase();
    return aiKeywords.some(keyword => lowerText.includes(keyword));
  }

  private cleanHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private extractImageFromDescription(description: string): string | null {
    const imgRegex = /<img[^>]+src="([^"]+)"/i;
    const match = description.match(imgRegex);
    return match ? match[1] : null;
  }

  private extractTags(content: string): string[] {
    const aiKeywords = [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'gpt', 'llm', 'openai', 'google', 'anthropic', 'meta', 'microsoft', 'nvidia',
      'computer vision', 'nlp', 'robotics', 'automation', 'algorithm', 'chatbot'
    ];
    
    const lowerContent = content.toLowerCase();
    return aiKeywords.filter(keyword => lowerContent.includes(keyword))
                    .slice(0, 5);
  }

  private calculateRelevanceScore(content: string): number {
    const highValueKeywords = ['breakthrough', 'new', 'launches', 'releases', 'announces'];
    const lowerContent = content.toLowerCase();
    
    let score = 0.5;
    
    highValueKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
      }
    });
    
    if (lowerContent.includes('gpt') || lowerContent.includes('llm')) score += 0.2;
    if (lowerContent.includes('openai') || lowerContent.includes('anthropic')) score += 0.15;
    
    return Math.min(score, 1.0);
  }
}

export const fallbackScraper = new FallbackScraper();