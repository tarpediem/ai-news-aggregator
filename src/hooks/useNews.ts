import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

import { CACHE_CONFIG, UI_CONFIG } from '../config/constants';
import { newsService } from '../services/newsService';
import type { NewsCategory, NewsArticle } from '../types/news';

export const useNews = (category?: NewsCategory, progressive = true) => {
  return useQuery({
    queryKey: ['news', category, progressive],
    queryFn: () => newsService.fetchNews(category, { progressive }),
    staleTime: CACHE_CONFIG.QUERY_STALE_TIME,
    gcTime: CACHE_CONFIG.QUERY_GC_TIME,
    refetchInterval: CACHE_CONFIG.NEWS_TIMEOUT,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Reduced max delay
  });
};

export const useArxivPapers = (query = 'artificial intelligence') => {
  return useQuery({
    queryKey: ['arxiv', query],
    queryFn: () => newsService.fetchArxivPapers(query),
    staleTime: CACHE_CONFIG.ARXIV_STALE_TIME,
    gcTime: CACHE_CONFIG.ARXIV_GC_TIME,
    enabled: query.length > 0,
    retry: 1,
  });
};

export const useSearchNews = (query: string) => {
  return useQuery({
    queryKey: ['news-search', query],
    queryFn: () => newsService.searchNews(query),
    staleTime: CACHE_CONFIG.SEARCH_STALE_TIME,
    gcTime: CACHE_CONFIG.SEARCH_GC_TIME,
    enabled: query.length > UI_CONFIG.SEARCH_MIN_LENGTH,
    retry: 1,
  });
};

export const useTrendingTopics = () => {
  return useQuery({
    queryKey: ['trending-topics'],
    queryFn: () => newsService.fetchTrendingTopics(),
    staleTime: CACHE_CONFIG.TRENDING_STALE_TIME,
    gcTime: CACHE_CONFIG.TRENDING_GC_TIME,
    retry: 1,
  });
};

// Hook for progressive news loading with real-time updates
export const useProgressiveNews = (category?: NewsCategory) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    loadedSources: 0,
    totalSources: 0,
    errors: [] as { source: string; error: string }[]
  });
  
  const loadNews = useCallback(async () => {
    setLoadingState(prev => ({ ...prev, isLoading: true }));
    setArticles([]);
    
    try {
      // Get partial results immediately if available
      const partialResults = newsService.getPartialResults(category);
      if (partialResults.length > 0) {
        setArticles(partialResults);
      }
      
      // Load full results progressively
      const fullResults = await newsService.fetchNews(category, { progressive: true });
      setArticles(fullResults);
    } catch (error) {
      console.error('Progressive news loading failed:', error);
    } finally {
      setLoadingState(prev => ({ ...prev, isLoading: false }));
    }
  }, [category]);
  
  useEffect(() => {
    loadNews();
  }, [loadNews, category]); // Include loadNews dependency to avoid stale closures
  
  return {
    articles,
    isLoading: loadingState.isLoading,
    loadedSources: loadingState.loadedSources,
    totalSources: loadingState.totalSources,
    errors: loadingState.errors,
    refetch: loadNews
  };
};

export const useRefreshNews = () => {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    // More selective cache invalidation
    queryClient.invalidateQueries({ queryKey: ['news'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['arxiv'] });
    queryClient.invalidateQueries({ queryKey: ['trending-topics'] });
  }, [queryClient]);
};