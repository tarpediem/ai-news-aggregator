import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Newspaper, Brain, RefreshCw, Github, Moon, Sun, Sparkles, Zap, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { AIEnhancedNewsCard } from './components/AIEnhancedNewsCard';
import { ArxivCard } from './components/ArxivCard';
import { CategoryFilter } from './components/CategoryFilter';
import { SearchBar } from './components/SearchBar';
import { LoadingState } from './components/SkeletonLoader';
import { TrendingTopics } from './components/TrendingTopics';
import { useNews, useArxivPapers, useSearchNews, useRefreshNews } from './hooks/useNews';
import { cn } from './lib/utils';
import type { NewsCategory } from './types/news';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// NUCLEAR OPTION: Ultra-minimal version without store subscriptions
console.log('🚨 NUCLEAR MODE: All complex features disabled to prevent infinite loops');

function AppContent() {
  // NUCLEAR SIMPLIFICATION: Minimal state only
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // NUCLEAR: Disable ALL complex features
  const showSettings = false;
  const useVirtualization = false;
  const enableAISummary = false;
  
  // SIMPLIFIED: Remove all complex refs
  const darkModeInitialized = useRef(false);

  // Use news hooks
  const { data: newsData, isLoading: newsLoading, error: newsError } = useNews(
    selectedCategory || undefined
  );
  const { data: papersData, isLoading: papersLoading, error: papersError } = useArxivPapers('artificial intelligence');
  const { data: searchResults, isLoading: searchLoading } = useSearchNews(searchQuery);
  const refreshNews = useRefreshNews();

  // NUCLEAR SIMPLIFICATION: Ultra-simple handlers
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleTopicClick = (topic: string) => {
    setSearchQuery(topic);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    console.log(`🌓 Toggle dark mode: ${isDarkMode} → ${newDarkMode}`);
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
  };

  // NUCLEAR SIMPLIFICATION: Ultra-simple dark mode initialization
  useEffect(() => {
    if (darkModeInitialized.current) return;
    darkModeInitialized.current = true;
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  const displayData = searchQuery ? searchResults : newsData;
  
  // NUCLEAR: Remove circuit breaker completely

  return (
    <div className="nuclear-mode min-h-screen relative bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 text-slate-900 dark:text-slate-100">
      {/* NUCLEAR: Disable AccessibilityProvider completely */}
        {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-400/10 to-blue-600/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}} />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Glassmorphism Header */}
        <header className="mb-12">
          <div className="backdrop-blur-xl bg-white/20 dark:bg-slate-900/20 border border-white/20 dark:border-slate-700/20 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-75 animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl">
                    <Brain className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
                    AI News Hub
                  </h1>
                  <p className="text-slate-600 dark:text-slate-300 text-lg flex items-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Latest AI news and research papers</span>
                  </p>
                </div>
              </div>
            
              <div className="flex items-center space-x-4">
                {/* NUCLEAR: Development toggles disabled */}
                
                <button
                  onClick={toggleDarkMode}
                  className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300"
                >
                  {isDarkMode ? 
                    <Sun className="w-5 h-5 text-yellow-500" /> : 
                    <Moon className="w-5 h-5 text-slate-600" />
                  }
                </button>
              
                <button 
                  onClick={handleRefresh}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              
                <button
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-500 text-white rounded-xl cursor-not-allowed"
                  disabled
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings (Disabled)</span>
                </button>
                
                <button
                  onClick={() => window.open('https://github.com', '_blank')}
                  className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <SearchBar onSearch={handleSearch} className="mb-8" />

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-2 p-2 bg-white/10 dark:bg-slate-800/20 backdrop-blur-sm rounded-2xl border border-white/20 mb-8">
              <button
                onClick={() => setActiveTab('news')}
                className={cn(
                  "relative flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105",
                  activeTab === 'news' 
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg" 
                    : "text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-slate-700/30"
                )}
              >
                {activeTab === 'news' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-50" />
                )}
                <Newspaper className="w-4 h-4 relative z-10" />
                <span className="relative z-10">News</span>
                {activeTab === 'news' && <Zap className="w-3 h-3 relative z-10 animate-pulse" />}
              </button>
              
              <button
                onClick={() => setActiveTab('papers')}
                className={cn(
                  "relative flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105",
                  activeTab === 'papers' 
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg" 
                    : "text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-slate-700/30"
                )}
              >
                {activeTab === 'papers' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-50" />
                )}
                <Brain className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Research Papers</span>
                {activeTab === 'papers' && <Sparkles className="w-3 h-3 relative z-10 animate-pulse" />}
              </button>
            </div>

            {/* Category Filter - Only for news */}
            {activeTab === 'news' && (
              <CategoryFilter 
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                className="mb-8"
              />
            )}

            {/* Trending Topics */}
            <TrendingTopics onTopicClick={handleTopicClick} className="mb-8" />
          </div>
        </header>

        {/* Content */}
        <main id="main-content" role="main" aria-label="News and research content">
          {activeTab === 'news' ? (
            <LoadingState
              isLoading={newsLoading || searchLoading}
              hasContent={!!(displayData && displayData.length > 0)}
              error={newsError ? 'Error loading news. Please try again.' : null}
              skeletonCount={6}
              skeletonColumns={3}
              skeletonType="news"
              emptyMessage="No news articles found."
              emptyIcon="📰"
            >
              {displayData && displayData.length > 0 && (
                useVirtualization && displayData.length > 12 ? (
                  // Use virtualized list for large datasets (>12 items)
                  <VirtualizedNewsList
                    articles={displayData}
                    itemsPerRow={itemsPerRow}
                    containerHeight={containerHeight}
                    onArticleClick={(article) => window.open(article.url, '_blank', 'noopener,noreferrer')}
                    showPerformanceMetrics={process.env.NODE_ENV === 'development'}
                    className="rounded-2xl overflow-hidden"
                  />
                ) : (
                  // NUCLEAR: Simple grid without complex features
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {displayData.map((article, index) => (
                      <AIEnhancedNewsCard 
                        key={article.id}
                        article={article} 
                        priority={false}
                        lazy={false}
                        enableAISummary={false}
                      />
                    ))}
                  </div>
                )
              )}
            </LoadingState>
          ) : (
            <LoadingState
              isLoading={papersLoading}
              hasContent={!!(papersData && papersData.length > 0)}
              error={papersError ? 'Error loading papers. Please try again.' : null}
              skeletonCount={4}
              skeletonColumns={2}
              skeletonType="arxiv"
              emptyMessage="No research papers found."
              emptyIcon="📚"
            >
              {papersData && papersData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {papersData.map((paper) => (
                    <ArxivCard key={paper.id} paper={paper} />
                  ))}
                </div>
              )}
            </LoadingState>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700" role="contentinfo">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p>Built with React, TypeScript, and Magic UI</p>
            <p className="mt-2">Aggregating AI news with OpenRouter integration</p>
          </div>
        </footer>
      </div>
      
      {/* NUCLEAR: Settings completely disabled */}
    </div>
  );
}

function App() {
  console.log('🎪 App component rendering in NUCLEAR MODE...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;