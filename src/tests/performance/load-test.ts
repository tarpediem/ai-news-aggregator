/**
 * Load testing for news application
 * Tests app behavior under various load conditions
 */

import { performance } from 'perf_hooks';

import axios from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { analyticsService } from '../../services/AnalyticsService';
import { globalErrorHandler } from '../../services/GlobalErrorHandler';
import { scraperManager } from '../../services/ScraperFactory';
import { useAppStore } from '../../store/AppStore';


const mockedAxios = vi.mocked(axios);

describe('Load Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().clearArticles();
    globalErrorHandler.clearErrors();
    analyticsService.clearData();
  });

  describe('High Volume Article Loading', () => {
    it('should handle loading 1000+ articles efficiently', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        description: `Description for article ${i}`,
        url: `https://example.com/article-${i}`,
        urlToImage: `https://example.com/image-${i}.jpg`,
        publishedAt: new Date(Date.now() - i * 60000).toISOString(),
        source: { id: 'test', name: 'Test Source' },
        author: 'Test Author',
      }));

      mockedAxios.get.mockResolvedValue({
        data: { articles: largeDataset }
      });

      const startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const result = await scraperManager.scrapeAll({ maxArticles: 1000 });

      const endTime = performance.now();
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Performance assertions
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.articles.length).toBe(1000);
      
      // Memory usage should be reasonable (less than 50MB increase)
      expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024);

      // Store should handle large dataset
      const store = useAppStore.getState();
      store.setArticles(result.articles);
      
      expect(store.articles.length).toBe(1000);
      expect(store.totalArticles).toBe(1000);
    });

    it('should handle concurrent user actions on large dataset', async () => {
      const store = useAppStore.getState();
      
      // Set up large dataset
      const articles = Array.from({ length: 500 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        description: `Description for article ${i}`,
        url: `https://example.com/article-${i}`,
        urlToImage: `https://example.com/image-${i}.jpg`,
        publishedAt: new Date(Date.now() - i * 60000).toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: (i % 5 === 0 ? 'artificial-intelligence' : 'tech-news') as const,
        relevanceScore: Math.random(),
        tags: [`tag-${i % 10}`],
      }));

      store.setArticles(articles);

      const startTime = performance.now();

      // Simulate concurrent user actions
      const actions = [
        () => store.setCategory('artificial-intelligence'),
        () => store.setSearchQuery('Article 1'),
        () => store.setSortBy('date'),
        () => store.setSortOrder('asc'),
        () => store.addBookmark('article-100'),
        () => store.markAsRead('article-101'),
        () => store.setCurrentPage(2),
        () => store.setCategory('tech-news'),
        () => store.setSearchQuery('Description'),
        () => store.setSortBy('relevance'),
      ];

      // Execute all actions concurrently
      await Promise.all(actions.map(action => Promise.resolve(action())));

      const endTime = performance.now();

      // Should handle concurrent actions quickly
      expect(endTime - startTime).toBeLessThan(200);
      
      // State should be consistent
      expect(store.articles.length).toBe(500);
      expect(store.filteredArticles.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Stress Testing', () => {
    it('should handle repeated article loading/clearing cycles', async () => {
      const store = useAppStore.getState();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate repeated loading/clearing cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const articles = Array.from({ length: 100 }, (_, i) => ({
          id: `cycle-${cycle}-article-${i}`,
          title: `Cycle ${cycle} Article ${i}`,
          description: `Description for cycle ${cycle} article ${i}`,
          url: `https://example.com/cycle-${cycle}-article-${i}`,
          urlToImage: `https://example.com/cycle-${cycle}-image-${i}.jpg`,
          publishedAt: new Date().toISOString(),
          source: { id: 'test', name: 'Test Source', category: 'Tech' },
          author: 'Test Author',
          category: 'tech-news' as const,
          relevanceScore: Math.random(),
          tags: [],
        }));

        store.setArticles(articles);
        expect(store.articles.length).toBe(100);
        
        // Perform some operations
        store.setCategory('tech-news');
        store.setSearchQuery(`cycle ${cycle}`);
        
        // Clear articles
        store.clearArticles();
        expect(store.articles.length).toBe(0);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle memory pressure gracefully', async () => {
      const store = useAppStore.getState();
      
      // Create memory pressure by loading large amounts of data
      const createLargeArticle = (id: string) => ({
        id,
        title: `Article ${id}`,
        description: 'Very long description '.repeat(1000), // ~20KB per article
        url: `https://example.com/article-${id}`,
        urlToImage: `https://example.com/image-${id}.jpg`,
        publishedAt: new Date().toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: 'tech-news' as const,
        relevanceScore: Math.random(),
        tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
      });

      const startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Load large articles
      const largeArticles = Array.from({ length: 100 }, (_, i) => 
        createLargeArticle(`large-${i}`)
      );

      store.setArticles(largeArticles);

      // Perform operations that might cause memory issues
      for (let i = 0; i < 50; i++) {
        store.setSearchQuery(`search ${i}`);
        store.applyFilters();
      }

      const endTime = performance.now();
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Should handle memory pressure without crashing
      expect(endTime - startTime).toBeLessThan(5000);
      expect(store.articles.length).toBe(100);
      
      // Memory usage should be reasonable (less than 100MB)
      expect(finalMemory - initialMemory).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Network Stress Testing', () => {
    it('should handle rapid successive API calls', async () => {
      // Mock varying response times
      mockedAxios.get
        .mockResolvedValueOnce({ data: { articles: [{ id: 1 }] } })
        .mockResolvedValueOnce({ data: { articles: [{ id: 2 }] } })
        .mockResolvedValueOnce({ data: { articles: [{ id: 3 }] } })
        .mockResolvedValueOnce({ data: { articles: [{ id: 4 }] } })
        .mockResolvedValueOnce({ data: { articles: [{ id: 5 }] } });

      const startTime = performance.now();

      // Make rapid successive calls
      const promises = Array.from({ length: 5 }, () => 
        scraperManager.scrapeAll({ maxArticles: 10 })
      );

      const results = await Promise.allSettled(promises);

      const endTime = performance.now();

      // Should handle rapid calls without blocking
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Most calls should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should handle mixed success/failure scenarios', async () => {
      // Mock mixed responses
      mockedAxios.get
        .mockResolvedValueOnce({ data: { articles: [{ id: 1 }] } })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { articles: [{ id: 2 }] } })
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ data: { articles: [{ id: 3 }] } });

      const results = await Promise.allSettled([
        scraperManager.scrapeAll({ maxArticles: 10 }),
        scraperManager.scrapeAll({ maxArticles: 10 }),
        scraperManager.scrapeAll({ maxArticles: 10 }),
        scraperManager.scrapeAll({ maxArticles: 10 }),
        scraperManager.scrapeAll({ maxArticles: 10 }),
      ]);

      // Should handle mixed scenarios gracefully
      expect(results.length).toBe(5);
      
      // Should have some successes and some failures
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('UI Performance Under Load', () => {
    it('should maintain responsive UI during heavy operations', async () => {
      const store = useAppStore.getState();
      
      // Set up heavy dataset
      const heavyArticles = Array.from({ length: 1000 }, (_, i) => ({
        id: `heavy-${i}`,
        title: `Heavy Article ${i}`,
        description: `Heavy description ${i}`.repeat(100),
        url: `https://example.com/heavy-${i}`,
        urlToImage: `https://example.com/heavy-${i}.jpg`,
        publishedAt: new Date().toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: 'tech-news' as const,
        relevanceScore: Math.random(),
        tags: Array.from({ length: 20 }, (_, j) => `tag-${j}`),
      }));

      const startTime = performance.now();

      // Perform heavy operations
      store.setArticles(heavyArticles);
      
      // Simulate rapid UI updates
      for (let i = 0; i < 20; i++) {
        store.setSearchQuery(`search ${i}`);
        store.setCategory(i % 2 === 0 ? 'tech-news' : 'artificial-intelligence');
        store.setSortBy(i % 3 === 0 ? 'date' : 'relevance');
      }

      const endTime = performance.now();

      // UI should remain responsive
      expect(endTime - startTime).toBeLessThan(2000);
      expect(store.articles.length).toBe(1000);
      expect(store.filteredArticles.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should track errors without impacting performance', async () => {
      const startTime = performance.now();
      
      // Generate many errors
      for (let i = 0; i < 100; i++) {
        globalErrorHandler.handleError(new Error(`Load test error ${i}`), {
          context: `load-test-${i}`,
          source: 'load-test',
        });
      }

      const endTime = performance.now();

      // Error handling should be fast
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Errors should be tracked
      const healthReport = globalErrorHandler.getHealthReport();
      expect(healthReport.totalErrors).toBe(100);
      expect(healthReport.healthy).toBe(false);
    });

    it('should handle error recovery under load', async () => {
      // Simulate error recovery scenarios
      const errors = Array.from({ length: 50 }, (_, i) => 
        new Error(`Recovery test error ${i}`)
      );

      const startTime = performance.now();

      // Generate errors rapidly
      errors.forEach(error => {
        globalErrorHandler.handleError(error, {
          context: 'recovery-test',
          source: 'load-test',
        });
      });

      // Clear errors (simulating recovery)
      globalErrorHandler.clearErrors();

      const endTime = performance.now();

      // Should handle error recovery efficiently
      expect(endTime - startTime).toBeLessThan(500);
      
      // Should be healthy after clearing
      const healthReport = globalErrorHandler.getHealthReport();
      expect(healthReport.totalErrors).toBe(0);
      expect(healthReport.healthy).toBe(true);
    });
  });

  describe('Analytics Performance', () => {
    it('should handle high-frequency event tracking', async () => {
      const startTime = performance.now();

      // Generate high frequency events
      for (let i = 0; i < 1000; i++) {
        analyticsService.trackEvent('performance-test', 'load-test', {
          eventId: i,
          timestamp: Date.now(),
          data: `test-data-${i}`,
        });
      }

      const endTime = performance.now();

      // Should handle high frequency events efficiently
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Events should be tracked
      const eventCounts = analyticsService.getEventCounts();
      expect(eventCounts['performance-test:load-test']).toBe(1000);
    });
  });
});