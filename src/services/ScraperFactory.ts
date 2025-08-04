/**
 * Factory and Manager classes for the scraper dependency injection system
 * Provides centralized creation and management of news scrapers
 */

import type {
  INewsScraper,
  IScraperFactory,
  IScraperManager,
  ScraperType,
  ScraperConfig,
  ScrapeOptions,
  ScrapingResult,
  HealthCheckResult,
  ScrapingStats,
  ScrapingError,
  ScraperEvent,
} from '../interfaces/INewsScaper';

// Import scraper implementations
import { NewsAPIScraper, HackerNewsScraper, GenericAPIScraper, createNewsAPIScraper, createHackerNewsScraper, API_SCRAPER_CONFIGS } from '../strategies/APIScraper';
import { RSSScraper, createRSSScraper, RSS_SCRAPER_CONFIGS } from '../strategies/RSScraper';
import { WebScraper, TechCrunchScraper, TheVergeScraper, createWebScraper, createTechCrunchScraper, createTheVergeScraper, WEB_SCRAPER_CONFIGS } from '../strategies/WebScraper';
import type { NewsArticle, NewsCategory } from '../types/news';
import { errorHandler } from '../utils/errorHandler';
import { throttledRequest } from '../utils/requestQueue';

/**
 * Factory class for creating scrapers using dependency injection
 */
export class ScraperFactory implements IScraperFactory {
  private scraperRegistry = new Map<ScraperType, new (config: ScraperConfig) => INewsScraper>();

  constructor() {
    // Register default scraper types
    this.scraperRegistry.set('rss', RSSScraper);
    this.scraperRegistry.set('api', NewsAPIScraper);
    this.scraperRegistry.set('web', WebScraper);
  }

  createScraper(type: ScraperType, config: ScraperConfig): INewsScraper {
    const ScraperClass = this.scraperRegistry.get(type);
    
    if (!ScraperClass) {
      throw new Error(`Unknown scraper type: ${type}`);
    }

    return new ScraperClass(config);
  }

  registerScraper(type: ScraperType, scraperClass: new (config: ScraperConfig) => INewsScraper): void {
    this.scraperRegistry.set(type, scraperClass);
  }

  getAvailableTypes(): ScraperType[] {
    return Array.from(this.scraperRegistry.keys());
  }

  findScraper(url: string): INewsScraper | null {
    // Try to find a scraper that can handle this URL
    const allConfigs = [...RSS_SCRAPER_CONFIGS, ...API_SCRAPER_CONFIGS, ...WEB_SCRAPER_CONFIGS];
    
    for (const config of allConfigs) {
      const scraper = this.createScraper(config.type, config);
      if (scraper.canHandle(url)) {
        return scraper;
      }
    }

    return null;
  }

  // Convenience methods for creating specific scrapers
  createRSSScraper(config: ScraperConfig): RSSScraper {
    return createRSSScraper(config);
  }

  createNewsAPIScraper(config?: Partial<ScraperConfig>): NewsAPIScraper {
    return createNewsAPIScraper(config);
  }

  createHackerNewsScraper(config?: Partial<ScraperConfig>): HackerNewsScraper {
    return createHackerNewsScraper(config);
  }

  createWebScraper(config: ScraperConfig): WebScraper {
    return createWebScraper(config);
  }

  createTechCrunchScraper(config?: Partial<ScraperConfig>): TechCrunchScraper {
    return createTechCrunchScraper(config);
  }

  createTheVergeScraper(config?: Partial<ScraperConfig>): TheVergeScraper {
    return createTheVergeScraper(config);
  }

  // Bulk creation methods
  createAllDefaultScrapers(): INewsScraper[] {
    const scrapers: INewsScraper[] = [];

    // Create RSS scrapers
    RSS_SCRAPER_CONFIGS.forEach(config => {
      try {
        scrapers.push(this.createRSSScraper(config));
      } catch (error) {
        console.warn(`Failed to create RSS scraper ${config.id}:`, error);
      }
    });

    // Create API scrapers
    API_SCRAPER_CONFIGS.forEach(config => {
      try {
        scrapers.push(this.createScraper('api', config));
      } catch (error) {
        console.warn(`Failed to create API scraper ${config.id}:`, error);
      }
    });

    // Create web scrapers
    WEB_SCRAPER_CONFIGS.forEach(config => {
      try {
        scrapers.push(this.createWebScraper(config));
      } catch (error) {
        console.warn(`Failed to create web scraper ${config.id}:`, error);
      }
    });

    return scrapers;
  }
}

/**
 * Manager class for coordinating multiple scrapers
 */
export class ScraperManager implements IScraperManager {
  private scrapers = new Map<string, INewsScraper>();
  private eventListeners: ((event: ScraperEvent) => void)[] = [];
  private stats: ScrapingStats = {
    totalScrapers: 0,
    activeScrapers: 0,
    totalArticlesScraped: 0,
    averageResponseTime: 0,
    successRate: 0,
    lastUpdated: new Date(),
    scraperStats: {},
  };

  constructor(private factory: ScraperFactory) {}

  register(scraper: INewsScraper): void {
    this.scrapers.set(scraper.id, scraper);
    this.updateStats();
    
    this.emitEvent({
      type: 'health_check',
      scraperId: scraper.id,
      timestamp: new Date(),
      status: {
        healthy: true,
        status: 'active',
        responseTime: 0,
        lastChecked: new Date(),
      },
    });
  }

  unregister(scraperId: string): void {
    this.scrapers.delete(scraperId);
    this.updateStats();
  }

  getScrapersByCategory(category: NewsCategory): INewsScraper[] {
    return Array.from(this.scrapers.values()).filter(scraper =>
      scraper.categories.includes(category)
    );
  }

  getAllScrapers(): INewsScraper[] {
    return Array.from(this.scrapers.values());
  }

  getActiveScraper(): INewsScraper[] {
    return Array.from(this.scrapers.values()).filter(scraper =>
      scraper.getConfig().enabled
    );
  }

  async scrapeAll(options: ScrapeOptions = {}): Promise<ScrapingResult> {
    const startTime = performance.now();
    const results: ScrapingResult = {
      articles: [],
      sources: [],
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      duration: 0,
      errors: [],
    };

    const activeScrapers = this.getActiveScraper();
    
    // Filter scrapers by category if specified
    const targetScrapers = options.categories?.length
      ? activeScrapers.filter(scraper =>
          scraper.categories.some(cat => options.categories!.includes(cat))
        )
      : activeScrapers;

    // Sort by priority (higher priority first)
    targetScrapers.sort((a, b) => b.priority - a.priority);

    // Execute scraping with proper concurrency control
    const promises = targetScrapers.map(scraper => this.scrapeSingle(scraper, options));
    
    if (options.parallel !== false) {
      // Parallel execution with proper throttling
      const settled = await Promise.allSettled(promises);
      
      settled.forEach((result, index) => {
        const scraper = targetScrapers[index];
        results.totalProcessed++;
        
        if (result.status === 'fulfilled') {
          results.articles.push(...result.value);
          results.sources.push(scraper.name);
          results.successCount++;
          
          this.updateScraperStats(scraper.id, result.value.length, true);
        } else {
          results.errorCount++;
          results.errors.push({
            scraperId: scraper.id,
            error: errorHandler.classifyError(result.reason),
            timestamp: new Date(),
            retryCount: 0,
          });
          
          this.updateScraperStats(scraper.id, 0, false);
        }
      });
    } else {
      // Sequential execution
      for (const scraper of targetScrapers) {
        try {
          const articles = await this.scrapeSingle(scraper, options);
          results.articles.push(...articles);
          results.sources.push(scraper.name);
          results.successCount++;
          results.totalProcessed++;
          
          this.updateScraperStats(scraper.id, articles.length, true);
        } catch (error) {
          results.errorCount++;
          results.totalProcessed++;
          results.errors.push({
            scraperId: scraper.id,
            error: errorHandler.classifyError(error as Error),
            timestamp: new Date(),
            retryCount: 0,
          });
          
          this.updateScraperStats(scraper.id, 0, false);
        }
      }
    }

    // Remove duplicates and sort by relevance
    results.articles = this.deduplicateArticles(results.articles);
    results.articles.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Apply global article limit
    if (options.maxArticles) {
      results.articles = results.articles.slice(0, options.maxArticles);
    }

    results.duration = performance.now() - startTime;
    this.updateStats();

    this.emitEvent({
      type: 'scraping_completed',
      scraperId: 'manager',
      timestamp: new Date(),
      result: results,
    });

    return results;
  }

  private async scrapeSingle(scraper: INewsScraper, options: ScrapeOptions): Promise<NewsArticle[]> {
    this.emitEvent({
      type: 'scraping_started',
      scraperId: scraper.id,
      timestamp: new Date(),
      options,
    });

    try {
      const articles = await throttledRequest(
        () => scraper.scrape(options),
        scraper.priority,
        { scraperId: scraper.id, operation: 'scrape' }
      );

      return articles;
    } catch (error) {
      this.emitEvent({
        type: 'scraping_error',
        scraperId: scraper.id,
        timestamp: new Date(),
        error: errorHandler.classifyError(error as Error),
        retryCount: 0,
      });

      throw error;
    }
  }

  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const key = `${article.title}-${article.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async healthCheckAll(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const scrapers = this.getAllScrapers();

    const promises = scrapers.map(async scraper => {
      try {
        const status = await scraper.healthCheck();
        const result: HealthCheckResult = {
          scraperId: scraper.id,
          status,
          timestamp: new Date(),
        };

        this.emitEvent({
          type: 'health_check',
          scraperId: scraper.id,
          timestamp: new Date(),
          status,
        });

        return result;
      } catch (error) {
        const result: HealthCheckResult = {
          scraperId: scraper.id,
          status: {
            healthy: false,
            status: 'down',
            responseTime: 0,
            lastChecked: new Date(),
            errors: [errorHandler.classifyError(error as Error)],
          },
          timestamp: new Date(),
        };

        return result;
      }
    });

    const settled = await Promise.allSettled(promises);
    settled.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });

    return results;
  }

  getStats(): ScrapingStats {
    return { ...this.stats };
  }

  private updateStats(): void {
    const activeScrapers = this.getActiveScraper();
    this.stats.totalScrapers = this.scrapers.size;
    this.stats.activeScrapers = activeScrapers.length;
    this.stats.lastUpdated = new Date();
  }

  private updateScraperStats(scraperId: string, articleCount: number, success: boolean): void {
    if (!this.stats.scraperStats[scraperId]) {
      this.stats.scraperStats[scraperId] = {
        articlesScraped: 0,
        successRate: 0,
        averageResponseTime: 0,
        lastActive: new Date(),
      };
    }

    const scraperStats = this.stats.scraperStats[scraperId];
    scraperStats.articlesScraped += articleCount;
    scraperStats.lastActive = new Date();
    
    // Update success rate (exponential moving average)
    const alpha = 0.1;
    const newSuccessRate = success ? 1 : 0;
    scraperStats.successRate = scraperStats.successRate * (1 - alpha) + newSuccessRate * alpha;
  }

  // Event system
  addEventListener(listener: (event: ScraperEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: ScraperEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: ScraperEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in scraper event listener:', error);
      }
    });
  }

  // Bulk operations
  async registerAllDefaultScrapers(): Promise<void> {
    const scrapers = this.factory.createAllDefaultScrapers();
    scrapers.forEach(scraper => this.register(scraper));
  }

  async refreshAllScrapers(): Promise<void> {
    const healthResults = await this.healthCheckAll();
    
    // Disable unhealthy scrapers
    healthResults.forEach(result => {
      if (!result.status.healthy) {
        const scraper = this.scrapers.get(result.scraperId);
        if (scraper) {
          // Mark as temporarily disabled
          console.warn(`Disabling unhealthy scraper: ${result.scraperId}`);
        }
      }
    });
  }
}

// Singleton instances
export const scraperFactory = new ScraperFactory();
export const scraperManager = new ScraperManager(scraperFactory);

// Initialize with default scrapers
scraperManager.registerAllDefaultScrapers();

// Export types
export type { ScrapingResult, HealthCheckResult, ScrapingStats, ScraperEvent };