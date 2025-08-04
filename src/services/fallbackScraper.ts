import axios from 'axios';

import { 
  API_CONFIG, 
  REQUEST_LIMITS, 
  AI_KEYWORDS,
  ENV_CONFIG
} from '../config/constants';
import type { NewsArticle, NewsCategory } from '../types/news';
import { errorHandler } from '../utils/errorHandler';
import { throttledRequest } from '../utils/requestQueue';

import { imageService } from './imageService';

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
  private readonly newsApiKey: string | null;
  private readonly corsProxy = API_CONFIG.CORS_PROXY;

  constructor() {
    this.newsApiKey = ENV_CONFIG.NEWS_API_KEY;
  }

  async fetchFromRSS(): Promise<NewsArticle[]> {
    const rssOperations = RSS_SOURCES.map(source => 
      () => this.fetchFromSingleRSS(source)
    );

    try {
      const results = await Promise.allSettled(
        rssOperations.map(operation => 
          throttledRequest(operation, 2, { method: 'RSS' })
        )
      );
      
      const articles = results
        .filter((result): result is PromiseFulfilledResult<NewsArticle[]> => 
          result.status === 'fulfilled'
        )
        .flatMap(result => result.value);
      
      return articles;
    } catch (error) {
      errorHandler.logError(error as Error, { operation: 'fetchFromRSS' });
      return [];
    }
  }

  private async fetchFromSingleRSS(source: typeof RSS_SOURCES[0]): Promise<NewsArticle[]> {
    const response = await axios.get(`${this.corsProxy}${encodeURIComponent(source.url)}`);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data.contents, 'text/xml');
    
    const items = xmlDoc.querySelectorAll('item');
    const articles: NewsArticle[] = [];
    
    Array.from(items)
      .slice(0, REQUEST_LIMITS.MAX_RSS_ITEMS)
      .forEach((item, index) => {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        
        if (title && this.isAIRelated(`${title  } ${  description}`)) {
          const content = `${title  } ${  description}`;
          const extractedImage = imageService.extractImageFromContent(description);
          
          articles.push({
            id: `${source.sourceId}-${Date.now()}-${index}`,
            title: this.cleanHtml(title),
            description: this.cleanHtml(description),
            url: link,
            urlToImage: extractedImage || imageService.getImageForCategory(source.category),
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            source: {
              id: source.sourceId,
              name: source.name,
              category: source.category
            },
            author: source.name,
            category: source.category,
            tags: this.extractTags(content),
            relevanceScore: this.calculateRelevanceScore(content)
          });
        }
      });
    
    return articles;
  }

  async fetchFromNewsAPI(): Promise<NewsArticle[]> {
    if (!this.newsApiKey) {
      console.warn('NewsAPI key not configured');
      return [];
    }

    const newsApiOperations = NEWS_API_SOURCES.map(source => 
      () => this.fetchFromSingleNewsAPI(source)
    );

    try {
      const results = await Promise.allSettled(
        newsApiOperations.map((operation: () => Promise<NewsArticle[]>) => 
          throttledRequest(operation, 1, { method: 'NewsAPI' })
        )
      );
      
      const articles = results
        .filter((result): result is PromiseFulfilledResult<NewsArticle[]> => 
          result.status === 'fulfilled'
        )
        .flatMap(result => result.value);
      
      return articles;
    } catch (error) {
      errorHandler.logError(error as Error, { operation: 'fetchFromNewsAPI' });
      return [];
    }
  }

  private async fetchFromSingleNewsAPI(source: typeof NEWS_API_SOURCES[0]): Promise<NewsArticle[]> {
    const response = await axios.get(API_CONFIG.NEWS_API_BASE, {
      params: {
        q: source.q,
        domains: source.domain,
        apiKey: this.newsApiKey,
        sortBy: 'publishedAt',
        pageSize: REQUEST_LIMITS.MAX_ARTICLES_PER_SOURCE,
        language: 'en'
      }
    });

    const newsArticles = response.data.articles || [];
    const articles: NewsArticle[] = [];
    
    newsArticles.forEach((article: any, index: number) => {
      if (this.isAIRelated(`${article.title  } ${  article.description}`)) {
        const content = `${article.title  } ${  article.description}`;
        
        articles.push({
          id: `newsapi-${source.domain}-${Date.now()}-${index}`,
          title: article.title,
          description: article.description || '',
          url: article.url,
          urlToImage: article.urlToImage ? 
            imageService.optimizeImageUrl(article.urlToImage) : 
            imageService.getImageForCategory(source.category),
          publishedAt: article.publishedAt,
          source: {
            id: source.domain.replace('.com', ''),
            name: article.source.name,
            category: source.category
          },
          author: article.author || article.source.name,
          category: source.category,
          tags: this.extractTags(content),
          relevanceScore: this.calculateRelevanceScore(content)
        });
      }
    });
    
    return articles;
  }

  async fetchHackerNews(): Promise<NewsArticle[]> {
    try {
      const topStoriesResponse = await throttledRequest(
        () => axios.get(`${API_CONFIG.HACKER_NEWS_API_BASE}/topstories.json`),
        2,
        { method: 'HackerNews-TopStories' }
      );
      
      const topStories = topStoriesResponse.data.slice(0, REQUEST_LIMITS.MAX_HACKER_NEWS_STORIES);
      
      // Process stories in batches to avoid overwhelming the API
      const storyOperations = topStories
        .slice(0, REQUEST_LIMITS.MAX_HACKER_NEWS_PROCESS)
        .map((storyId: number) => () => this.fetchHackerNewsStory(storyId));

      const results = await Promise.allSettled(
        storyOperations.map((operation: () => Promise<NewsArticle | null>) => 
          throttledRequest(operation, 2, { method: 'HackerNews-Story' })
        )
      );
      
      const articles = results
        .filter((result): result is PromiseFulfilledResult<NewsArticle | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value!);
      
      return articles;
    } catch (error) {
      errorHandler.logError(error as Error, { operation: 'fetchHackerNews' });
      return [];
    }
  }

  private async fetchHackerNewsStory(storyId: number): Promise<NewsArticle | null> {
    const storyResponse = await axios.get(`${API_CONFIG.HACKER_NEWS_API_BASE}/item/${storyId}.json`);
    const story = storyResponse.data;

    if (!story.title || !story.url || !this.isAIRelated(story.title)) {
      return null;
    }

    const content = story.title + (story.text ? ` ${  story.text}` : '');
    
    return {
      id: `hackernews-${storyId}`,
      title: story.title,
      description: story.text ? this.cleanHtml(story.text) : 'Discussion on Hacker News',
      url: story.url,
      urlToImage: imageService.getImageForCategory('tech-news'),
      publishedAt: new Date(story.time * 1000).toISOString(),
      source: {
        id: 'hackernews',
        name: 'Hacker News',
        category: 'Tech News'
      },
      author: story.by || 'Hacker News',
      category: 'tech-news',
      tags: this.extractTags(content),
      relevanceScore: this.calculateRelevanceScore(content)
    };
  }

  private isAIRelated(text: string): boolean {
    const allKeywords = [
      ...AI_KEYWORDS.PRIMARY,
      ...AI_KEYWORDS.COMPANIES,
      ...AI_KEYWORDS.TECHNOLOGIES,
      ...AI_KEYWORDS.DOMAINS
    ];

    const lowerText = text.toLowerCase();
    return allKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private cleanHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }


  private extractTags(content: string): string[] {
    const allKeywords = [
      ...AI_KEYWORDS.PRIMARY,
      ...AI_KEYWORDS.COMPANIES,
      ...AI_KEYWORDS.TECHNOLOGIES,
      ...AI_KEYWORDS.DOMAINS
    ];
    
    const lowerContent = content.toLowerCase();
    return allKeywords
      .filter(keyword => lowerContent.includes(keyword.toLowerCase()))
      .slice(0, REQUEST_LIMITS.MAX_TAGS_PER_ARTICLE);
  }

  private calculateRelevanceScore(content: string): number {
    const lowerContent = content.toLowerCase();
    let score = 0.5;
    
    // High-value keywords boost
    AI_KEYWORDS.HIGH_VALUE.forEach(keyword => {
      if (lowerContent.includes(keyword.toLowerCase())) {
        score += 0.1;
      }
    });
    
    // AI-specific terms bonus
    if (lowerContent.includes('gpt') || lowerContent.includes('llm')) {
      score += 0.2;
    }
    
    // Major AI companies bonus
    AI_KEYWORDS.COMPANIES.forEach(company => {
      if (lowerContent.includes(company.toLowerCase())) {
        score += 0.15;
      }
    });
    
    return Math.min(score, 1.0);
  }

}

export const fallbackScraper = new FallbackScraper();