import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Newspaper, Brain, RefreshCw, Settings } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useNews, useArxivPapers, useRefreshNews } from '../hooks/useNews';
import type { NewsCategory } from '../types/news';

import { ArxivCard } from './ArxivCard';
import { NewsCard } from './NewsCard';
import { SearchBar } from './SearchBar';
import { SkeletonLoader } from './SkeletonLoader';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function SimpleAppContent() {
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Use news hooks
  const { data: newsData, isLoading: newsLoading, error: newsError } = useNews(
    selectedCategory || undefined
  );
  const { data: papersData, isLoading: papersLoading, error: papersError } = useArxivPapers('artificial intelligence');
  const refreshNews = useRefreshNews();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleRefresh = () => {
    refreshNews();
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      try {
        const isDark = JSON.parse(savedDarkMode);
        if (isDark !== isDarkMode) {
          setIsDarkMode(isDark);
          document.documentElement.classList.toggle('dark', isDark);
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }, []);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Brain className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-blue-600">AI News Hub</h1>
                  <p className="text-gray-600 dark:text-gray-300">Latest AI news and research papers</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                
                <button
                  onClick={handleRefresh}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <SearchBar onSearch={handleSearch} className="mb-6" />

            {/* Navigation Tabs */}
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('news')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
                  activeTab === 'news' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Newspaper className="w-4 h-4" />
                <span>News</span>
              </button>
              
              <button
                onClick={() => setActiveTab('papers')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
                  activeTab === 'papers' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Brain className="w-4 h-4" />
                <span>Research Papers</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main>
          {activeTab === 'news' ? (
            newsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <SkeletonLoader key={i} type="news" />
                ))}
              </div>
            ) : newsError ? (
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400">Error loading news. Please try again.</p>
              </div>
            ) : newsData && newsData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsData.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">No news articles found.</p>
              </div>
            )
          ) : (
            papersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <SkeletonLoader key={i} type="arxiv" />
                ))}
              </div>
            ) : papersError ? (
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400">Error loading papers. Please try again.</p>
              </div>
            ) : papersData && papersData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {papersData.map((paper) => (
                  <ArxivCard key={paper.id} paper={paper} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-300">No research papers found.</p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}

function SimpleApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SimpleAppContent />
    </QueryClientProvider>
  );
}

export default SimpleApp;