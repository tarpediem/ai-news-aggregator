import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Newspaper, Brain, RefreshCw, Github, Moon, Sun, Sparkles, Zap, Settings } from 'lucide-react';
import { useState, useRef } from 'react';

import { AIEnhancedNewsCard } from './components/AIEnhancedNewsCard';
import { ArxivCard } from './components/ArxivCard';
import { CategoryFilter } from './components/CategoryFilter';
import { SearchBar } from './components/SearchBar';
import { LoadingState } from './components/SkeletonLoader';
import { TrendingTopics } from './components/TrendingTopics';
import SettingsPanel from './components/SettingsPanel';
import AccessibilityProvider, { SkipToContent } from './components/AccessibilityProvider';
import PerformanceMonitor from './components/PerformanceMonitor';
import { SafePageErrorBoundary, SafeComponentErrorBoundary } from './components/SafeErrorBoundary';
import { useNews, useArxivPapers, useSearchNews, useRefreshNews } from './hooks/useNews';
import { useSafeEffect } from './hooks/useSafeEffect';
import { useSafeCallback } from './hooks/useSafeCallback';
import { useSafeMemo } from './hooks/useSafeMemo';
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

// PHASE 2: Enhanced UI - Full features restored with safe patterns
console.log('🚀 PHASE 2: Enhanced UI and Features - Full functionality restored with safety measures');

function AppContent() {
  // ENHANCED: Full state management with safety
  const [activeTab, setActiveTab] = useState<'news' | 'papers'>('news');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'source'>('relevance');
  const [layout, setLayout] = useState<'grid' | 'list' | 'compact'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // ENHANCED: Enable advanced features with safe patterns
  const useVirtualization = false; // Will enable later if needed
  const enableAISummary = true; // Enhanced AI summaries
  const enableAdvancedSearch = true; // Enhanced search features
  
  // SIMPLIFIED: Remove all complex refs
  const darkModeInitialized = useRef(false);

  // Use news hooks
  const { data: newsData, isLoading: newsLoading, error: newsError } = useNews(
    selectedCategory || undefined
  );
  const { data: papersData, isLoading: papersLoading, error: papersError } = useArxivPapers('artificial intelligence');
  const { data: searchResults, isLoading: searchLoading } = useSearchNews(searchQuery);
  const refreshNews = useRefreshNews();

  // SAFE HANDLERS: Using useSafeCallback to prevent infinite loops
  const [handleSearch] = useSafeCallback((query: string) => {
    setSearchQuery(query);
  }, [], {
    callbackId: 'handleSearch',
    maxExecutionsPerSecond: 10
  });

  const [handleTopicClick] = useSafeCallback((topic: string) => {
    setSearchQuery(topic);
  }, [], {
    callbackId: 'handleTopicClick',
    maxExecutionsPerSecond: 5
  });

  const [handleRefresh] = useSafeCallback(() => {
    window.location.reload();
  }, [], {
    callbackId: 'handleRefresh',
    maxExecutionsPerSecond: 1
  });

  const [toggleDarkMode] = useSafeCallback(() => {
    const newDarkMode = !isDarkMode;
    console.log(`🌓 Toggle dark mode: ${isDarkMode} → ${newDarkMode}`);
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
  }, [isDarkMode], {
    callbackId: 'toggleDarkMode',
    maxExecutionsPerSecond: 2
  });

  // SAFE EFFECTS: Using useSafeEffect to prevent loops
  useSafeEffect(() => {
    if (darkModeInitialized.current) return;
    darkModeInitialized.current = true;
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, [], {
    effectId: 'darkModeInitialization',
    maxExecutionsPerSecond: 1
  });

  // Safe service worker registration
  useSafeEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, [], {
    effectId: 'serviceWorkerRegistration',
    maxExecutionsPerSecond: 1
  });

  // ENHANCED: Real news data with fallback support
  const fallbackNewsData = [
    {
      id: 'fallback-1',
      title: 'AI News Hub - Loading Latest Updates',
      description: 'Fetching the latest AI news from multiple sources. This may take a moment as we gather the most recent articles from OpenAI, Google AI, Anthropic, and other leading AI research organizations.',
      url: '#',
      publishedAt: new Date().toISOString(),
      source: { id: 'system', name: 'AI News Hub', url: 'system' },
      category: 'artificial-intelligence' as NewsCategory,
      tags: ['Loading', 'AI News', 'Updates'],
      imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80'
    }
  ];

  // ENHANCED MEMO: Smart data selection with real news priority
  const [displayData] = useSafeMemo(() => {
    // Priority: search results > real news data > fallback
    if (searchQuery && searchResults?.length > 0) {
      return searchResults;
    }
    if (newsData && newsData.length > 0) {
      return newsData;
    }
    // Only show fallback if we're actively loading and have no data
    return newsLoading ? fallbackNewsData : [];
  }, [searchQuery, searchResults, newsData, newsLoading, fallbackNewsData], {
    memoId: 'displayData',
    maxComputationsPerSecond: 10
  });
  
  // NUCLEAR: Remove circuit breaker completely

  return (
    <SafeComponentErrorBoundary componentId="app-content">
      <div className="safe-mode min-h-screen relative bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 text-slate-900 dark:text-slate-100">
        {/* SAFE: Protected with error boundaries */}
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
                {/* ENHANCED: Settings panel enabled */}
                
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
                  onClick={() => setShowSettings(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
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

            {/* Enhanced Search Bar with Advanced Features */}
            <SearchBar 
              onSearch={handleSearch} 
              showAdvancedFilters={enableAdvancedSearch}
              recentSearches={[]} // Will be populated from store later
              className="mb-8" 
            />

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

            {/* Category Filter and Controls - Only for news */}
            {activeTab === 'news' && (
              <div className="space-y-6 mb-8">
                <CategoryFilter 
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
                
                {/* Sort and Layout Controls */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-4">
                    {/* Sort Options */}
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Sort by:
                      </span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-1.5 text-sm border border-white/20 dark:border-slate-700/20 rounded-lg bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="relevance">🎯 Relevance</option>
                        <option value="date">📅 Date</option>
                        <option value="source">📰 Source</option>
                      </select>
                    </div>
                    
                    {/* Results Count */}
                    {displayData && displayData.length > 0 && (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {displayData.length} articles
                        {selectedCategory && (
                          <span className="ml-1">
                            in {selectedCategory.replace('-', ' ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {/* Layout Toggle */}
                    <div className="flex items-center space-x-1 p-1 bg-white/20 dark:bg-slate-800/20 rounded-lg backdrop-blur-sm">
                      {[
                        { value: 'grid', icon: '⊞', label: 'Grid' },
                        { value: 'list', icon: '📄', label: 'List' },
                        { value: 'compact', icon: '☰', label: 'Compact' }
                      ].map(({ value, icon, label }) => (
                        <button
                          key={value}
                          onClick={() => setLayout(value as any)}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 flex items-center space-x-1",
                            layout === value
                              ? "bg-blue-600 text-white shadow-lg"
                              : "text-slate-600 dark:text-slate-400 hover:bg-white/20 dark:hover:bg-slate-700/20"
                          )}
                          title={label}
                        >
                          <span>{icon}</span>
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                    
                    {/* Filters Toggle */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={cn(
                        "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                        showFilters
                          ? "bg-blue-600 text-white shadow-lg"
                          : "bg-white/20 dark:bg-slate-800/20 text-slate-700 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-slate-700/30 backdrop-blur-sm"
                      )}
                    >
                      <span className="text-sm">Filters</span>
                      {showFilters && <span className="text-xs">✓</span>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Trending Topics */}
            <TrendingTopics onTopicClick={handleTopicClick} className="mb-8" />
          </div>
        </header>

        {/* Content */}
        <main id="main-content" role="main" aria-label="News and research content">
          <SafeComponentErrorBoundary componentId="main-content">
            {activeTab === 'news' ? (
              <SafeComponentErrorBoundary componentId="news-content">
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
                    // ENHANCED: Dynamic layout with safe patterns
                    <div className={cn(
                      "gap-6",
                      layout === 'grid' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                      layout === 'list' && "space-y-6",
                      layout === 'compact' && "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    )}>
                      {displayData
                        .sort((a, b) => {
                          switch (sortBy) {
                            case 'date':
                              return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
                            case 'source':
                              return a.source.name.localeCompare(b.source.name);
                            case 'relevance':
                            default:
                              return (b.relevanceScore || 0) - (a.relevanceScore || 0);
                          }
                        })
                        .map((article, index) => (
                        <SafeComponentErrorBoundary 
                          key={article.id} 
                          componentId={`news-card-${article.id}`}
                        >
                          <div 
                            className={cn(
                              "transform transition-all duration-300 hover:scale-[1.02]",
                              layout === 'compact' && "scale-90"
                            )}
                            style={{
                              animationDelay: `${index * 50}ms`
                            }}
                          >
                            <AIEnhancedNewsCard 
                              article={article} 
                              priority={index < 3}
                              lazy={index > 6}
                              enableAISummary={enableAISummary && layout !== 'compact'}
                            />
                          </div>
                        </SafeComponentErrorBoundary>
                      ))}
                    </div>
                  )}
                </LoadingState>
              </SafeComponentErrorBoundary>
            ) : (
              <SafeComponentErrorBoundary componentId="papers-content">
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
                        <SafeComponentErrorBoundary 
                          key={paper.id} 
                          componentId={`arxiv-card-${paper.id}`}
                        >
                          <ArxivCard paper={paper} />
                        </SafeComponentErrorBoundary>
                      ))}
                    </div>
                  )}
                </LoadingState>
              </SafeComponentErrorBoundary>
            )}
          </SafeComponentErrorBoundary>
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700" role="contentinfo">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p>Built with React, TypeScript, and Magic UI</p>
            <p className="mt-2">Aggregating AI news with OpenRouter integration</p>
          </div>
        </footer>
      </div>
      
        {/* Enhanced Settings Panel */}
        <SafeComponentErrorBoundary componentId="settings-panel-wrapper">
          <SettingsPanel 
            isOpen={showSettings} 
            onClose={() => setShowSettings(false)} 
          />
        </SafeComponentErrorBoundary>
        
        {/* Performance Monitor (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <PerformanceMonitor showDetails={false} />
        )}
      
      {/* SAFE: All components protected by error boundaries */}
      </div>
    </SafeComponentErrorBoundary>
  );
}

function App() {
  console.log('🛡️ App component rendering in SAFE MODE with loop prevention...');
  
  return (
    <SafePageErrorBoundary pageId="ai-news-app">
      <QueryClientProvider client={queryClient}>
        <AccessibilityProvider>
          <SkipToContent />
          <AppContent />
        </AccessibilityProvider>
      </QueryClientProvider>
    </SafePageErrorBoundary>
  );
}

export default App;