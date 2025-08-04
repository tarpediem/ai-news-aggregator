/**
 * Performance tests for diagnosing news loading issues
 * Tests for slow loading times, crashes, and memory leaks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';
import { scraperManager } from '../../services/ScraperFactory';
import { useAppStore } from '../../store/AppStore';
import { VirtualScrollList } from '../../components/VirtualScrollList';
import { mockApiResponses } from '../setup';
import type { NewsArticle } from '../../types/news';
import axios from 'axios';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock axios
const mockedAxios = vi.mocked(axios);

describe('Performance Issues Investigation', () => {
  let performanceStart: number;
  let memoryStart: number;

  beforeEach(() => {
    performanceStart = performance.now();
    memoryStart = (performance as any).memory?.usedJSHeapSize || 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    const duration = performance.now() - performanceStart;
    const memoryEnd = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDiff = memoryEnd - memoryStart;
    
    console.log(`Test duration: ${duration.toFixed(2)}ms`);
    if (memoryDiff > 0) {
      console.log(`Memory usage: +${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
    }
  });

  describe('Scraper Manager Performance', () => {
    it('should not block the main thread for more than 100ms', async () => {
      // Mock fast API responses
      mockedAxios.get.mockResolvedValue({
        data: mockApiResponses.newsApi
      });

      const startTime = performance.now();
      
      // This should not block
      const promise = scraperManager.scrapeAll({ maxArticles: 10 });
      
      const immediateTime = performance.now();
      expect(immediateTime - startTime).toBeLessThan(100); // Should return promise immediately
      
      await promise;
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle timeout errors gracefully', async () => {
      // Mock timeout errors
      mockedAxios.get.mockRejectedValue(new Error('Request timeout'));
      
      const startTime = performance.now();
      
      try {
        await scraperManager.scrapeAll({ maxArticles: 10 });
      } catch (error) {
        // Should still complete quickly even with errors
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(1000);
      }
    });

    it('should not create memory leaks during scraping', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Mock successful responses
      mockedAxios.get.mockResolvedValue({
        data: mockApiResponses.newsApi
      });
      
      // Run multiple scraping operations
      for (let i = 0; i < 10; i++) {
        await scraperManager.scrapeAll({ maxArticles: 5 });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle concurrent scraping requests efficiently', async () => {
      mockedAxios.get.mockResolvedValue({
        data: mockApiResponses.newsApi
      });
      
      const startTime = performance.now();
      
      // Launch multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        scraperManager.scrapeAll({ maxArticles: 5 })
      );
      
      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      
      // Should complete all requests within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
      
      // All requests should either succeed or fail gracefully
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });
  });

  describe('Virtual Scrolling Performance', () => {
    it('should render large lists without blocking', async () => {
      const largeDataset: NewsArticle[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        description: `Description for article ${i}`,
        url: `https://example.com/article-${i}`,
        publishedAt: new Date().toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: 'tech-news' as const,
        relevanceScore: Math.random(),
        urlToImage: '',
        tags: [],
      }));

      const renderStart = performance.now();
      
      render(
        <VirtualScrollList
          items={largeDataset}
          itemHeight={100}
          containerHeight={400}
          renderItem={(item, index) => (
            <div key={item.id} data-testid={`item-${index}`}>
              {item.title}
            </div>
          )}
        />
      );
      
      const renderEnd = performance.now();
      
      // Should render quickly even with 1000 items
      expect(renderEnd - renderStart).toBeLessThan(200);
      
      // Should only render visible items
      const visibleItems = screen.getAllByTestId(/item-\d+/);
      expect(visibleItems.length).toBeLessThan(50); // Much less than 1000
    });

    it('should handle rapid scrolling without performance degradation', async () => {
      const dataset: NewsArticle[] = Array.from({ length: 500 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        description: `Description ${i}`,
        url: `https://example.com/article-${i}`,
        publishedAt: new Date().toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: 'tech-news' as const,
        relevanceScore: Math.random(),
        urlToImage: '',
        tags: [],
      }));

      const { container } = render(
        <VirtualScrollList
          items={dataset}
          itemHeight={100}
          containerHeight={400}
          renderItem={(item, index) => (
            <div key={item.id} data-testid={`item-${index}`}>
              {item.title}
            </div>
          )}
        />
      );

      const scrollContainer = container.querySelector('.virtual-scroll-container');
      
      const scrollStart = performance.now();
      
      // Simulate rapid scrolling
      for (let i = 0; i < 100; i++) {
        const event = new Event('scroll');
        Object.defineProperty(event, 'target', {
          value: { scrollTop: i * 50 }
        });
        scrollContainer?.dispatchEvent(event);
      }
      
      const scrollEnd = performance.now();
      
      // Should handle rapid scrolling efficiently
      expect(scrollEnd - scrollStart).toBeLessThan(1000);
    });
  });

  describe('State Management Performance', () => {
    it('should handle large state updates efficiently', async () => {
      const store = useAppStore.getState();
      
      const largeArticleSet: NewsArticle[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        description: `Description for article ${i}`,
        url: `https://example.com/article-${i}`,
        publishedAt: new Date().toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: 'tech-news' as const,
        relevanceScore: Math.random(),
        urlToImage: '',
        tags: [],
      }));

      const updateStart = performance.now();
      
      store.setArticles(largeArticleSet);
      
      const updateEnd = performance.now();
      
      // Should update large state quickly
      expect(updateEnd - updateStart).toBeLessThan(100);
      
      // State should be updated correctly
      expect(store.articles.length).toBe(1000);
      expect(store.totalArticles).toBe(1000);
    });

    it('should handle frequent filter updates without performance issues', async () => {
      const store = useAppStore.getState();
      
      // Set up initial data
      const articles: NewsArticle[] = Array.from({ length: 500 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        description: `Description for article ${i}`,
        url: `https://example.com/article-${i}`,
        publishedAt: new Date().toISOString(),
        source: { id: 'test', name: 'Test Source', category: 'Tech' },
        author: 'Test Author',
        category: (i % 2 === 0 ? 'tech-news' : 'artificial-intelligence') as const,
        relevanceScore: Math.random(),
        urlToImage: '',
        tags: [],
      }));

      store.setArticles(articles);

      const filterStart = performance.now();
      
      // Perform multiple filter operations
      for (let i = 0; i < 50; i++) {
        store.setCategory(i % 2 === 0 ? 'tech-news' : 'artificial-intelligence');
        store.setSearchQuery(`query ${i}`);
      }
      
      const filterEnd = performance.now();
      
      // Should handle frequent filtering efficiently
      expect(filterEnd - filterStart).toBeLessThan(500);
    });
  });

  describe('Network Request Performance', () => {
    it('should timeout requests within reasonable time', async () => {
      // Mock slow response
      mockedAxios.get.mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: mockApiResponses.newsApi }), 10000);
        })
      );

      const timeoutStart = performance.now();
      
      try {
        await scraperManager.scrapeAll({ 
          maxArticles: 10,
          timeout: 5000 // 5 second timeout
        });
      } catch (error) {
        const timeoutEnd = performance.now();
        
        // Should timeout within the specified time
        expect(timeoutEnd - timeoutStart).toBeLessThan(6000);
        expect(timeoutEnd - timeoutStart).toBeGreaterThan(4000);
      }
    });

    it('should handle network errors gracefully', async () => {
      const errorCodes = [400, 401, 403, 404, 429, 500, 502, 503, 504];
      
      for (const code of errorCodes) {
        mockedAxios.get.mockRejectedValueOnce({
          response: { status: code },
          message: `HTTP ${code}`
        });
      }

      const errorStart = performance.now();
      
      const result = await scraperManager.scrapeAll({ maxArticles: 10 });
      
      const errorEnd = performance.now();
      
      // Should handle all errors quickly
      expect(errorEnd - errorStart).toBeLessThan(2000);
      
      // Should return empty results instead of crashing
      expect(result.articles).toEqual([]);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during component mounting/unmounting', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Mount and unmount components repeatedly
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <VirtualScrollList
            items={[]}
            itemHeight={100}
            containerHeight={400}
            renderItem={(item, index) => <div key={index}>{item}</div>}
          />
        );
        
        unmount();
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });

    it('should clean up event listeners and timers', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(
        <VirtualScrollList
          items={[]}
          itemHeight={100}
          containerHeight={400}
          renderItem={(item, index) => <div key={index}>{item}</div>}
        />
      );
      
      const listenersAdded = addEventListenerSpy.mock.calls.length;
      const timersCreated = setTimeoutSpy.mock.calls.length;
      
      unmount();
      
      // Should clean up listeners and timers
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(listenersAdded);
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Progressive Loading', () => {
    it('should load articles progressively instead of blocking', async () => {
      const articlesReceived: any[] = [];
      
      // Mock staggered responses
      mockedAxios.get
        .mockResolvedValueOnce({ data: { articles: [{ id: 1, title: 'Article 1' }] } })
        .mockResolvedValueOnce({ data: { articles: [{ id: 2, title: 'Article 2' }] } })
        .mockResolvedValueOnce({ data: { articles: [{ id: 3, title: 'Article 3' }] } });

      const startTime = performance.now();
      
      // Start scraping
      scraperManager.scrapeAll({ maxArticles: 10 }).then(result => {
        articlesReceived.push(...result.articles);
      });
      
      // Should not block - function should return immediately
      const immediateTime = performance.now();
      expect(immediateTime - startTime).toBeLessThan(10);
      
      // Wait for first batch
      await waitFor(() => {
        expect(articlesReceived.length).toBeGreaterThan(0);
      }, { timeout: 1000 });
      
      const firstBatchTime = performance.now();
      expect(firstBatchTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from complete API failures', async () => {
      // Mock complete failure
      mockedAxios.get.mockRejectedValue(new Error('Network failure'));
      
      const startTime = performance.now();
      
      const result = await scraperManager.scrapeAll({ maxArticles: 10 });
      
      const endTime = performance.now();
      
      // Should fail quickly and gracefully
      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.articles).toEqual([]);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed responses
      mockedAxios.get
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: { invalid: 'structure' } })
        .mockResolvedValueOnce({ data: { articles: 'not an array' } });

      const result = await scraperManager.scrapeAll({ maxArticles: 10 });
      
      // Should handle malformed data gracefully
      expect(result.articles).toEqual([]);
    });
  });
});