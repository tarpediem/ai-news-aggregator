import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newsService } from '../services/newsService';
import type { NewsCategory } from '../types/news';

export const useNews = (category?: NewsCategory) => {
  return useQuery({
    queryKey: ['news', category],
    queryFn: () => newsService.fetchNews(category),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 15 * 60 * 1000, // 15 minutes
  });
};

export const useArxivPapers = (query: string = 'artificial intelligence') => {
  return useQuery({
    queryKey: ['arxiv', query],
    queryFn: () => newsService.fetchArxivPapers(query),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: query.length > 0,
  });
};

export const useSearchNews = (query: string) => {
  return useQuery({
    queryKey: ['news-search', query],
    queryFn: () => newsService.searchNews(query),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: query.length > 2,
  });
};

export const useTrendingTopics = () => {
  return useQuery({
    queryKey: ['trending-topics'],
    queryFn: () => newsService.fetchTrendingTopics(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

export const useRefreshNews = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['news'] });
    queryClient.invalidateQueries({ queryKey: ['arxiv'] });
    queryClient.invalidateQueries({ queryKey: ['trending-topics'] });
  };
};