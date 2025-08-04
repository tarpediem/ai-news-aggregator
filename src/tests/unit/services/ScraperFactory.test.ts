/**
 * Unit tests for ScraperFactory and ScraperManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScraperFactory, ScraperManager } from '../../../services/ScraperFactory';
import { RSSScraper } from '../../../strategies/RSScraper';
import { NewsAPIScraper } from '../../../strategies/APIScraper';
import { WebScraper } from '../../../strategies/WebScraper';
import { createMockScraperConfig, createMockNewsArticle } from '../../setup';
import type { NewsArticle, ScrapeOptions } from '../../../interfaces/INewsScaper';

// Mock the actual scrapers to avoid external dependencies
vi.mock('../../../strategies/RSScraper', () => ({
  RSSScraper: vi.fn(),
  createRSSScraper: vi.fn(),
  RSS_SCRAPER_CONFIGS: [],
}));

vi.mock('../../../strategies/APIScraper', () => ({
  NewsAPIScraper: vi.fn(),
  HackerNewsScraper: vi.fn(),
  GenericAPIScraper: vi.fn(),
  createNewsAPIScraper: vi.fn(),
  createHackerNewsScraper: vi.fn(),
  API_SCRAPER_CONFIGS: [],
}));

vi.mock('../../../strategies/WebScraper', () => ({
  WebScraper: vi.fn(),
  TechCrunchScraper: vi.fn(),
  TheVergeScraper: vi.fn(),
  createWebScraper: vi.fn(),
  createTechCrunchScraper: vi.fn(),
  createTheVergeScraper: vi.fn(),
  WEB_SCRAPER_CONFIGS: [],
}));

// Create a mock scraper class for testing
class MockScraper {
  constructor(public config: any) {}
  
  get id() { return this.config.id; }
  get name() { return this.config.name; }
  get priority() { return this.config.priority; }
  get categories() { return this.config.categories; }
  get rateLimitMs() { return this.config.rateLimitMs; }
  get maxRetries() { return this.config.maxRetries; }
  
  canHandle(url: string): boolean {
    return url.includes(this.config.id);
  }
  
  async scrape(options: ScrapeOptions = {}): Promise<NewsArticle[]> {
    return [createMockNewsArticle({ id: `${this.config.id}-article` })];
  }
  
  async healthCheck() {
    return {
      healthy: true,
      status: 'active' as const,
      responseTime: 100,
      lastChecked: new Date(),
    };
  }
  
  getConfig() {
    return this.config;
  }
}

describe('ScraperFactory', () => {
  let factory: ScraperFactory;

  beforeEach(() => {
    factory = new ScraperFactory();
    
    // Mock the scraper classes
    vi.mocked(RSSScraper).mockImplementation((config) => new MockScraper(config) as any);
    vi.mocked(NewsAPIScraper).mockImplementation((config) => new MockScraper(config) as any);
    vi.mocked(WebScraper).mockImplementation((config) => new MockScraper(config) as any);
  });

  describe('createScraper', () => {
    it('should create RSS scraper', () => {
      const config = createMockScraperConfig({ type: 'rss' });
      const scraper = factory.createScraper('rss', config);
      
      expect(scraper).toBeInstanceOf(MockScraper);
      expect(scraper.id).toBe('test-scraper');
    });

    it('should create API scraper', () => {
      const config = createMockScraperConfig({ type: 'api' });
      const scraper = factory.createScraper('api', config);
      
      expect(scraper).toBeInstanceOf(MockScraper);
      expect(scraper.id).toBe('test-scraper');
    });

    it('should create web scraper', () => {
      const config = createMockScraperConfig({ type: 'web' });
      const scraper = factory.createScraper('web', config);
      
      expect(scraper).toBeInstanceOf(MockScraper);
      expect(scraper.id).toBe('test-scraper');
    });

    it('should throw error for unknown scraper type', () => {
      const config = createMockScraperConfig();
      
      expect(() => factory.createScraper('unknown' as any, config))
        .toThrow('Unknown scraper type: unknown');
    });
  });

  describe('registerScraper', () => {
    it('should register new scraper type', () => {
      factory.registerScraper('hybrid', MockScraper as any);
      
      const config = createMockScraperConfig({ type: 'hybrid' });
      const scraper = factory.createScraper('hybrid', config);
      
      expect(scraper).toBeInstanceOf(MockScraper);
    });
  });

  describe('getAvailableTypes', () => {
    it('should return available scraper types', () => {
      const types = factory.getAvailableTypes();
      
      expect(types).toContain('rss');
      expect(types).toContain('api');
      expect(types).toContain('web');
    });
  });

  describe('findScraper', () => {
    it('should find scraper for URL', () => {
      const scraper = factory.findScraper('https://test-scraper.com/article');
      
      expect(scraper).toBeTruthy();
      expect(scraper?.id).toBe('test-scraper');
    });

    it('should return null for unknown URL', () => {
      const scraper = factory.findScraper('https://unknown.com/article');
      
      expect(scraper).toBeNull();
    });
  });
});

describe('ScraperManager', () => {
  let factory: ScraperFactory;
  let manager: ScraperManager;
  let mockScraper: MockScraper;

  beforeEach(() => {
    factory = new ScraperFactory();
    manager = new ScraperManager(factory);
    
    // Mock the scraper classes
    vi.mocked(RSSScraper).mockImplementation((config) => new MockScraper(config) as any);
    vi.mocked(NewsAPIScraper).mockImplementation((config) => new MockScraper(config) as any);
    vi.mocked(WebScraper).mockImplementation((config) => new MockScraper(config) as any);
    
    mockScraper = new MockScraper(createMockScraperConfig());
  });

  describe('register', () => {
    it('should register scraper', () => {
      manager.register(mockScraper as any);
      
      const scrapers = manager.getAllScrapers();
      expect(scrapers).toContain(mockScraper);
    });

    it('should update stats when registering', () => {
      manager.register(mockScraper as any);
      
      const stats = manager.getStats();
      expect(stats.totalScrapers).toBe(1);
      expect(stats.activeScrapers).toBe(1);
    });
  });

  describe('getScrapersByCategory', () => {
    it('should return scrapers by category', () => {
      const aiScraper = new MockScraper(createMockScraperConfig({ 
        id: 'ai-scraper', 
        categories: ['artificial-intelligence'] 
      }));
      const techScraper = new MockScraper(createMockScraperConfig({ 
        id: 'tech-scraper', 
        categories: ['tech-news'] 
      }));

      manager.register(aiScraper as any);
      manager.register(techScraper as any);

      const aiScrapers = manager.getScrapersByCategory('artificial-intelligence');
      const techScrapers = manager.getScrapersByCategory('tech-news');

      expect(aiScrapers).toHaveLength(1);
      expect(aiScrapers[0].id).toBe('ai-scraper');
      expect(techScrapers).toHaveLength(1);
      expect(techScrapers[0].id).toBe('tech-scraper');
    });
  });

  describe('scrapeAll', () => {
    it('should scrape all active scrapers', async () => {
      const scraper1 = new MockScraper(createMockScraperConfig({ id: 'scraper1' }));
      const scraper2 = new MockScraper(createMockScraperConfig({ id: 'scraper2' }));

      manager.register(scraper1 as any);
      manager.register(scraper2 as any);

      const result = await manager.scrapeAll();

      expect(result.articles).toHaveLength(2);
      expect(result.sources).toHaveLength(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle scraping errors', async () => {
      const workingScraper = new MockScraper(createMockScraperConfig({ id: 'working' }));
      const failingScraper = new MockScraper(createMockScraperConfig({ id: 'failing' }));
      
      // Mock the failing scraper to throw an error
      vi.spyOn(failingScraper, 'scrape').mockRejectedValue(new Error('Scraping failed'));

      manager.register(workingScraper as any);
      manager.register(failingScraper as any);

      const result = await manager.scrapeAll();

      expect(result.articles).toHaveLength(1);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scraperId).toBe('failing');
    });

    it('should filter by categories', async () => {
      const aiScraper = new MockScraper(createMockScraperConfig({ 
        id: 'ai-scraper', 
        categories: ['artificial-intelligence'] 
      }));
      const techScraper = new MockScraper(createMockScraperConfig({ 
        id: 'tech-scraper', 
        categories: ['tech-news'] 
      }));

      manager.register(aiScraper as any);
      manager.register(techScraper as any);

      const result = await manager.scrapeAll({ categories: ['artificial-intelligence'] });

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].id).toBe('ai-scraper-article');
    });

    it('should apply article limit', async () => {
      const scraper1 = new MockScraper(createMockScraperConfig({ id: 'scraper1' }));
      const scraper2 = new MockScraper(createMockScraperConfig({ id: 'scraper2' }));
      const scraper3 = new MockScraper(createMockScraperConfig({ id: 'scraper3' }));

      manager.register(scraper1 as any);
      manager.register(scraper2 as any);
      manager.register(scraper3 as any);

      const result = await manager.scrapeAll({ maxArticles: 2 });

      expect(result.articles).toHaveLength(2);
    });

    it('should deduplicate articles', async () => {
      const scraper1 = new MockScraper(createMockScraperConfig({ id: 'scraper1' }));
      const scraper2 = new MockScraper(createMockScraperConfig({ id: 'scraper2' }));

      // Make both scrapers return the same article
      const duplicateArticle = createMockNewsArticle({ 
        title: 'Duplicate Article',
        url: 'https://example.com/duplicate'
      });

      vi.spyOn(scraper1, 'scrape').mockResolvedValue([duplicateArticle]);
      vi.spyOn(scraper2, 'scrape').mockResolvedValue([duplicateArticle]);

      manager.register(scraper1 as any);
      manager.register(scraper2 as any);

      const result = await manager.scrapeAll();

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe('Duplicate Article');
    });
  });

  describe('healthCheckAll', () => {
    it('should check health of all scrapers', async () => {
      const scraper1 = new MockScraper(createMockScraperConfig({ id: 'scraper1' }));
      const scraper2 = new MockScraper(createMockScraperConfig({ id: 'scraper2' }));

      manager.register(scraper1 as any);
      manager.register(scraper2 as any);

      const results = await manager.healthCheckAll();

      expect(results).toHaveLength(2);
      expect(results[0].status.healthy).toBe(true);
      expect(results[1].status.healthy).toBe(true);
    });

    it('should handle health check errors', async () => {
      const workingScraper = new MockScraper(createMockScraperConfig({ id: 'working' }));
      const failingScraper = new MockScraper(createMockScraperConfig({ id: 'failing' }));

      vi.spyOn(failingScraper, 'healthCheck').mockRejectedValue(new Error('Health check failed'));

      manager.register(workingScraper as any);
      manager.register(failingScraper as any);

      const results = await manager.healthCheckAll();

      expect(results).toHaveLength(2);
      expect(results.find(r => r.scraperId === 'working')?.status.healthy).toBe(true);
      expect(results.find(r => r.scraperId === 'failing')?.status.healthy).toBe(false);
    });
  });

  describe('event system', () => {
    it('should emit scraping events', async () => {
      const eventListener = vi.fn();
      manager.addEventListener(eventListener);

      const scraper = new MockScraper(createMockScraperConfig({ id: 'test-scraper' }));
      manager.register(scraper as any);

      await manager.scrapeAll();

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scraping_started',
          scraperId: 'test-scraper'
        })
      );

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scraping_completed',
          scraperId: 'manager'
        })
      );
    });

    it('should emit health check events', async () => {
      const eventListener = vi.fn();
      manager.addEventListener(eventListener);

      const scraper = new MockScraper(createMockScraperConfig({ id: 'test-scraper' }));
      manager.register(scraper as any);

      await manager.healthCheckAll();

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health_check',
          scraperId: 'test-scraper'
        })
      );
    });

    it('should remove event listeners', async () => {
      const eventListener = vi.fn();
      manager.addEventListener(eventListener);
      manager.removeEventListener(eventListener);

      const scraper = new MockScraper(createMockScraperConfig({ id: 'test-scraper' }));
      manager.register(scraper as any);

      await manager.scrapeAll();

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track scraping statistics', () => {
      const scraper1 = new MockScraper(createMockScraperConfig({ id: 'scraper1' }));
      const scraper2 = new MockScraper(createMockScraperConfig({ id: 'scraper2', enabled: false }));

      manager.register(scraper1 as any);
      manager.register(scraper2 as any);

      const stats = manager.getStats();

      expect(stats.totalScrapers).toBe(2);
      expect(stats.activeScrapers).toBe(1);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });
  });
});