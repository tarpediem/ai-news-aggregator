import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Newspaper, Brain, RefreshCw, Github, Moon, Sun, Sparkles, Zap, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

import { AccessibilityProvider, SkipToContent } from './components/AccessibilityProvider';
import { AIEnhancedNewsCard } from './components/AIEnhancedNewsCard';
import { ArxivCard } from './components/ArxivCard';
import { CategoryFilter } from './components/CategoryFilter';
import { SearchBar } from './components/SearchBar';
import SettingsPanel from './components/SettingsPanel';
import { LoadingState } from './components/SkeletonLoader';
import { TrendingTopics } from './components/TrendingTopics';
import { InteractiveHoverButton } from './components/ui/interactive-hover-button';
import { ShimmerButton } from './components/ui/shimmer-button';
import { VirtualizedNewsList, useResponsiveGrid } from './components/VirtualizedNewsList';
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

// Temporarily disable store subscriptions to prevent infinite loops
// TODO: Re-enable once we verify the main app works without loops
// let subscriptionsInitialized = false;
// if (!subscriptionsInitialized && typeof window !== 'undefined') {
//   try {
//     setupStoreSubscriptions();
//     subscriptionsInitialized = true;
//   } catch (error) {
//     console.warn('Failed to setup store subscriptions:', error);
//   }
// }

function AppContent() {
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [useVirtualization, setUseVirtualization] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [enableAISummary] = useState(true);
  
  // Responsive grid configuration
  const { itemsPerRow, containerHeight } = useResponsiveGrid();

  // Use news hooks
  const { data: newsData, isLoading: newsLoading, error: newsError } = useNews(
    selectedCategory || undefined
  );
  const { data: papersData, isLoading: papersLoading, error: papersError } = useArxivPapers('artificial intelligence');
  const { data: searchResults, isLoading: searchLoading } = useSearchNews(searchQuery);
  const refreshNews = useRefreshNews();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleTopicClick = (topic: string) => {
    setSearchQuery(topic);
  };

  const handleRefresh = () => {
    refreshNews();
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
  };

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      try {
        const isDark = JSON.parse(savedDarkMode);
        if (isDark !== isDarkMode) { // Only update if different to prevent loops
          setIsDarkMode(isDark);
          document.documentElement.classList.toggle('dark', isDark);
        }
      } catch {
        // Ignore parsing errors and set default
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
      }
    }
  }, []); // Only run once on mount

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

  return (
    <AccessibilityProvider>
      <SkipToContent />
      <div className={cn(
        "min-h-screen relative",
        "bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100",
        "dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900",
        "text-slate-900 dark:text-slate-100",
        isDarkMode && "dark"
      )}
      role="application"
      aria-label="AI News Aggregator"
      >
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
                {/* Development toggles */}
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={() => setUseVirtualization(!useVirtualization)}
                    className={cn(
                      "group relative p-3 rounded-xl backdrop-blur-sm border border-white/10 transition-all duration-300 hover:scale-105",
                      useVirtualization 
                        ? "bg-green-500/20 hover:bg-green-500/30" 
                        : "bg-white/10 hover:bg-white/20 dark:bg-slate-800/50 dark:hover:bg-slate-700/50"
                    )}
                    title={`Virtualization: ${useVirtualization ? 'ON' : 'OFF'}`}
                  >
                    <Zap className={cn(
                      "w-5 h-5 transition-all duration-300",
                      useVirtualization 
                        ? "text-green-400" 
                        : "text-slate-600 dark:text-slate-300"
                    )} />
                  </button>
                )}
                
                <button
                  onClick={toggleDarkMode}
                  className="group relative p-3 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                  {isDarkMode ? 
                    <Sun className="w-5 h-5 text-yellow-500 group-hover:rotate-180 transition-transform duration-500" /> : 
                    <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:rotate-12 transition-transform duration-300" />
                  }
                </button>
              
                <ShimmerButton 
                  onClick={handleRefresh}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 hover:scale-105"
                  shimmerColor="#ffffff"
                  background="linear-gradient(45deg, #3b82f6, #8b5cf6)"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </ShimmerButton>
              
                <InteractiveHoverButton
                  onClick={() => setShowSettings(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:scale-105"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </InteractiveHoverButton>
                
                <InteractiveHoverButton
                  onClick={() => window.open('https://github.com', '_blank')}
                  className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:scale-105"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                </InteractiveHoverButton>
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
                  // Use regular grid for smaller datasets
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {displayData.map((article, index) => (
                      <div 
                        key={article.id} 
                        className="animate-fade-in"
                        style={{ animationDelay: `${Math.min(index * 50, 1000)}ms` }} // Cap animation delay
                      >
                        <AIEnhancedNewsCard 
                          article={article} 
                          priority={index < 6} 
                          lazy={index >= 6}
                          enableAISummary={enableAISummary}
                        />
                      </div>
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
                  {papersData.map((paper, index) => (
                    <div 
                      key={paper.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <ArxivCard paper={paper} />
                    </div>
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
      
      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
    </AccessibilityProvider>
  );
}

function App() {
  console.log('🎪 App component rendering...');
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;