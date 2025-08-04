/**
 * Base abstract classes for news scrapers
 * Provides common functionality and enforces consistent patterns
 */

import axios from 'axios';

import { AI_KEYWORDS } from '../config/constants';
import type {
  INewsScraper,
  IRSScraper,
  IAPIScraper,
  IWebScraper,
  ScraperConfig,
  ScrapeOptions,
  HealthStatus,
  APIRequestOptions,
  SelectorConfig,
} from '../interfaces/INewsScaper';
import { imageService } from '../services/imageService';
import type { NewsArticle, NewsCategory } from '../types/news';
import { errorHandler, withTimeout } from '../utils/errorHandler';
import { throttledRequest } from '../utils/requestQueue';


/**
 * Abstract base class for all news scrapers
 * Implements common functionality and enforces interface contracts
 */
export abstract class BaseScraper implements INewsScraper {
  protected readonly config: ScraperConfig;
  protected lastHealthCheck: HealthStatus | undefined;
  protected stats = {
    totalRequests: 0,
    successfulRequests: 0,
    totalArticles: 0,
    averageResponseTime: 0,
    lastActive: new Date(),
  };

  constructor(config: ScraperConfig) {
    this.config = { ...config };
    this.validateConfig();
  }

  // Public interface implementation
  get id(): string { return this.config.id; }
  get name(): string { return this.config.name; }
  get priority(): number { return this.config.priority; }
  get categories(): NewsCategory[] { return [...this.config.categories]; }
  get rateLimitMs(): number { return this.config.rateLimitMs; }
  get maxRetries(): number { return this.config.maxRetries; }

  /**
   * Main scraping method that orchestrates the scraping process
   */
  async scrape(options: ScrapeOptions = {}): Promise<NewsArticle[]> {
    if (!this.config.enabled) {
      throw new Error(`Scraper ${this.id} is disabled`);
    }

    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      // Execute scraping with proper error handling and rate limiting
      const articles = await throttledRequest(
        () => withTimeout(
          () => this.performScrape(options),
          options.timeout || this.config.timeout
        ),
        this.priority,
        { scraperId: this.id, operation: 'scrape' }
      );

      // Process and validate articles
      const processedArticles = await this.processArticles(articles, options);
      
      // Update statistics
      const duration = performance.now() - startTime;
      this.updateStats(processedArticles.length, duration, true);
      
      return processedArticles;

    } catch (error) {
      this.updateStats(0, performance.now() - startTime, false);
      errorHandler.logError(error as Error, {
        scraperId: this.id,
        operation: 'scrape',
        options,
      });
      throw error;
    }
  }

  /**
   * Check if this scraper can handle a specific URL
   */
  abstract canHandle(url: string): boolean;

  /**
   * Perform the actual scraping logic (implemented by subclasses)
   */
  protected abstract performScrape(options: ScrapeOptions): Promise<NewsArticle[]>;

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = performance.now();
    
    try {
      const isHealthy = await this.checkHealth();
      const responseTime = performance.now() - startTime;
      
      this.lastHealthCheck = {
        healthy: isHealthy,
        status: isHealthy ? 'active' : 'degraded',
        responseTime,
        lastChecked: new Date(),
        metadata: {
          stats: this.stats,
          config: {
            id: this.id,
            name: this.name,
            type: this.config.type,
            enabled: this.config.enabled,
          },
        },
      };
      
      return this.lastHealthCheck;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      this.lastHealthCheck = {
        healthy: false,
        status: 'down',
        responseTime,
        lastChecked: new Date(),
        errors: [{ 
          ...errorHandler.classifyError(error as Error),
          context: {}
        }],
        metadata: { stats: this.stats },
      };
      
      return this.lastHealthCheck;
    }
  }

  /**
   * Get scraper configuration (safe copy)
   */
  getConfig(): ScraperConfig {
    return { ...this.config };
  }

  /**
   * Get scraper statistics
   */
  getStats() {
    return { ...this.stats };
  }

  // Protected helper methods

  /**
   * Validate scraper configuration
   */
  protected validateConfig(): void {
    if (!this.config.id) throw new Error('Scraper ID is required');
    if (!this.config.name) throw new Error('Scraper name is required');
    if (this.config.priority < 0) throw new Error('Priority must be non-negative');
    if (this.config.rateLimitMs < 0) throw new Error('Rate limit must be non-negative');
    if (this.config.maxRetries < 0) throw new Error('Max retries must be non-negative');
    if (this.config.timeout < 0) throw new Error('Timeout must be non-negative');
  }

  /**
   * Process scraped articles with validation and enhancement
   */
  protected async processArticles(
    articles: NewsArticle[],
    options: ScrapeOptions
  ): Promise<NewsArticle[]> {
    let processed = articles
      .filter(article => this.validateArticle(article))
      .map(article => this.enhanceArticle(article));

    // Apply category filtering if specified
    if (options.categories?.length) {
      processed = processed.filter(article => 
        options.categories!.includes(article.category)
      );
    }

    // Apply article limit if specified
    if (options.maxArticles) {
      processed = processed.slice(0, options.maxArticles);
    }

    // Sort by relevance and recency
    processed.sort((a, b) => {
      const scoreA = (a.relevanceScore || 0) * 0.7 + this.getRecencyScore(a) * 0.3;
      const scoreB = (b.relevanceScore || 0) * 0.7 + this.getRecencyScore(b) * 0.3;
      return scoreB - scoreA;
    });

    return processed;
  }

  /**
   * Validate article data quality
   */
  protected validateArticle(article: NewsArticle): boolean {
    return !!(
      article.id &&
      article.title?.length > 10 &&
      article.description?.length > 20 &&
      article.url &&
      article.source?.name &&
      article.publishedAt
    );
  }

  /**
   * Enhance article with additional metadata
   */
  protected enhanceArticle(article: NewsArticle): NewsArticle {
    return {
      ...article,
      id: article.id || this.generateArticleId(article),
      urlToImage: article.urlToImage || imageService.getImageForCategory(article.category),
      tags: article.tags || this.extractTags(`${article.title  } ${  article.description}`),
      relevanceScore: article.relevanceScore || this.calculateRelevanceScore(article),
      source: {
        ...article.source,
        category: article.source.category || article.category,
      },
    };
  }

  /**
   * Extract relevant tags from content
   */
  protected extractTags(content: string): string[] {
    const allKeywords = [
      ...AI_KEYWORDS.PRIMARY,
      ...AI_KEYWORDS.COMPANIES,
      ...AI_KEYWORDS.TECHNOLOGIES,
    ];
    
    const lowerContent = content.toLowerCase();
    return allKeywords
      .filter(keyword => lowerContent.includes(keyword.toLowerCase()))
      .slice(0, 5);
  }

  /**
   * Calculate relevance score for article
   */
  protected calculateRelevanceScore(article: NewsArticle): number {
    const content = `${article.title} ${article.description}`.toLowerCase();
    let score = 0.5; // Base score

    // High-value keywords boost
    AI_KEYWORDS.HIGH_VALUE.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) {
        score += 0.1;
      }
    });

    // AI-specific terms bonus
    if (content.includes('gpt') || content.includes('llm')) {
      score += 0.2;
    }

    // Company mentions bonus
    AI_KEYWORDS.COMPANIES.forEach(company => {
      if (content.includes(company.toLowerCase())) {
        score += 0.15;
      }
    });

    // Recency bonus
    const daysOld = this.getDaysOld(article.publishedAt);
    if (daysOld < 1) score += 0.2;
    else if (daysOld < 7) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate recency score (0-1, higher = more recent)
   */
  protected getRecencyScore(article: NewsArticle): number {
    const daysOld = this.getDaysOld(article.publishedAt);
    return Math.max(0, 1 - (daysOld / 30)); // Linear decay over 30 days
  }

  /**
   * Get days since publication
   */
  protected getDaysOld(publishedAt: string): number {
    const published = new Date(publishedAt);
    const now = new Date();
    return (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
  }

  /**
   * Generate unique article ID
   */
  protected generateArticleId(article: NewsArticle): string {
    const hash = this.simpleHash(article.title + article.url);
    return `${this.id}-${hash}-${Date.now()}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  protected simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Health check implementation (can be overridden)
   */
  protected async checkHealth(): Promise<boolean> {
    // Default health check - can be overridden by subclasses
    return this.config.enabled;
  }

  /**
   * Update internal statistics
   */
  protected updateStats(articleCount: number, duration: number, success: boolean): void {
    if (success) {
      this.stats.successfulRequests++;
      this.stats.totalArticles += articleCount;
    }
    
    // Update average response time (exponential moving average)
    const alpha = 0.2;
    this.stats.averageResponseTime = 
      this.stats.averageResponseTime * (1 - alpha) + duration * alpha;
    
    this.stats.lastActive = new Date();
  }

  /**
   * Clean HTML content
   */
  protected cleanHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Resolve relative URLs to absolute
   */
  protected resolveUrl(url: string, baseUrl: string): string {
    if (!url) return baseUrl;
    if (url.startsWith('http')) return url;
    
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return baseUrl;
    }
  }
}

/**
 * Base class for RSS/Atom feed scrapers
 */
export abstract class BaseRSSScraper extends BaseScraper implements IRSScraper {
  abstract readonly feedUrls: string[];

  override canHandle(url: string): boolean {
    return this.feedUrls.some(feedUrl => url.includes(feedUrl) || feedUrl.includes(url));
  }

  protected override async performScrape(_options: ScrapeOptions): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    for (const feedUrl of this.feedUrls) {
      try {
        const feedArticles = await this.parseFeed(feedUrl);
        articles.push(...feedArticles);
      } catch (error) {
        errorHandler.logError(error as Error, {
          scraperId: this.id,
          feedUrl,
          operation: 'parseFeed',
        });
      }
    }
    
    return articles;
  }

  abstract parseFeed(feedUrl: string): Promise<NewsArticle[]>;

  async validateFeed(feedUrl: string): Promise<boolean> {
    try {
      const response = await axios.head(feedUrl, { timeout: 5000 });
      const contentType = response.headers['content-type']?.toLowerCase() || '';
      return contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom');
    } catch {
      return false;
    }
  }

  protected override async checkHealth(): Promise<boolean> {
    if (!this.config.enabled) return false;
    
    // Check if at least one feed is accessible
    for (const feedUrl of this.feedUrls) {
      if (await this.validateFeed(feedUrl)) {
        return true;
      }
    }
    
    return false;
  }
}

/**
 * Base class for API-based scrapers
 */
export abstract class BaseAPIScraper extends BaseScraper implements IAPIScraper {
  abstract readonly baseUrl: string;
  abstract readonly endpoints: Record<string, string>;
  
  get apiKey(): string | undefined {
    return this.config.apiKey;
  }

  override canHandle(url: string): boolean {
    return url.includes(this.baseUrl);
  }

  protected override async performScrape(options: ScrapeOptions): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    
    // Default implementation - can be overridden
    const endpoint = this.endpoints.articles || this.endpoints.default;
    if (endpoint) {
      const response = await this.apiRequest(endpoint, {
        params: this.buildRequestParams(options),
      });
      articles.push(...this.transformResponse(response));
    }
    
    return articles;
  }

  async apiRequest<T>(endpoint: string, options: APIRequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    const config = {
      method: options.method || 'GET',
      url,
      headers: {
        'User-Agent': this.config.userAgent || 'AI News Aggregator',
        ...this.config.headers,
        ...options.headers,
      } as Record<string, string>,
      params: options.params,
      data: options.body,
      timeout: options.timeout || this.config.timeout,
    };

    // Add API key if available
    if (this.apiKey) {
      config.headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await axios(config);
    return response.data;
  }

  abstract transformResponse(response: any): NewsArticle[];

  protected buildRequestParams(options: ScrapeOptions): Record<string, any> {
    return {
      limit: options.maxArticles || 20,
      category: options.categories?.join(','),
    };
  }

  protected override async checkHealth(): Promise<boolean> {
    if (!this.config.enabled) return false;
    
    try {
      // Try a simple health check endpoint
      const healthEndpoint = this.endpoints.health || this.endpoints.default;
      if (healthEndpoint) {
        await this.apiRequest(healthEndpoint, { method: 'GET' });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Base class for web scraping
 */
export abstract class BaseWebScraper extends BaseScraper implements IWebScraper {
  abstract readonly selectors: SelectorConfig;
  
  get userAgent(): string | undefined {
    return this.config.userAgent;
  }

  override canHandle(url: string): boolean {
    return !!this.config.url && url.includes(this.config.url);
  }

  protected override async performScrape(_options: ScrapeOptions): Promise<NewsArticle[]> {
    if (!this.config.url) {
      throw new Error(`No URL configured for scraper ${this.id}`);
    }
    
    const html = await this.fetchHtml(this.config.url);
    return this.extractContent(html, this.config.url);
  }

  abstract extractContent(html: string, url: string): NewsArticle[];

  async handleSPA(url: string): Promise<string> {
    // Default implementation - can be overridden for SPA handling
    return this.fetchHtml(url);
  }

  protected async fetchHtml(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.userAgent || 'Mozilla/5.0 (compatible; AI News Aggregator)',
        ...this.config.headers,
      },
      timeout: this.config.timeout,
    });
    
    return response.data;
  }

  protected override async checkHealth(): Promise<boolean> {
    if (!this.config.enabled || !this.config.url) return false;
    
    try {
      await axios.head(this.config.url, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}