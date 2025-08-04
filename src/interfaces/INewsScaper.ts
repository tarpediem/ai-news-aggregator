/**
 * Core interfaces for the news scraping architecture
 * Defines contracts for different scraping strategies and implementations
 */

import type { NewsArticle, NewsCategory } from '../types/news';
import type { ErrorDetail } from '../utils/errorHandler';

/**
 * Core scraper interface that all news scrapers must implement
 */
export interface INewsScraper {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly categories: NewsCategory[];
  readonly rateLimitMs: number;
  readonly maxRetries: number;

  /**
   * Scrape news articles from the source
   */
  scrape(options?: ScrapeOptions): Promise<NewsArticle[]>;

  /**
   * Validate if the scraper can handle a specific source
   */
  canHandle(url: string): boolean;

  /**
   * Health check for the scraper
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get scraper configuration
   */
  getConfig(): ScraperConfig;
}

/**
 * Specialized interface for RSS-based scrapers
 */
export interface IRSScraper extends INewsScraper {
  readonly feedUrls: string[];
  
  /**
   * Parse RSS/Atom feed
   */
  parseFeed(feedUrl: string): Promise<NewsArticle[]>;
  
  /**
   * Validate RSS feed
   */
  validateFeed(feedUrl: string): Promise<boolean>;
}

/**
 * Specialized interface for API-based scrapers
 */
export interface IAPIScraper extends INewsScraper {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly endpoints: Record<string, string>;
  
  /**
   * Make authenticated API request
   */
  apiRequest<T>(endpoint: string, options?: APIRequestOptions): Promise<T>;
  
  /**
   * Transform API response to NewsArticle format
   */
  transformResponse(response: any): NewsArticle[];
}

/**
 * Specialized interface for web scraping
 */
export interface IWebScraper extends INewsScraper {
  readonly selectors: SelectorConfig;
  readonly userAgent?: string;
  
  /**
   * Extract content using CSS selectors
   */
  extractContent(html: string, url: string): NewsArticle[];
  
  /**
   * Handle JavaScript-rendered content
   */
  handleSPA(url: string): Promise<string>;
}

/**
 * Factory interface for creating scrapers
 */
export interface IScraperFactory {
  /**
   * Create a scraper by type
   */
  createScraper(type: ScraperType, config: ScraperConfig): INewsScraper;
  
  /**
   * Register a new scraper type
   */
  registerScraper(type: ScraperType, scraperClass: new (config: ScraperConfig) => INewsScraper): void;
  
  /**
   * Get all available scraper types
   */
  getAvailableTypes(): ScraperType[];
  
  /**
   * Find best scraper for a URL
   */
  findScraper(url: string): INewsScraper | null;
}

/**
 * Service interface for managing all scrapers
 */
export interface IScraperManager {
  /**
   * Register a scraper
   */
  register(scraper: INewsScraper): void;
  
  /**
   * Get scrapers by category
   */
  getScrapersByCategory(category: NewsCategory): INewsScraper[];
  
  /**
   * Get all active scrapers
   */
  getAllScrapers(): INewsScraper[];
  
  /**
   * Execute scraping with load balancing
   */
  scrapeAll(options?: ScrapeOptions): Promise<ScrapingResult>;
  
  /**
   * Execute health checks on all scrapers
   */
  healthCheckAll(): Promise<HealthCheckResult[]>;
  
  /**
   * Get scraping statistics
   */
  getStats(): ScrapingStats;
}

// Supporting types and interfaces

export type ScraperType = 'rss' | 'api' | 'web' | 'hybrid';

export interface ScrapeOptions {
  categories?: NewsCategory[];
  maxArticles?: number;
  timeout?: number;
  forceRefresh?: boolean;
  parallel?: boolean;
  priority?: 'speed' | 'quality' | 'balanced';
}

export interface ScraperConfig {
  id: string;
  name: string;
  type: ScraperType;
  priority: number;
  categories: NewsCategory[];
  url?: string;
  feedUrls?: string[];
  apiKey?: string;
  baseUrl?: string;
  endpoints?: Record<string, string>;
  selectors?: SelectorConfig;
  rateLimitMs: number;
  maxRetries: number;
  timeout: number;
  userAgent?: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

export interface SelectorConfig {
  container: string;
  title: string;
  description: string;
  link: string;
  image?: string;
  author?: string;
  publishedAt?: string;
  category?: string;
}

export interface APIRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  timeout?: number;
}

export interface HealthStatus {
  healthy: boolean;
  status: 'active' | 'degraded' | 'down' | 'maintenance';
  responseTime: number;
  lastChecked: Date;
  errors?: ErrorDetail[];
  metadata?: Record<string, any>;
}

export interface ScrapingResult {
  articles: NewsArticle[];
  sources: string[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  duration: number;
  errors: ScrapingError[];
}

export interface ScrapingError {
  scraperId: string;
  error: ErrorDetail;
  timestamp: Date;
  retryCount: number;
}

export interface HealthCheckResult {
  scraperId: string;
  status: HealthStatus;
  timestamp: Date;
}

export interface ScrapingStats {
  totalScrapers: number;
  activeScrapers: number;
  totalArticlesScraped: number;
  averageResponseTime: number;
  successRate: number;
  lastUpdated: Date;
  scraperStats: Record<string, {
    articlesScraped: number;
    successRate: number;
    averageResponseTime: number;
    lastActive: Date;
  }>;
}

/**
 * Event interfaces for scraper lifecycle events
 */
export interface ScraperEventData {
  scraperId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ScrapingStartedEvent extends ScraperEventData {
  type: 'scraping_started';
  options: ScrapeOptions;
}

export interface ScrapingCompletedEvent extends ScraperEventData {
  type: 'scraping_completed';
  result: ScrapingResult;
}

export interface ScrapingErrorEvent extends ScraperEventData {
  type: 'scraping_error';
  error: ErrorDetail;
  retryCount: number;
}

export interface HealthCheckEvent extends ScraperEventData {
  type: 'health_check';
  status: HealthStatus;
}

export type ScraperEvent = 
  | ScrapingStartedEvent 
  | ScrapingCompletedEvent 
  | ScrapingErrorEvent 
  | HealthCheckEvent;