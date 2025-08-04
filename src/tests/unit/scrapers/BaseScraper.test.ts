/**
 * Unit tests for BaseScraper abstract class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseScraper } from '../../../abstracts/BaseScraper';
import { createMockScraperConfig, createMockNewsArticle } from '../../setup';
import type { NewsArticle, ScrapeOptions } from '../../../interfaces/INewsScaper';

// Create a concrete implementation for testing
class TestScraper extends BaseScraper {
  canHandle(url: string): boolean {
    return url.includes('test.com');
  }

  protected async performScrape(options: ScrapeOptions): Promise<NewsArticle[]> {
    return [createMockNewsArticle()];
  }
}

describe('BaseScraper', () => {
  let scraper: TestScraper;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = createMockScraperConfig();
    scraper = new TestScraper(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(scraper.id).toBe('test-scraper');
      expect(scraper.name).toBe('Test Scraper');
      expect(scraper.priority).toBe(1);
      expect(scraper.categories).toEqual(['artificial-intelligence']);
    });

    it('should throw error with invalid config', () => {
      expect(() => new TestScraper({ ...mockConfig, id: '' })).toThrow('Scraper ID is required');
      expect(() => new TestScraper({ ...mockConfig, name: '' })).toThrow('Scraper name is required');
      expect(() => new TestScraper({ ...mockConfig, priority: -1 })).toThrow('Priority must be non-negative');
    });
  });

  describe('scrape', () => {
    it('should scrape articles successfully', async () => {
      const articles = await scraper.scrape();
      
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Test AI News Article');
      expect(articles[0].id).toBeTruthy();
    });

    it('should throw error when scraper is disabled', async () => {
      scraper = new TestScraper({ ...mockConfig, enabled: false });
      
      await expect(scraper.scrape()).rejects.toThrow('Scraper test-scraper is disabled');
    });

    it('should apply category filtering', async () => {
      const options = { categories: ['tech-news' as const] };
      const articles = await scraper.scrape(options);
      
      // Should return empty array since our mock article is 'artificial-intelligence'
      expect(articles).toHaveLength(0);
    });

    it('should apply article limit', async () => {
      // Create scraper that returns multiple articles
      class MultiArticleScraper extends BaseScraper {
        canHandle(url: string): boolean { return true; }
        protected async performScrape(): Promise<NewsArticle[]> {
          return [
            createMockNewsArticle({ id: '1' }),
            createMockNewsArticle({ id: '2' }),
            createMockNewsArticle({ id: '3' }),
          ];
        }
      }

      const multiScraper = new MultiArticleScraper(mockConfig);
      const articles = await multiScraper.scrape({ maxArticles: 2 });
      
      expect(articles).toHaveLength(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const status = await scraper.healthCheck();
      
      expect(status.healthy).toBe(true);
      expect(status.status).toBe('active');
      expect(status.responseTime).toBeGreaterThan(0);
      expect(status.lastChecked).toBeInstanceOf(Date);
    });

    it('should handle health check errors', async () => {
      class FailingScraper extends BaseScraper {
        canHandle(url: string): boolean { return true; }
        protected async performScrape(): Promise<NewsArticle[]> { return []; }
        protected async checkHealth(): Promise<boolean> {
          throw new Error('Health check failed');
        }
      }

      const failingScraper = new FailingScraper(mockConfig);
      const status = await failingScraper.healthCheck();
      
      expect(status.healthy).toBe(false);
      expect(status.status).toBe('down');
      expect(status.errors).toHaveLength(1);
    });
  });

  describe('utility methods', () => {
    it('should generate unique article IDs', () => {
      const article1 = createMockNewsArticle({ title: 'Article 1', url: 'https://example.com/1' });
      const article2 = createMockNewsArticle({ title: 'Article 2', url: 'https://example.com/2' });
      
      const id1 = scraper['generateArticleId'](article1);
      const id2 = scraper['generateArticleId'](article2);
      
      expect(id1).not.toBe(id2);
      expect(id1).toContain('test-scraper');
      expect(id2).toContain('test-scraper');
    });

    it('should clean HTML content', () => {
      const dirty = '<p>Test <strong>content</strong> with &amp; entities</p>';
      const clean = scraper['cleanHtml'](dirty);
      
      expect(clean).toBe('Test content with   entities');
    });

    it('should resolve relative URLs', () => {
      const base = 'https://example.com/news/';
      const relative = './article.html';
      const resolved = scraper['resolveUrl'](relative, base);
      
      expect(resolved).toBe('https://example.com/news/article.html');
    });

    it('should calculate relevance scores', () => {
      const aiArticle = createMockNewsArticle({
        title: 'ChatGPT and OpenAI breakthrough',
        description: 'Machine learning neural networks deep learning',
      });
      
      const regularArticle = createMockNewsArticle({
        title: 'Regular tech news',
        description: 'Some regular technology news',
      });
      
      const aiScore = scraper['calculateRelevanceScore'](aiArticle);
      const regularScore = scraper['calculateRelevanceScore'](regularArticle);
      
      expect(aiScore).toBeGreaterThan(regularScore);
      expect(aiScore).toBeLessThanOrEqual(1.0);
    });

    it('should extract relevant tags', () => {
      const content = 'ChatGPT artificial intelligence machine learning OpenAI';
      const tags = scraper['extractTags'](content);
      
      expect(tags).toContain('artificial intelligence');
      expect(tags).toContain('machine learning');
      expect(tags).toContain('OpenAI');
      expect(tags.length).toBeLessThanOrEqual(5);
    });

    it('should calculate recency scores', () => {
      const recentArticle = createMockNewsArticle({
        publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });
      
      const oldArticle = createMockNewsArticle({
        publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
      });
      
      const recentScore = scraper['getRecencyScore'](recentArticle);
      const oldScore = scraper['getRecencyScore'](oldArticle);
      
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('article processing', () => {
    it('should validate articles properly', () => {
      const validArticle = createMockNewsArticle();
      const invalidArticle = createMockNewsArticle({
        title: 'Short', // Too short
        description: 'Too short description',
        url: '',
      });
      
      expect(scraper['validateArticle'](validArticle)).toBe(true);
      expect(scraper['validateArticle'](invalidArticle)).toBe(false);
    });

    it('should enhance articles with missing data', () => {
      const incompleteArticle = createMockNewsArticle({
        id: '',
        urlToImage: '',
        tags: [],
        relevanceScore: 0,
      });
      
      const enhanced = scraper['enhanceArticle'](incompleteArticle);
      
      expect(enhanced.id).toBeTruthy();
      expect(enhanced.urlToImage).toBeTruthy();
      expect(enhanced.tags.length).toBeGreaterThan(0);
      expect(enhanced.relevanceScore).toBeGreaterThan(0);
    });

    it('should process articles with filtering and sorting', async () => {
      class MultiArticleScraper extends BaseScraper {
        canHandle(url: string): boolean { return true; }
        protected async performScrape(): Promise<NewsArticle[]> {
          return [
            createMockNewsArticle({ 
              id: '1', 
              title: 'High relevance ChatGPT news',
              relevanceScore: 0.9,
              publishedAt: new Date().toISOString(),
            }),
            createMockNewsArticle({ 
              id: '2', 
              title: 'Low relevance tech news',
              relevanceScore: 0.3,
              publishedAt: new Date(Date.now() - 86400000).toISOString(),
            }),
            createMockNewsArticle({ 
              id: '3', 
              title: 'Short title', // Should be filtered out
              description: 'Too short',
            }),
          ];
        }
      }

      const multiScraper = new MultiArticleScraper(mockConfig);
      const articles = await multiScraper.scrape();
      
      // Should filter out invalid article and sort by relevance
      expect(articles).toHaveLength(2);
      expect(articles[0].relevanceScore).toBeGreaterThan(articles[1].relevanceScore);
    });
  });

  describe('statistics tracking', () => {
    it('should track scraping statistics', async () => {
      await scraper.scrape();
      
      const stats = scraper.getStats();
      
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.totalArticles).toBe(1);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.lastActive).toBeInstanceOf(Date);
    });

    it('should track error statistics', async () => {
      class ErrorScraper extends BaseScraper {
        canHandle(url: string): boolean { return true; }
        protected async performScrape(): Promise<NewsArticle[]> {
          throw new Error('Scraping failed');
        }
      }

      const errorScraper = new ErrorScraper(mockConfig);
      
      await expect(errorScraper.scrape()).rejects.toThrow('Scraping failed');
      
      const stats = errorScraper.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.totalArticles).toBe(0);
    });
  });
});