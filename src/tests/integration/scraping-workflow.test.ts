/**
 * Integration tests for the complete scraping workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ScraperFactory, ScraperManager } from '../../services/ScraperFactory';
import { RSSScraper } from '../../strategies/RSScraper';
import { NewsAPIScraper } from '../../strategies/APIScraper';
import { WebScraper } from '../../strategies/WebScraper';
import { mockApiResponses, createMockScraperConfig } from '../setup';
import type { ScraperConfig } from '../../interfaces/INewsScaper';

// Mock axios
const mockedAxios = vi.mocked(axios);

describe('Scraping Workflow Integration', () => {
  let factory: ScraperFactory;
  let manager: ScraperManager;

  beforeEach(() => {
    factory = new ScraperFactory();
    manager = new ScraperManager(factory);
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('RSS Scraping Workflow', () => {
    it('should scrape RSS feed successfully', async () => {
      // Mock RSS feed response
      mockedAxios.get.mockResolvedValue({
        data: { contents: mockApiResponses.rssResponse }
      });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'rss',
          feedUrls: ['https://example.com/rss.xml']
        })
      };

      const scraper = factory.createScraper('rss', config);
      const articles = await scraper.scrape();

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('AI News Article');
      expect(articles[0].source.name).toBe('Test Scraper');
      expect(articles[0].category).toBe('artificial-intelligence');
    });

    it('should handle RSS feed errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'rss',
          feedUrls: ['https://example.com/rss.xml']
        })
      };

      const scraper = factory.createScraper('rss', config);
      
      await expect(scraper.scrape()).rejects.toThrow();
    });

    it('should parse multiple RSS feeds', async () => {
      // Mock multiple RSS responses
      mockedAxios.get
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } })
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'rss',
          feedUrls: [
            'https://example.com/feed1.xml',
            'https://example.com/feed2.xml'
          ]
        })
      };

      const scraper = factory.createScraper('rss', config);
      const articles = await scraper.scrape();

      expect(articles).toHaveLength(2);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('API Scraping Workflow', () => {
    it('should scrape NewsAPI successfully', async () => {
      mockedAxios.mockResolvedValue({
        data: mockApiResponses.newsApi
      });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'api',
          apiKey: 'test-api-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const scraper = factory.createScraper('api', config);
      const articles = await scraper.scrape();

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('AI News Article');
      expect(articles[0].source.name).toBe('Test Source');
    });

    it('should handle API rate limiting', async () => {
      mockedAxios.mockRejectedValue({
        response: { status: 429, data: { message: 'Rate limit exceeded' } }
      });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'api',
          apiKey: 'test-api-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const scraper = factory.createScraper('api', config);
      
      await expect(scraper.scrape()).rejects.toThrow();
    });

    it('should handle invalid API key', async () => {
      mockedAxios.mockRejectedValue({
        response: { status: 401, data: { message: 'Invalid API key' } }
      });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'api',
          apiKey: 'invalid-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const scraper = factory.createScraper('api', config);
      
      await expect(scraper.scrape()).rejects.toThrow();
    });
  });

  describe('Web Scraping Workflow', () => {
    it('should scrape web page successfully', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="article">
              <h2 class="title">AI News Article</h2>
              <p class="description">This is about artificial intelligence</p>
              <a href="/article" class="link">Read more</a>
              <img src="/image.jpg" class="image">
              <span class="author">Test Author</span>
              <time class="date">2024-01-01</time>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: { contents: mockHtml }
      });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'web',
          url: 'https://example.com',
          selectors: {
            container: '.article',
            title: '.title',
            description: '.description',
            link: '.link',
            image: '.image',
            author: '.author',
            publishedAt: '.date'
          }
        })
      };

      const scraper = factory.createScraper('web', config);
      const articles = await scraper.scrape();

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('AI News Article');
      expect(articles[0].description).toBe('This is about artificial intelligence');
      expect(articles[0].author).toBe('Test Author');
    });

    it('should handle missing selectors gracefully', async () => {
      const mockHtml = '<html><body><p>No matching selectors</p></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: { contents: mockHtml }
      });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          type: 'web',
          url: 'https://example.com',
          selectors: {
            container: '.article',
            title: '.title',
            description: '.description',
            link: '.link'
          }
        })
      };

      const scraper = factory.createScraper('web', config);
      const articles = await scraper.scrape();

      expect(articles).toHaveLength(0);
    });
  });

  describe('Multi-Scraper Workflow', () => {
    it('should orchestrate multiple scrapers', async () => {
      // Mock responses for different scraper types
      mockedAxios.get
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } })
        .mockResolvedValueOnce({ data: mockApiResponses.newsApi });

      // Register multiple scrapers
      const rssConfig: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'rss-scraper',
          type: 'rss',
          feedUrls: ['https://example.com/rss.xml']
        })
      };

      const apiConfig: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'api-scraper',
          type: 'api',
          apiKey: 'test-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const rssScraper = factory.createScraper('rss', rssConfig);
      const apiScraper = factory.createScraper('api', apiConfig);

      manager.register(rssScraper);
      manager.register(apiScraper);

      const result = await manager.scrapeAll();

      expect(result.articles).toHaveLength(2);
      expect(result.sources).toHaveLength(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Mock one success and one failure
      mockedAxios.get
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } })
        .mockRejectedValueOnce(new Error('API failure'));

      const rssConfig: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'rss-scraper',
          type: 'rss',
          feedUrls: ['https://example.com/rss.xml']
        })
      };

      const apiConfig: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'api-scraper',
          type: 'api',
          apiKey: 'test-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const rssScraper = factory.createScraper('rss', rssConfig);
      const apiScraper = factory.createScraper('api', apiConfig);

      manager.register(rssScraper);
      manager.register(apiScraper);

      const result = await manager.scrapeAll();

      expect(result.articles).toHaveLength(1);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scraperId).toBe('api-scraper');
    });

    it('should filter articles by category across scrapers', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } })
        .mockResolvedValueOnce({ data: mockApiResponses.newsApi });

      const aiConfig: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'ai-scraper',
          type: 'rss',
          categories: ['artificial-intelligence'],
          feedUrls: ['https://example.com/ai.xml']
        })
      };

      const techConfig: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'tech-scraper',
          type: 'api',
          categories: ['tech-news'],
          apiKey: 'test-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const aiScraper = factory.createScraper('rss', aiConfig);
      const techScraper = factory.createScraper('api', techConfig);

      manager.register(aiScraper);
      manager.register(techScraper);

      const result = await manager.scrapeAll({ categories: ['artificial-intelligence'] });

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].category).toBe('artificial-intelligence');
    });

    it('should respect article limits across scrapers', async () => {
      // Mock responses that return multiple articles
      const multipleArticlesResponse = {
        articles: [
          { ...mockApiResponses.newsApi.articles[0], title: 'Article 1' },
          { ...mockApiResponses.newsApi.articles[0], title: 'Article 2' },
          { ...mockApiResponses.newsApi.articles[0], title: 'Article 3' }
        ]
      };

      mockedAxios.get.mockResolvedValue({ data: multipleArticlesResponse });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'test-scraper',
          type: 'api',
          apiKey: 'test-key',
          baseUrl: 'https://newsapi.org/v2'
        })
      };

      const scraper = factory.createScraper('api', config);
      manager.register(scraper);

      const result = await manager.scrapeAll({ maxArticles: 2 });

      expect(result.articles).toHaveLength(2);
    });
  });

  describe('Health Check Workflow', () => {
    it('should perform health checks on all scrapers', async () => {
      // Mock successful health check responses
      mockedAxios.head.mockResolvedValue({ status: 200 });
      mockedAxios.get.mockResolvedValue({ data: { contents: mockApiResponses.rssResponse } });

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'test-scraper',
          type: 'rss',
          feedUrls: ['https://example.com/rss.xml']
        })
      };

      const scraper = factory.createScraper('rss', config);
      manager.register(scraper);

      const results = await manager.healthCheckAll();

      expect(results).toHaveLength(1);
      expect(results[0].scraperId).toBe('test-scraper');
      expect(results[0].status.healthy).toBe(true);
      expect(results[0].status.status).toBe('active');
    });

    it('should detect unhealthy scrapers', async () => {
      mockedAxios.head.mockRejectedValue(new Error('Connection failed'));

      const config: ScraperConfig = {
        ...createMockScraperConfig({
          id: 'failing-scraper',
          type: 'rss',
          feedUrls: ['https://example.com/rss.xml']
        })
      };

      const scraper = factory.createScraper('rss', config);
      manager.register(scraper);

      const results = await manager.healthCheckAll();

      expect(results).toHaveLength(1);
      expect(results[0].scraperId).toBe('failing-scraper');
      expect(results[0].status.healthy).toBe(false);
      expect(results[0].status.status).toBe('down');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should continue processing after individual scraper failures', async () => {
      // Mock mixed responses
      mockedAxios.get
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { contents: mockApiResponses.rssResponse } });

      const configs = [
        { ...createMockScraperConfig({ id: 'scraper1', type: 'rss', feedUrls: ['https://example.com/1.xml'] }) },
        { ...createMockScraperConfig({ id: 'scraper2', type: 'rss', feedUrls: ['https://example.com/2.xml'] }) },
        { ...createMockScraperConfig({ id: 'scraper3', type: 'rss', feedUrls: ['https://example.com/3.xml'] }) }
      ];

      configs.forEach(config => {
        const scraper = factory.createScraper('rss', config);
        manager.register(scraper);
      });

      const result = await manager.scrapeAll();

      expect(result.articles).toHaveLength(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scraperId).toBe('scraper2');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent scraping requests', async () => {
      // Mock fast responses
      mockedAxios.get.mockResolvedValue({ data: { contents: mockApiResponses.rssResponse } });

      const scrapers = Array.from({ length: 5 }, (_, i) => {
        const config = createMockScraperConfig({
          id: `scraper-${i}`,
          type: 'rss',
          feedUrls: [`https://example.com/${i}.xml`]
        });
        return factory.createScraper('rss', config);
      });

      scrapers.forEach(scraper => manager.register(scraper));

      const startTime = performance.now();
      const result = await manager.scrapeAll({ parallel: true });
      const endTime = performance.now();

      expect(result.articles).toHaveLength(5);
      expect(result.successCount).toBe(5);
      expect(result.duration).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});