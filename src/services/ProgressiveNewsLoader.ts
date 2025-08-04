/**
 * Progressive News Loader
 * Loads news articles progressively to prevent UI blocking
 */

import type { ScrapeOptions } from '../interfaces/INewsScaper';
import { useAppStore } from '../store/AppStore';
import type { NewsArticle, NewsCategory } from '../types/news';

import { analyticsService } from './AnalyticsService';
import { globalErrorHandler } from './GlobalErrorHandler';
import { scraperManager } from './ScraperFactory';


interface ProgressiveLoadOptions extends ScrapeOptions {
  onProgress?: (articles: NewsArticle[], source: string) => void;
  onError?: (error: Error, source: string) => void;
  onComplete?: (totalArticles: number, totalSources: number) => void;
  batchSize?: number;
  maxConcurrent?: number;
  timeout?: number;
}

interface LoadingState {
  isLoading: boolean;
  loadedSources: number;
  totalSources: number;
  articles: NewsArticle[];
  errors: { source: string; error: Error }[];
}

export class ProgressiveNewsLoader {
  private static instance: ProgressiveNewsLoader;
  private currentLoad: Promise<NewsArticle[]> | null = null;
  private loadingState: LoadingState = {
    isLoading: false,
    loadedSources: 0,
    totalSources: 0,
    articles: [],
    errors: [],
  };

  private constructor() {}

  static getInstance(): ProgressiveNewsLoader {
    if (!ProgressiveNewsLoader.instance) {
      ProgressiveNewsLoader.instance = new ProgressiveNewsLoader();
    }
    return ProgressiveNewsLoader.instance;
  }

  async loadNews(options: ProgressiveLoadOptions = {}): Promise<NewsArticle[]> {
    // Prevent multiple simultaneous loads
    if (this.currentLoad) {
      return this.currentLoad;
    }

    const startTime = performance.now();
    
    // Track loading start
    analyticsService.trackEvent('news-loading', 'progressive-load-start', {
      options: { ...options, onProgress: undefined, onError: undefined, onComplete: undefined },
    });

    this.currentLoad = this.performProgressiveLoad(options);
    
    try {
      const articles = await this.currentLoad;
      
      const duration = performance.now() - startTime;
      analyticsService.trackEvent('news-loading', 'progressive-load-complete', {
        articlesCount: articles.length,
        duration,
        sourcesLoaded: this.loadingState.loadedSources,
        errors: this.loadingState.errors.length,
      });

      return articles;
    } catch (error) {
      analyticsService.trackEvent('news-loading', 'progressive-load-error', {
        error: (error as Error).message,
        duration: performance.now() - startTime,
      });
      throw error;
    } finally {
      this.currentLoad = null;
    }
  }

  private async performProgressiveLoad(options: ProgressiveLoadOptions): Promise<NewsArticle[]> {
    const {
      onProgress,
      onError,
      onComplete,
      batchSize = 3,
      maxConcurrent = 2,
      timeout = 5000,
      ...scrapeOptions
    } = options;

    // Reset loading state
    this.loadingState = {
      isLoading: true,
      loadedSources: 0,
      totalSources: 0,
      articles: [],
      errors: [],
    };

    const store = useAppStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const allScrapers = scraperManager.getAllScrapers();
      const activeScrapers = allScrapers.filter(scraper => scraper.getConfig().enabled);
      
      this.loadingState.totalSources = activeScrapers.length;

      // Filter scrapers by category if specified
      const targetScrapers = scrapeOptions.categories?.length
        ? activeScrapers.filter(scraper =>
            scraper.categories.some(cat => scrapeOptions.categories!.includes(cat))
          )
        : activeScrapers;

      // Sort by priority (higher priority first)
      targetScrapers.sort((a, b) => b.priority - a.priority);

      // Load articles in batches with limited concurrency
      const allArticles: NewsArticle[] = [];
      
      for (let i = 0; i < targetScrapers.length; i += batchSize) {
        const batch = targetScrapers.slice(i, i + batchSize);
        
        // Limit concurrent requests
        const concurrentBatch = batch.slice(0, maxConcurrent);
        
        const batchPromises = concurrentBatch.map(scraper => 
          this.loadFromScraper(scraper, scrapeOptions, timeout)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          const scraper = concurrentBatch[index];
          this.loadingState.loadedSources++;
          
          if (result.status === 'fulfilled') {
            const articles = result.value;
            allArticles.push(...articles);
            this.loadingState.articles.push(...articles);
            
            // Update store progressively
            store.addArticles(articles);
            
            // Notify progress
            onProgress?.(articles, scraper.name);
            
            analyticsService.trackEvent('news-loading', 'source-loaded', {
              source: scraper.name,
              articlesCount: articles.length,
              loadedSources: this.loadingState.loadedSources,
              totalSources: this.loadingState.totalSources,
            });
          } else {
            const error = result.reason as Error;
            this.loadingState.errors.push({ source: scraper.name, error });
            
            globalErrorHandler.handleError(error, {
              source: 'progressive-loader',
              scraperId: scraper.id,
              operation: 'load-from-scraper',
            });
            
            onError?.(error, scraper.name);
          }
        });

        // Small delay between batches to prevent overwhelming
        if (i + batchSize < targetScrapers.length) {
          await this.delay(100);
        }
      }

      // Final completion
      onComplete?.(allArticles.length, this.loadingState.loadedSources);
      
      return allArticles;
      
    } catch (error) {
      store.setError((error as Error).message);
      throw error;
    } finally {
      store.setLoading(false);
      this.loadingState.isLoading = false;
    }
  }

  private async loadFromScraper(
    scraper: any,
    options: ScrapeOptions,
    timeout: number
  ): Promise<NewsArticle[]> {
    return Promise.race([
      scraper.scrape(options),
      this.createTimeout(timeout, `Scraper ${scraper.name} timeout`),
    ]);
  }

  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API
  getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }

  isLoading(): boolean {
    return this.loadingState.isLoading;
  }

  cancel(): void {
    if (this.currentLoad) {
      this.currentLoad = null;
      this.loadingState.isLoading = false;
      const store = useAppStore.getState();
      store.setLoading(false);
    }
  }

  // Quick load for immediate results
  async quickLoad(maxArticles = 20): Promise<NewsArticle[]> {
    return this.loadNews({
      maxArticles,
      timeout: 3000,
      batchSize: 2,
      maxConcurrent: 1,
      priority: 'speed',
    });
  }

  // Quality load for comprehensive results
  async qualityLoad(categories?: NewsCategory[]): Promise<NewsArticle[]> {
    return this.loadNews({
      categories,
      timeout: 8000,
      batchSize: 4,
      maxConcurrent: 3,
      priority: 'quality',
    });
  }

  // Refresh current articles
  async refresh(): Promise<NewsArticle[]> {
    const store = useAppStore.getState();
    const currentCategory = store.selectedCategory;
    
    store.clearArticles();
    
    return this.loadNews({
      categories: currentCategory !== 'all' ? [currentCategory] : undefined,
      forceRefresh: true,
      timeout: 5000,
    });
  }
}

// Singleton instance
export const progressiveNewsLoader = ProgressiveNewsLoader.getInstance();

// React hook for progressive loading
export function useProgressiveNewsLoader() {
  const [loadingState, setLoadingState] = React.useState<LoadingState>(() => 
    progressiveNewsLoader.getLoadingState()
  );

  const loadNews = React.useCallback(async (options: ProgressiveLoadOptions = {}) => {
    const enhancedOptions: ProgressiveLoadOptions = {
      ...options,
      onProgress: (articles, source) => {
        setLoadingState(progressiveNewsLoader.getLoadingState());
        options.onProgress?.(articles, source);
      },
      onError: (error, source) => {
        setLoadingState(progressiveNewsLoader.getLoadingState());
        options.onError?.(error, source);
      },
      onComplete: (totalArticles, totalSources) => {
        setLoadingState(progressiveNewsLoader.getLoadingState());
        options.onComplete?.(totalArticles, totalSources);
      },
    };

    return progressiveNewsLoader.loadNews(enhancedOptions);
  }, []);

  const quickLoad = React.useCallback((maxArticles?: number) => {
    return progressiveNewsLoader.quickLoad(maxArticles);
  }, []);

  const qualityLoad = React.useCallback((categories?: NewsCategory[]) => {
    return progressiveNewsLoader.qualityLoad(categories);
  }, []);

  const refresh = React.useCallback(() => {
    return progressiveNewsLoader.refresh();
  }, []);

  const cancel = React.useCallback(() => {
    progressiveNewsLoader.cancel();
    setLoadingState(progressiveNewsLoader.getLoadingState());
  }, []);

  return {
    loadingState,
    isLoading: loadingState.isLoading,
    loadNews,
    quickLoad,
    qualityLoad,
    refresh,
    cancel,
  };
}

// Add React import
import React from 'react';

export default ProgressiveNewsLoader;