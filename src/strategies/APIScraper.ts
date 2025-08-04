/**
 * API-based scraper implementations
 * Handles various news APIs with authentication and rate limiting
 */

import { BaseAPIScraper } from '../abstracts/BaseScraper';
import { API_CONFIG, ENV_CONFIG, REQUEST_LIMITS } from '../config/constants';
import type { ScrapeOptions, ScraperConfig, APIRequestOptions } from '../interfaces/INewsScaper';
import { imageService } from '../services/imageService';
import type { NewsArticle, NewsCategory } from '../types/news';

/**
 * NewsAPI.org scraper implementation
 */
export class NewsAPIScraper extends BaseAPIScraper {
  readonly baseUrl = API_CONFIG.NEWS_API_BASE;
  readonly endpoints = {
    everything: '/everything',
    topHeadlines: '/top-headlines',
    sources: '/sources',
  };

  constructor(config: ScraperConfig) {
    super(config);
    
    if (!this.apiKey) {
      console.warn('NewsAPI scraper configured without API key - functionality will be limited');
    }
  }

  protected async performScrape(options: ScrapeOptions): Promise<NewsArticle[]> {
    if (!this.apiKey) {
      console.warn('NewsAPI scraper: No API key configured, skipping');
      return [];
    }

    const articles: NewsArticle[] = [];
    
    // Define search queries based on categories
    const queries = this.buildSearchQueries(options.categories);
    
    for (const query of queries) {
      try {
        const response = await this.apiRequest(this.endpoints.everything, {
          params: {
            q: query.searchTerm,
            domains: query.domains?.join(','),
            language: 'en',
            sortBy: 'publishedAt',
            pageSize: Math.min(options.maxArticles || 20, REQUEST_LIMITS.MAX_ARTICLES_PER_SOURCE),
            apiKey: this.apiKey,
          },
        });

        const transformedArticles = this.transformResponse(response);
        articles.push(...transformedArticles.map(article => ({
          ...article,
          category: query.category,
        })));

      } catch (error) {
        console.error(`NewsAPI query failed for "${query.searchTerm}":`, error);
      }
    }

    return articles;
  }

  transformResponse(response: any): NewsArticle[] {
    if (!response?.articles) {
      return [];
    }

    return response.articles
      .filter((item: any) => this.isValidAPIResponse(item))
      .map((item: any, index: number) => {
        const content = `${item.title} ${item.description || ''}`;
        
        return {
          id: `newsapi-${this.simpleHash(item.url)}-${index}`,
          title: item.title,
          description: item.description || 'No description available',
          url: item.url,
          urlToImage: item.urlToImage ? 
            imageService.optimizeImageUrl(item.urlToImage) : 
            imageService.getImageForCategory('tech-news'),
          publishedAt: item.publishedAt,
          source: {
            id: item.source.id || 'newsapi',
            name: item.source.name || 'NewsAPI',
            category: 'Tech News',
          },
          author: item.author || item.source.name,
          category: 'tech-news' as NewsCategory,
          tags: this.extractTags(content),
          relevanceScore: this.calculateRelevanceScore({ title: item.title, description: item.description } as NewsArticle),
        };
      });
  }

  private buildSearchQueries(categories?: NewsCategory[]) {
    const baseQueries = [
      {
        searchTerm: 'artificial intelligence OR AI OR machine learning',
        category: 'artificial-intelligence' as NewsCategory,
        domains: ['techcrunch.com', 'theverge.com', 'wired.com'],
      },
      {
        searchTerm: 'deep learning OR neural networks OR GPT',
        category: 'deep-learning' as NewsCategory,
        domains: ['techcrunch.com', 'venturebeat.com'],
      },
      {
        searchTerm: 'OpenAI OR ChatGPT OR Anthropic OR Claude',
        category: 'artificial-intelligence' as NewsCategory,
        domains: ['techcrunch.com', 'theverge.com'],
      },
      {
        searchTerm: 'computer vision OR NLP OR natural language processing',
        category: 'nlp' as NewsCategory,
        domains: ['techcrunch.com', 'venturebeat.com'],
      },
    ];

    // Filter queries based on requested categories
    if (categories?.length) {
      return baseQueries.filter(query => categories.includes(query.category));
    }

    return baseQueries;
  }

  private isValidAPIResponse(item: any): boolean {
    return !!(
      item?.title &&
      item?.url &&
      item?.source?.name &&
      item?.publishedAt &&
      !item.title.includes('[Removed]') &&
      !item.description?.includes('[Removed]')
    );
  }

  protected async checkHealth(): Promise<boolean> {
    if (!this.config.enabled || !this.apiKey) return false;
    
    try {
      await this.apiRequest(this.endpoints.everything, {
        params: {
          q: 'test',
          pageSize: 1,
          apiKey: this.apiKey,
        },
      });
      return true;
    } catch (error: any) {
      // Check for specific API errors
      if (error.response?.status === 401) {
        console.error('NewsAPI: Invalid API key');
      } else if (error.response?.status === 429) {
        console.error('NewsAPI: Rate limit exceeded');
      }
      return false;
    }
  }
}

/**
 * Hacker News API scraper implementation
 */
export class HackerNewsScraper extends BaseAPIScraper {
  readonly baseUrl = API_CONFIG.HACKER_NEWS_API_BASE;
  readonly endpoints = {
    topStories: '/topstories.json',
    item: '/item',
    user: '/user',
  };

  // Hacker News doesn't require API key
  get apiKey(): string | undefined {
    return undefined;
  }

  protected async performScrape(options: ScrapeOptions): Promise<NewsArticle[]> {
    try {
      // Get top story IDs
      const storyIds = await this.apiRequest<number[]>(this.endpoints.topStories);
      
      // Limit the number of stories to process
      const maxStories = Math.min(
        options.maxArticles || REQUEST_LIMITS.MAX_HACKER_NEWS_PROCESS,
        REQUEST_LIMITS.MAX_HACKER_NEWS_STORIES
      );
      
      const processIds = storyIds.slice(0, maxStories);
      
      // Fetch story details in parallel (with concurrency limit)
      const articles: NewsArticle[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < processIds.length; i += batchSize) {
        const batch = processIds.slice(i, i + batchSize);
        const batchPromises = batch.map(id => this.fetchStory(id));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            articles.push(result.value);
          }
        });
      }
      
      return articles;
      
    } catch (error) {
      console.error('HackerNews scraper failed:', error);
      return [];
    }
  }

  private async fetchStory(id: number): Promise<NewsArticle | null> {
    try {
      const story = await this.apiRequest<any>(`${this.endpoints.item}/${id}.json`);
      
      if (!this.isValidHackerNewsStory(story)) {
        return null;
      }

      const content = story.title + (story.text ? ` ${  story.text}` : '');
      
      return {
        id: `hackernews-${id}`,
        title: story.title,
        description: story.text ? this.cleanHtml(story.text) : 'Discussion on Hacker News',
        url: story.url || `https://news.ycombinator.com/item?id=${id}`,
        urlToImage: imageService.getImageForCategory('tech-news'),
        publishedAt: new Date(story.time * 1000).toISOString(),
        source: {
          id: 'hackernews',
          name: 'Hacker News',
          category: 'Tech News',
        },
        author: story.by || 'Hacker News',
        category: 'tech-news' as NewsCategory,
        tags: this.extractTags(content),
        relevanceScore: this.calculateRelevanceScore({ title: story.title, description: story.text } as NewsArticle),
      };
      
    } catch (error) {
      console.warn(`Failed to fetch Hacker News story ${id}:`, error);
      return null;
    }
  }

  private isValidHackerNewsStory(story: any): boolean {
    return !!(
      story?.title &&
      story.type === 'story' &&
      !story.deleted &&
      !story.dead &&
      this.isAIRelated(story.title + (story.text || ''))
    );
  }

  private isAIRelated(text: string): boolean {
    const lowerText = text.toLowerCase();
    const aiKeywords = [
      'artificial intelligence', 'machine learning', 'deep learning',
      'ai', 'ml', 'gpt', 'llm', 'openai', 'anthropic',
      'neural', 'algorithm', 'automation', 'chatbot',
      'computer vision', 'nlp', 'robotics',
    ];

    return aiKeywords.some(keyword => lowerText.includes(keyword));
  }

  transformResponse(response: any): NewsArticle[] {
    // Not used for Hacker News (uses custom fetchStory method)
    return [];
  }

  protected async checkHealth(): Promise<boolean> {
    if (!this.config.enabled) return false;
    
    try {
      const storyIds = await this.apiRequest<number[]>(this.endpoints.topStories);
      return Array.isArray(storyIds) && storyIds.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Generic API scraper for custom APIs
 */
export class GenericAPIScraper extends BaseAPIScraper {
  readonly baseUrl: string;
  readonly endpoints: Record<string, string>;

  constructor(config: ScraperConfig) {
    super(config);
    this.baseUrl = config.baseUrl || '';
    this.endpoints = config.endpoints || { default: '' };
    
    if (!this.baseUrl) {
      throw new Error('Generic API scraper requires baseUrl in config');
    }
  }

  transformResponse(response: any): NewsArticle[] {
    // Generic transformation - should be customized based on API structure
    const articles = Array.isArray(response) ? response : 
                    response?.articles || response?.data || response?.items || [];
    
    return articles
      .filter((item: any) => item?.title && item?.url)
      .map((item: any, index: number) => ({
        id: `${this.id}-${this.simpleHash(item.url || item.title)}-${index}`,
        title: item.title,
        description: item.description || item.summary || item.content || 'No description available',
        url: item.url || item.link,
        urlToImage: item.image || item.thumbnail || imageService.getImageForCategory(this.categories[0]),
        publishedAt: item.publishedAt || item.published || item.date || new Date().toISOString(),
        source: {
          id: this.id,
          name: this.name,
          category: this.categories[0],
        },
        author: item.author || item.creator || this.name,
        category: this.categories[0],
        tags: this.extractTags(`${item.title || ''  } ${  item.description || ''}`),
        relevanceScore: this.calculateRelevanceScore(item as NewsArticle),
      }));
  }
}

// Factory functions
export function createNewsAPIScraper(config: Partial<ScraperConfig> = {}): NewsAPIScraper {
  return new NewsAPIScraper({
    id: 'newsapi',
    name: 'NewsAPI',
    type: 'api',
    priority: 1,
    categories: ['tech-news', 'artificial-intelligence'],
    apiKey: ENV_CONFIG.NEWS_API_KEY,
    rateLimitMs: 1000,
    maxRetries: 3,
    timeout: 10000,
    enabled: !!ENV_CONFIG.NEWS_API_KEY,
    ...config,
  });
}

export function createHackerNewsScraper(config: Partial<ScraperConfig> = {}): HackerNewsScraper {
  return new HackerNewsScraper({
    id: 'hackernews',
    name: 'Hacker News',
    type: 'api',
    priority: 2,
    categories: ['tech-news'],
    rateLimitMs: 500, // Hacker News is usually fast
    maxRetries: 3,
    timeout: 10000,
    enabled: true,
    ...config,
  });
}

// Predefined API scraper configurations
export const API_SCRAPER_CONFIGS: ScraperConfig[] = [
  {
    id: 'newsapi',
    name: 'NewsAPI',
    type: 'api',
    priority: 1,
    categories: ['tech-news', 'artificial-intelligence'],
    baseUrl: API_CONFIG.NEWS_API_BASE,
    apiKey: ENV_CONFIG.NEWS_API_KEY,
    endpoints: {
      everything: '/everything',
      topHeadlines: '/top-headlines',
    },
    rateLimitMs: 1000,
    maxRetries: 3,
    timeout: 10000,
    enabled: !!ENV_CONFIG.NEWS_API_KEY,
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    type: 'api',
    priority: 2,
    categories: ['tech-news'],
    baseUrl: API_CONFIG.HACKER_NEWS_API_BASE,
    endpoints: {
      topStories: '/topstories.json',
      item: '/item',
    },
    rateLimitMs: 500,
    maxRetries: 3,
    timeout: 10000,
    enabled: true,
  },
];