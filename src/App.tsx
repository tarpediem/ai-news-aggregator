import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Newspaper, Brain, RefreshCw, Github, Moon, Sun, Sparkles, Zap, Settings } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

import { useCircuitBreaker } from './utils/circuitBreaker';

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

// Initialize store subscriptions with loop protection
let subscriptionsInitialized = false;
if (!subscriptionsInitialized && typeof window !== 'undefined') {
  try {
    import('./store/AppStore').then(({ setupStoreSubscriptions }) => {
      setupStoreSubscriptions();
      subscriptionsInitialized = true;
      console.log('✅ Store subscriptions initialized with loop protection');
    });
  } catch (error) {
    console.warn('Failed to setup store subscriptions:', error);
  }
}

function AppContent() {
  // Circuit breaker protection
  const shouldRender = useCircuitBreaker('AppContent');
  
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [useVirtualization, setUseVirtualization] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [enableAISummary] = useState(true);
  
  // Use refs to prevent stale closures and unnecessary re-renders
  const darkModeInitialized = useRef(false);
  const lastSearchQuery = useRef('');
  
  // Responsive grid configuration
  const { itemsPerRow, containerHeight } = useResponsiveGrid();

  // Use news hooks
  const { data: newsData, isLoading: newsLoading, error: newsError } = useNews(
    selectedCategory || undefined
  );
  const { data: papersData, isLoading: papersLoading, error: papersError } = useArxivPapers('artificial intelligence');
  const { data: searchResults, isLoading: searchLoading } = useSearchNews(searchQuery);
  const refreshNews = useRefreshNews();

  // Memoized handlers to prevent unnecessary re-renders
  const handleSearch = useCallback((query: string) => {
    // Prevent duplicate search queries
    if (lastSearchQuery.current === query) {
      console.log('🔍 Search query unchanged, skipping update');
      return;
    }
    
    console.log(`🔍 Search query: "${lastSearchQuery.current}" → "${query}"`);
    lastSearchQuery.current = query;
    setSearchQuery(query);
  }, []);

  const handleTopicClick = useCallback((topic: string) => {
    console.log(`📌 Topic clicked: ${topic}`);
    handleSearch(topic);
  }, [handleSearch]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 Refreshing news...');
    refreshNews();
  }, [refreshNews]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(current => {
      const newDarkMode = !current;
      console.log(`🌓 Toggle dark mode: ${current} → ${newDarkMode}`);
      
      document.documentElement.classList.toggle('dark', newDarkMode);
      localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
      
      return newDarkMode;
    });
  }, []);

  // Initialize dark mode from localStorage - ONCE ONLY with ref protection
  useEffect(() => {
    if (darkModeInitialized.current) {
      console.warn('🚫 Dark mode already initialized, preventing duplicate initialization');
      return;
    }
    
    console.log('🌓 Initializing dark mode from localStorage');
    darkModeInitialized.current = true;
    
    try {
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode) {
        const isDark = JSON.parse(savedDarkMode);
        console.log(`💾 Loaded dark mode from storage: ${isDark}`);
        
        // Use callback to prevent state update if already correct
        setIsDarkMode(currentMode => {
          if (currentMode === isDark) {
            console.log('🔄 Dark mode already correct, skipping update');
            return currentMode;
          }
          
          console.log(`🌓 Setting dark mode: ${currentMode} → ${isDark}`);
          document.documentElement.classList.toggle('dark', isDark);
          return isDark;
        });
      } else {
        console.log('🆕 No saved dark mode, using default (light)');
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error('❌ Error initializing dark mode:', error);
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []); // Empty dependency array - run ONCE only

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
  
  // Circuit breaker protection
  if (!shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🛑</div>
          <h2 className="text-xl font-bold text-red-800 mb-2">Infinite Loop Protection Active</h2>
          <p className="text-red-600 mb-4">The app has been temporarily disabled to prevent crashes.</p>
          <p className="text-red-500 text-sm">This will automatically resolve in a few seconds.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

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
  const shouldRender = useCircuitBreaker('App');
  
  console.log('🎪 App component rendering...');
  
  if (!shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">App Temporarily Disabled</h1>
          <p className="text-gray-600">Infinite loop protection is active.</p>
        </div>
      </div>
    );
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;