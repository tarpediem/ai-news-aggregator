/**
 * Enhanced AppStore with Bulletproof Loop Prevention
 * 
 * Features:
 * - Complete news article management with caching and search
 * - User preferences with intelligent persistence
 * - UI state management with performance optimization
 * - Auto-refresh with configurable intervals and backoff
 * - Circuit breaker protection against infinite loops
 * - Real-time updates with rate limiting
 * - Emergency recovery and state validation
 * - Performance monitoring and analytics
 */

import { create } from 'zustand';
import { persist, devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { NewsArticle, ArxivPaper, NewsCategory, NewsFilters } from '../types/news';
import { newsService } from '../services/newsService';
import { createStoreCircuitBreaker, registerCircuitBreaker } from '../utils/storeCircuitBreaker';

// Circuit breaker instance for this store
const storeCircuitBreaker = createStoreCircuitBreaker<AppState>({
  maxUpdatesPerSecond: 30,
  maxUpdatesPerMinute: 500,
  comparisonDepth: 4,
  resetTimeoutMs: 10000,
  warningThreshold: 20,
  emergencyThreshold: 50
});

registerCircuitBreaker('appStore', storeCircuitBreaker);

// ============================================================================
// STATE INTERFACES
// ============================================================================

interface NewsState {
  articles: NewsArticle[];
  papers: ArxivPaper[];
  filteredArticles: NewsArticle[];
  loading: boolean;
  error: string | null;
  filters: NewsFilters;
  lastUpdated: Date | null;
  searchQuery: string;
  searchResults: NewsArticle[];
  isSearching: boolean;
  cache: Map<string, { data: NewsArticle[]; timestamp: number }>;
  autoRefreshEnabled: boolean;
  refreshInterval: number;
  nextRefresh: Date | null;
}

interface UserState {
  preferences: {
    defaultCategory: NewsCategory | 'all';
    articlesPerPage: number;
    autoRefresh: boolean;
    refreshInterval: number;
    compactView: boolean;
    darkMode: boolean;
    notifications: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    saveReadingProgress: boolean;
    showTrendingTopics: boolean;
    enableOfflineMode: boolean;
  };
  bookmarks: string[];
  readArticles: string[];
  searchHistory: string[];
  visitedSources: string[];
  readingProgress: Record<string, number>;
  personalizedTopics: string[];
  blockedSources: string[];
  favoriteAuthors: string[];
}

interface UIState {
  sidebar: {
    isOpen: boolean;
    isPinned: boolean;
    width: number;
    collapsed: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  layout: 'grid' | 'list' | 'compact' | 'masonry';
  sortBy: 'relevance' | 'date' | 'source' | 'popularity';
  sortOrder: 'asc' | 'desc';
  showThumbnails: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  density: 'comfortable' | 'compact' | 'spacious';
  showFilters: boolean;
  showCategories: boolean;
  fullscreenMode: boolean;
  readerMode: boolean;
  animations: boolean;
}

interface AppMetrics {
  totalPageViews: number;
  sessionStartTime: Date;
  lastActiveTime: Date;
  totalReadingTime: number;
  averageReadingSpeed: number;
  mostReadCategories: Record<NewsCategory, number>;
  searchFrequency: Record<string, number>;
  performanceScore: number;
  errorCount: number;
  crashCount: number;
}

interface AppState extends NewsState, UserState, UIState {
  // Meta state
  isInitialized: boolean;
  version: string;
  metrics: AppMetrics;
  
  // News Actions
  fetchNews: (category?: NewsCategory, options?: { force?: boolean; progressive?: boolean }) => Promise<void>;
  fetchArxivPapers: (query?: string) => Promise<void>;
  searchNews: (query: string) => Promise<void>;
  clearSearch: () => void;
  applyFilters: (filters: Partial<NewsFilters>) => void;
  clearFilters: () => void;
  refreshNews: (force?: boolean) => Promise<void>;
  
  // Article Actions  
  getArticleById: (id: string) => NewsArticle | undefined;
  getArticlesByCategory: (category: NewsCategory) => NewsArticle[];
  getBookmarkedArticles: () => NewsArticle[];
  getUnreadArticles: () => NewsArticle[];
  getRecentArticles: (hours?: number) => NewsArticle[];
  
  // User Actions
  updatePreferences: (preferences: Partial<UserState['preferences']>) => void;
  addBookmark: (articleId: string) => void;
  removeBookmark: (articleId: string) => void;
  toggleBookmark: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
  markAsRead: (articleId: string) => void;
  markAsUnread: (articleId: string) => void;
  isRead: (articleId: string) => boolean;
  updateReadingProgress: (articleId: string, progress: number) => void;
  getReadingProgress: (articleId: string) => number;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  blockSource: (sourceId: string) => void;
  unblockSource: (sourceId: string) => void;
  addFavoriteAuthor: (author: string) => void;
  removeFavoriteAuthor: (author: string) => void;
  addPersonalizedTopic: (topic: string) => void;
  removePersonalizedTopic: (topic: string) => void;
  
  // UI Actions
  toggleSidebar: () => void;
  setSidebarPinned: (isPinned: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLayout: (layout: 'grid' | 'list' | 'compact' | 'masonry') => void;
  setSortBy: (sortBy: 'relevance' | 'date' | 'source' | 'popularity') => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setShowThumbnails: (show: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large' | 'xl') => void;
  setDensity: (density: 'comfortable' | 'compact' | 'spacious') => void;
  toggleFilters: () => void;
  toggleCategories: () => void;
  setFullscreenMode: (enabled: boolean) => void;
  setReaderMode: (enabled: boolean) => void;
  setAnimations: (enabled: boolean) => void;
  
  // Auto-refresh Actions
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  setRefreshInterval: (intervalMs: number) => void;
  getTimeUntilNextRefresh: () => number;
  
  // Analytics Actions
  trackPageView: (page: string) => void;
  trackReadingTime: (articleId: string, timeMs: number) => void;
  trackSearch: (query: string) => void;
  updatePerformanceScore: (score: number) => void;
  
  // Utility Actions
  exportData: () => string;
  importData: (data: string) => Promise<boolean>;
  reset: () => void;
  resetToDefaults: () => void;
  validateState: () => boolean;
  getStats: () => {
    totalArticles: number;
    bookmarkedArticles: number;
    readArticles: number;
    sourcesVisited: number;
    averageReadingTime: number;
    topCategories: Array<{ category: NewsCategory; count: number }>;
    recentActivity: Array<{ action: string; timestamp: Date; details: any }>;
  };
  
  // Emergency Actions
  emergencyReset: () => void;
  forceRefresh: () => Promise<void>;
  clearCache: () => void;
  repairState: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialNewsState: NewsState = {
  articles: [],
  papers: [],
  filteredArticles: [],
  loading: false,
  error: null,
  filters: {},
  lastUpdated: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  cache: new Map(),
  autoRefreshEnabled: false,
  refreshInterval: 300000, // 5 minutes
  nextRefresh: null,
};

const initialUserState: UserState = {
  preferences: {
    defaultCategory: 'all',
    articlesPerPage: 20,
    autoRefresh: false,
    refreshInterval: 300000,
    compactView: false,
    darkMode: false,
    notifications: false,
    emailNotifications: false,
    pushNotifications: false,
    saveReadingProgress: true,
    showTrendingTopics: true,
    enableOfflineMode: false,
  },
  bookmarks: [],
  readArticles: [],
  searchHistory: [],
  visitedSources: [],
  readingProgress: {},
  personalizedTopics: [],
  blockedSources: [],
  favoriteAuthors: [],
};

const initialUIState: UIState = {
  sidebar: {
    isOpen: false,
    isPinned: false,
    width: 280,
    collapsed: false,
  },
  theme: 'system',
  layout: 'list',
  sortBy: 'relevance',
  sortOrder: 'desc',
  showThumbnails: true,
  fontSize: 'medium',
  density: 'comfortable',
  showFilters: false,
  showCategories: true,
  fullscreenMode: false,
  readerMode: false,
  animations: true,
};

const initialAppMetrics: AppMetrics = {
  totalPageViews: 0,
  sessionStartTime: new Date(),
  lastActiveTime: new Date(),
  totalReadingTime: 0,
  averageReadingSpeed: 250, // words per minute
  mostReadCategories: {} as Record<NewsCategory, number>,
  searchFrequency: {},
  performanceScore: 1.0,
  errorCount: 0,
  crashCount: 0,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          ...initialNewsState,
          ...initialUserState,
          ...initialUIState,
          isInitialized: false,
          version: '2.0.0',
          metrics: initialAppMetrics,

          // ================================================================
          // NEWS ACTIONS
          // ================================================================
          
          fetchNews: storeCircuitBreaker.protectSetter(
            async (category?: NewsCategory, options = {}) => {
              const state = get();
              const { force = false, progressive = false } = options;
              
              // Check cache first
              const cacheKey = `news-${category || 'all'}`;
              const cached = state.cache.get(cacheKey);
              const now = Date.now();
              
              if (!force && cached && (now - cached.timestamp) < 300000) { // 5 minutes
                set((draft) => {
                  draft.articles = cached.data;
                  draft.filteredArticles = applyFiltersToArticles(cached.data, draft.filters);
                  draft.loading = false;
                });
                return;
              }
              
              set((draft) => {
                draft.loading = true;
                draft.error = null;
              });
              
              try {
                const articles = await newsService.fetchNews(category, { progressive });
                
                set((draft) => {
                  draft.articles = articles;
                  draft.filteredArticles = applyFiltersToArticles(articles, draft.filters);
                  draft.loading = false;
                  draft.lastUpdated = new Date();
                  draft.error = null;
                  
                  // Update cache
                  draft.cache.set(cacheKey, {
                    data: articles,
                    timestamp: now
                  });
                  
                  // Update visited sources
                  articles.forEach(article => {
                    if (!draft.visitedSources.includes(article.source.id)) {
                      draft.visitedSources.push(article.source.id);
                    }
                  });
                });
                
              } catch (error: any) {
                set((draft) => {
                  draft.loading = false;
                  draft.error = error.message || 'Failed to fetch news';
                  draft.metrics.errorCount++;
                });
              }
            },
            'fetchNews'
          ),

          fetchArxivPapers: storeCircuitBreaker.protectSetter(
            async (query = 'artificial intelligence') => {
              set((draft) => {
                draft.loading = true;
                draft.error = null;
              });
              
              try {
                const papers = await newsService.fetchArxivPapers(query);
                set((draft) => {
                  draft.papers = papers;
                  draft.loading = false;
                });
              } catch (error: any) {
                set((draft) => {
                  draft.loading = false;
                  draft.error = error.message || 'Failed to fetch papers';
                  draft.metrics.errorCount++;
                });
              }
            },
            'fetchArxivPapers'
          ),

          searchNews: storeCircuitBreaker.protectSetter(
            async (query: string) => {
              if (!query.trim()) {
                get().clearSearch();
                return;
              }
              
              set((draft) => {
                draft.isSearching = true;
                draft.searchQuery = query;
                draft.error = null;
              });
              
              try {
                const results = await newsService.searchNews(query);
                set((draft) => {
                  draft.searchResults = results;
                  draft.isSearching = false;
                });
                
                get().addToSearchHistory(query);
                get().trackSearch(query);
                
              } catch (error: any) {
                set((draft) => {
                  draft.isSearching = false;
                  draft.error = error.message || 'Search failed';
                  draft.metrics.errorCount++;
                });
              }
            },
            'searchNews'
          ),

          clearSearch: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.searchQuery = '';
              draft.searchResults = [];
              draft.isSearching = false;
            });
          }, 'clearSearch'),

          applyFilters: storeCircuitBreaker.protectSetter((filters: Partial<NewsFilters>) => {
            set((draft) => {
              draft.filters = { ...draft.filters, ...filters };
              draft.filteredArticles = applyFiltersToArticles(draft.articles, draft.filters);
            });
          }, 'applyFilters'),

          clearFilters: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.filters = {};
              draft.filteredArticles = draft.articles;
            });
          }, 'clearFilters'),

          refreshNews: storeCircuitBreaker.protectSetter(
            async (force = false) => {
              const state = get();
              await get().fetchNews(
                state.filters.category || state.preferences.defaultCategory !== 'all' 
                  ? state.preferences.defaultCategory as NewsCategory 
                  : undefined,
                { force }
              );
            },
            'refreshNews'
          ),

          // ================================================================
          // ARTICLE ACTIONS
          // ================================================================

          getArticleById: (id: string) => {
            const state = get();
            return state.articles.find(article => article.id === id) ||
                   state.searchResults.find(article => article.id === id);
          },

          getArticlesByCategory: (category: NewsCategory) => {
            return get().articles.filter(article => article.category === category);
          },

          getBookmarkedArticles: () => {
            const state = get();
            return state.articles.filter(article => state.bookmarks.includes(article.id));
          },

          getUnreadArticles: () => {
            const state = get();
            return state.articles.filter(article => !state.readArticles.includes(article.id));
          },

          getRecentArticles: (hours = 24) => {
            const state = get();
            const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
            return state.articles.filter(article => 
              new Date(article.publishedAt) > cutoff
            );
          },

          // ================================================================
          // USER ACTIONS
          // ================================================================

          updatePreferences: storeCircuitBreaker.protectSetter(
            (preferences: Partial<UserState['preferences']>) => {
              set((draft) => {
                draft.preferences = { ...draft.preferences, ...preferences };
                
                // Handle auto-refresh preference change
                if ('autoRefresh' in preferences) {
                  if (preferences.autoRefresh) {
                    draft.autoRefreshEnabled = true;
                    draft.nextRefresh = new Date(Date.now() + draft.refreshInterval);
                  } else {
                    draft.autoRefreshEnabled = false;
                    draft.nextRefresh = null;
                  }
                }
                
                // Handle refresh interval change
                if ('refreshInterval' in preferences && preferences.refreshInterval) {
                  draft.refreshInterval = preferences.refreshInterval;
                  if (draft.autoRefreshEnabled) {
                    draft.nextRefresh = new Date(Date.now() + preferences.refreshInterval);
                  }
                }
              });
            },
            'updatePreferences'
          ),

          addBookmark: storeCircuitBreaker.protectSetter((articleId: string) => {
            set((draft) => {
              if (!draft.bookmarks.includes(articleId)) {
                draft.bookmarks.push(articleId);
              }
            });
          }, 'addBookmark'),

          removeBookmark: storeCircuitBreaker.protectSetter((articleId: string) => {
            set((draft) => {
              draft.bookmarks = draft.bookmarks.filter(id => id !== articleId);
            });
          }, 'removeBookmark'),

          toggleBookmark: storeCircuitBreaker.protectSetter((articleId: string) => {
            const state = get();
            if (state.isBookmarked(articleId)) {
              get().removeBookmark(articleId);
            } else {
              get().addBookmark(articleId);
            }
          }, 'toggleBookmark'),

          isBookmarked: (articleId: string) => {
            return get().bookmarks.includes(articleId);
          },

          markAsRead: storeCircuitBreaker.protectSetter((articleId: string) => {
            set((draft) => {
              if (!draft.readArticles.includes(articleId)) {
                draft.readArticles.push(articleId);
                
                // Track reading activity
                const article = draft.articles.find(a => a.id === articleId);
                if (article) {
                  const category = article.category;
                  draft.metrics.mostReadCategories[category] = 
                    (draft.metrics.mostReadCategories[category] || 0) + 1;
                }
              }
            });
          }, 'markAsRead'),

          markAsUnread: storeCircuitBreaker.protectSetter((articleId: string) => {
            set((draft) => {
              draft.readArticles = draft.readArticles.filter(id => id !== articleId);
            });
          }, 'markAsUnread'),

          isRead: (articleId: string) => {
            return get().readArticles.includes(articleId);
          },

          updateReadingProgress: storeCircuitBreaker.protectSetter(
            (articleId: string, progress: number) => {
              set((draft) => {
                draft.readingProgress[articleId] = Math.max(0, Math.min(100, progress));
                
                // Auto-mark as read when 90% complete
                if (progress >= 90 && !draft.readArticles.includes(articleId)) {
                  draft.readArticles.push(articleId);
                }
              });
            },
            'updateReadingProgress'
          ),

          getReadingProgress: (articleId: string) => {
            return get().readingProgress[articleId] || 0;
          },

          addToSearchHistory: storeCircuitBreaker.protectSetter((query: string) => {
            set((draft) => {
              // Remove if already exists
              draft.searchHistory = draft.searchHistory.filter(q => q !== query);
              // Add to beginning
              draft.searchHistory.unshift(query);
              // Keep only last 50 searches
              if (draft.searchHistory.length > 50) {
                draft.searchHistory = draft.searchHistory.slice(0, 50);
              }
            });
          }, 'addToSearchHistory'),

          clearSearchHistory: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.searchHistory = [];
            });
          }, 'clearSearchHistory'),

          blockSource: storeCircuitBreaker.protectSetter((sourceId: string) => {
            set((draft) => {
              if (!draft.blockedSources.includes(sourceId)) {
                draft.blockedSources.push(sourceId);
              }
              // Remove from articles
              draft.articles = draft.articles.filter(article => article.source.id !== sourceId);
              draft.filteredArticles = applyFiltersToArticles(draft.articles, draft.filters);
            });
          }, 'blockSource'),

          unblockSource: storeCircuitBreaker.protectSetter((sourceId: string) => {
            set((draft) => {
              draft.blockedSources = draft.blockedSources.filter(id => id !== sourceId);
            });
          }, 'unblockSource'),

          addFavoriteAuthor: storeCircuitBreaker.protectSetter((author: string) => {
            set((draft) => {
              if (!draft.favoriteAuthors.includes(author)) {
                draft.favoriteAuthors.push(author);
              }
            });
          }, 'addFavoriteAuthor'),

          removeFavoriteAuthor: storeCircuitBreaker.protectSetter((author: string) => {
            set((draft) => {
              draft.favoriteAuthors = draft.favoriteAuthors.filter(a => a !== author);
            });
          }, 'removeFavoriteAuthor'),

          addPersonalizedTopic: storeCircuitBreaker.protectSetter((topic: string) => {
            set((draft) => {
              if (!draft.personalizedTopics.includes(topic)) {
                draft.personalizedTopics.push(topic);
              }
            });
          }, 'addPersonalizedTopic'),

          removePersonalizedTopic: storeCircuitBreaker.protectSetter((topic: string) => {
            set((draft) => {
              draft.personalizedTopics = draft.personalizedTopics.filter(t => t !== topic);
            });
          }, 'removePersonalizedTopic'),

          // ================================================================
          // UI ACTIONS
          // ================================================================

          toggleSidebar: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.sidebar.isOpen = !draft.sidebar.isOpen;
            });
          }, 'toggleSidebar'),

          setSidebarPinned: storeCircuitBreaker.protectSetter((isPinned: boolean) => {
            set((draft) => {
              draft.sidebar.isPinned = isPinned;
              if (isPinned) {
                draft.sidebar.isOpen = true;
              }
            });
          }, 'setSidebarPinned'),

          setSidebarWidth: storeCircuitBreaker.protectSetter((width: number) => {
            set((draft) => {
              draft.sidebar.width = Math.max(200, Math.min(500, width));
            });
          }, 'setSidebarWidth'),

          setSidebarCollapsed: storeCircuitBreaker.protectSetter((collapsed: boolean) => {
            set((draft) => {
              draft.sidebar.collapsed = collapsed;
            });
          }, 'setSidebarCollapsed'),

          setTheme: storeCircuitBreaker.protectSetter((theme) => {
            set((draft) => {
              draft.theme = theme;
            });
          }, 'setTheme'),

          setLayout: storeCircuitBreaker.protectSetter((layout) => {
            set((draft) => {
              draft.layout = layout;
            });
          }, 'setLayout'),

          setSortBy: storeCircuitBreaker.protectSetter((sortBy) => {
            set((draft) => {
              draft.sortBy = sortBy;
              draft.filteredArticles = sortArticles(draft.filteredArticles, sortBy, draft.sortOrder);
            });
          }, 'setSortBy'),

          setSortOrder: storeCircuitBreaker.protectSetter((sortOrder) => {
            set((draft) => {
              draft.sortOrder = sortOrder;
              draft.filteredArticles = sortArticles(draft.filteredArticles, draft.sortBy, sortOrder);
            });
          }, 'setSortOrder'),

          setShowThumbnails: storeCircuitBreaker.protectSetter((show) => {
            set((draft) => {
              draft.showThumbnails = show;
            });
          }, 'setShowThumbnails'),

          setFontSize: storeCircuitBreaker.protectSetter((size) => {
            set((draft) => {
              draft.fontSize = size;
            });
          }, 'setFontSize'),

          setDensity: storeCircuitBreaker.protectSetter((density) => {
            set((draft) => {
              draft.density = density;
            });
          }, 'setDensity'),

          toggleFilters: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.showFilters = !draft.showFilters;
            });
          }, 'toggleFilters'),

          toggleCategories: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.showCategories = !draft.showCategories;
            });
          }, 'toggleCategories'),

          setFullscreenMode: storeCircuitBreaker.protectSetter((enabled) => {
            set((draft) => {
              draft.fullscreenMode = enabled;
            });
          }, 'setFullscreenMode'),

          setReaderMode: storeCircuitBreaker.protectSetter((enabled) => {
            set((draft) => {
              draft.readerMode = enabled;
            });
          }, 'setReaderMode'),

          setAnimations: storeCircuitBreaker.protectSetter((enabled) => {
            set((draft) => {
              draft.animations = enabled;
            });
          }, 'setAnimations'),

          // ================================================================
          // AUTO-REFRESH ACTIONS
          // ================================================================

          startAutoRefresh: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.autoRefreshEnabled = true;
              draft.nextRefresh = new Date(Date.now() + draft.refreshInterval);
            });
          }, 'startAutoRefresh'),

          stopAutoRefresh: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.autoRefreshEnabled = false;
              draft.nextRefresh = null;
            });
          }, 'stopAutoRefresh'),

          setRefreshInterval: storeCircuitBreaker.protectSetter((intervalMs: number) => {
            set((draft) => {
              draft.refreshInterval = Math.max(60000, intervalMs); // Minimum 1 minute
              if (draft.autoRefreshEnabled) {
                draft.nextRefresh = new Date(Date.now() + intervalMs);
              }
            });
          }, 'setRefreshInterval'),

          getTimeUntilNextRefresh: () => {
            const state = get();
            if (!state.nextRefresh) return 0;
            return Math.max(0, state.nextRefresh.getTime() - Date.now());
          },

          // ================================================================
          // ANALYTICS ACTIONS
          // ================================================================

          trackPageView: storeCircuitBreaker.protectSetter((page: string) => {
            set((draft) => {
              draft.metrics.totalPageViews++;
              draft.metrics.lastActiveTime = new Date();
            });
          }, 'trackPageView'),

          trackReadingTime: storeCircuitBreaker.protectSetter((articleId: string, timeMs: number) => {
            set((draft) => {
              draft.metrics.totalReadingTime += timeMs;
            });
          }, 'trackReadingTime'),

          trackSearch: storeCircuitBreaker.protectSetter((query: string) => {
            set((draft) => {
              draft.metrics.searchFrequency[query] = 
                (draft.metrics.searchFrequency[query] || 0) + 1;
            });
          }, 'trackSearch'),

          updatePerformanceScore: storeCircuitBreaker.protectSetter((score: number) => {
            set((draft) => {
              draft.metrics.performanceScore = Math.max(0, Math.min(1, score));
            });
          }, 'updatePerformanceScore'),

          // ================================================================
          // UTILITY ACTIONS
          // ================================================================

          exportData: () => {
            const state = get();
            const exportData = {
              version: state.version,
              timestamp: new Date().toISOString(),
              preferences: state.preferences,
              bookmarks: state.bookmarks,
              readArticles: state.readArticles,
              searchHistory: state.searchHistory,
              readingProgress: state.readingProgress,
              personalizedTopics: state.personalizedTopics,
              favoriteAuthors: state.favoriteAuthors,
              uiSettings: {
                sidebar: state.sidebar,
                theme: state.theme,
                layout: state.layout,
                sortBy: state.sortBy,
                sortOrder: state.sortOrder,
                showThumbnails: state.showThumbnails,
                fontSize: state.fontSize,
                density: state.density,
              },
              metrics: state.metrics,
            };
            return JSON.stringify(exportData, null, 2);
          },

          importData: storeCircuitBreaker.protectSetter(
            async (data: string): Promise<boolean> => {
              try {
                const imported = JSON.parse(data);
                
                // Validate data structure
                if (!imported.version || !imported.timestamp) {
                  throw new Error('Invalid data format');
                }
                
                set((draft) => {
                  // Import user data
                  if (imported.preferences) {
                    draft.preferences = { ...draft.preferences, ...imported.preferences };
                  }
                  if (imported.bookmarks) {
                    draft.bookmarks = imported.bookmarks;
                  }
                  if (imported.readArticles) {
                    draft.readArticles = imported.readArticles;
                  }
                  if (imported.searchHistory) {
                    draft.searchHistory = imported.searchHistory;
                  }
                  if (imported.readingProgress) {
                    draft.readingProgress = imported.readingProgress;
                  }
                  if (imported.personalizedTopics) {
                    draft.personalizedTopics = imported.personalizedTopics;
                  }
                  if (imported.favoriteAuthors) {
                    draft.favoriteAuthors = imported.favoriteAuthors;
                  }
                  
                  // Import UI settings
                  if (imported.uiSettings) {
                    Object.assign(draft, imported.uiSettings);
                  }
                  
                  // Import metrics (carefully)
                  if (imported.metrics) {
                    draft.metrics = { ...draft.metrics, ...imported.metrics };
                  }
                });
                
                return true;
              } catch (error) {
                console.error('Failed to import data:', error);
                return false;
              }
            },
            'importData'
          ),

          reset: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              Object.assign(draft, {
                ...initialNewsState,
                ...initialUserState,
                ...initialUIState,
                metrics: { ...initialAppMetrics, sessionStartTime: new Date() },
                isInitialized: true,
                version: '2.0.0',
              });
            });
          }, 'reset'),

          resetToDefaults: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.preferences = { ...initialUserState.preferences };
              Object.assign(draft, initialUIState);
            });
          }, 'resetToDefaults'),

          validateState: () => {
            const state = get();
            try {
              // Basic validation checks
              return (
                Array.isArray(state.articles) &&
                Array.isArray(state.bookmarks) &&
                Array.isArray(state.readArticles) &&
                typeof state.preferences === 'object' &&
                typeof state.sidebar === 'object' &&
                typeof state.metrics === 'object'
              );
            } catch {
              return false;
            }
          },

          getStats: () => {
            const state = get();
            
            // Calculate top categories
            const topCategories = Object.entries(state.metrics.mostReadCategories)
              .map(([category, count]) => ({ 
                category: category as NewsCategory, 
                count 
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5);
            
            // Recent activity placeholder
            const recentActivity = [
              {
                action: 'session_started',
                timestamp: state.metrics.sessionStartTime,
                details: { pageViews: state.metrics.totalPageViews }
              }
            ];
            
            return {
              totalArticles: state.articles.length,
              bookmarkedArticles: state.bookmarks.length,
              readArticles: state.readArticles.length,
              sourcesVisited: state.visitedSources.length,
              averageReadingTime: state.metrics.totalReadingTime / Math.max(1, state.readArticles.length),
              topCategories,
              recentActivity,
            };
          },

          // ================================================================
          // EMERGENCY ACTIONS
          // ================================================================

          emergencyReset: storeCircuitBreaker.protectSetter(() => {
            console.log('🚨 EMERGENCY RESET TRIGGERED');
            storeCircuitBreaker.forceReset();
            
            set(() => ({
              ...initialNewsState,
              ...initialUserState,
              ...initialUIState,
              metrics: { ...initialAppMetrics, sessionStartTime: new Date() },
              isInitialized: true,
              version: '2.0.0',
            }));
          }, 'emergencyReset'),

          forceRefresh: storeCircuitBreaker.protectSetter(
            async () => {
              const state = get();
              state.clearCache();
              await state.fetchNews(undefined, { force: true });
            },
            'forceRefresh'
          ),

          clearCache: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              draft.cache.clear();
            });
          }, 'clearCache'),

          repairState: storeCircuitBreaker.protectSetter(() => {
            set((draft) => {
              // Repair common issues
              if (!Array.isArray(draft.articles)) draft.articles = [];
              if (!Array.isArray(draft.bookmarks)) draft.bookmarks = [];
              if (!Array.isArray(draft.readArticles)) draft.readArticles = [];
              if (!Array.isArray(draft.searchHistory)) draft.searchHistory = [];
              if (!Array.isArray(draft.visitedSources)) draft.visitedSources = [];
              if (!draft.preferences) draft.preferences = { ...initialUserState.preferences };
              if (!draft.sidebar) draft.sidebar = { ...initialUIState.sidebar };
              if (!draft.metrics) draft.metrics = { ...initialAppMetrics };
              
              // Repair filtered articles
              draft.filteredArticles = applyFiltersToArticles(draft.articles, draft.filters);
              
              // Mark as initialized
              draft.isInitialized = true;
            });
          }, 'repairState'),

        })),
        {
          name: 'ai-news-app-store-enhanced',
          version: 1,
          migrate: (persistedState: any, version: number) => {
            // Handle version migrations
            if (version === 0) {
              // Migration from nuclear version
              return {
                ...persistedState,
                version: '2.0.0',
                isInitialized: true,
                metrics: initialAppMetrics,
              };
            }
            return persistedState;
          },
          partialize: (state) => ({
            // Persist everything except cache and temporary states
            preferences: state.preferences,
            bookmarks: state.bookmarks,
            readArticles: state.readArticles,
            searchHistory: state.searchHistory,
            visitedSources: state.visitedSources,
            readingProgress: state.readingProgress,
            personalizedTopics: state.personalizedTopics,
            blockedSources: state.blockedSources,
            favoriteAuthors: state.favoriteAuthors,
            sidebar: state.sidebar,
            theme: state.theme,
            layout: state.layout,
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
            showThumbnails: state.showThumbnails,
            fontSize: state.fontSize,
            density: state.density,
            showFilters: state.showFilters,
            showCategories: state.showCategories,
            animations: state.animations,
            refreshInterval: state.refreshInterval,
            metrics: state.metrics,
            version: state.version,
          }),
        }
      ),
      {
        name: 'AppStore',
        enabled: process.env.NODE_ENV === 'development',
      }
    )
  )
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function applyFiltersToArticles(articles: NewsArticle[], filters: NewsFilters): NewsArticle[] {
  let filtered = [...articles];
  
  if (filters.category) {
    filtered = filtered.filter(article => article.category === filters.category);
  }
  
  if (filters.source) {
    filtered = filtered.filter(article => article.source.id === filters.source);
  }
  
  if (filters.dateRange) {
    filtered = filtered.filter(article => {
      const publishedDate = new Date(article.publishedAt);
      return publishedDate >= filters.dateRange!.from && publishedDate <= filters.dateRange!.to;
    });
  }
  
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.description.toLowerCase().includes(query) ||
      article.author?.toLowerCase().includes(query) ||
      article.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }
  
  return sortArticles(filtered, filters.sortBy || 'relevance', filters.sortOrder || 'desc');
}

function sortArticles(
  articles: NewsArticle[], 
  sortBy: 'publishedAt' | 'relevanceScore' | 'title' | 'relevance' | 'date' | 'source' | 'popularity', 
  sortOrder: 'asc' | 'desc'
): NewsArticle[] {
  const sorted = [...articles].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'publishedAt':
      case 'date':
        comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        break;
      case 'relevanceScore':
      case 'relevance':
        comparison = (a.relevanceScore || 0) - (b.relevanceScore || 0);
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'source':
        comparison = a.source.name.localeCompare(b.source.name);
        break;
      case 'popularity':
        // Could be based on view count, engagement, etc.
        comparison = (a.relevanceScore || 0) - (b.relevanceScore || 0);
        break;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

// ============================================================================
// ENHANCED SELECTORS WITH LOOP PREVENTION
// ============================================================================

export const useNewsState = () => useAppStore((state) => ({
  articles: state.articles,
  papers: state.papers,
  filteredArticles: state.filteredArticles,
  loading: state.loading,
  error: state.error,
  filters: state.filters,
  lastUpdated: state.lastUpdated,
  searchQuery: state.searchQuery,
  searchResults: state.searchResults,
  isSearching: state.isSearching,
  
  // Actions
  fetchNews: state.fetchNews,
  fetchArxivPapers: state.fetchArxivPapers,
  searchNews: state.searchNews,
  clearSearch: state.clearSearch,
  applyFilters: state.applyFilters,
  clearFilters: state.clearFilters,
  refreshNews: state.refreshNews,
}));

export const useUserPreferences = () => useAppStore((state) => ({
  preferences: state.preferences,
  bookmarks: state.bookmarks,
  readArticles: state.readArticles,
  searchHistory: state.searchHistory,
  readingProgress: state.readingProgress,
  personalizedTopics: state.personalizedTopics,
  favoriteAuthors: state.favoriteAuthors,
  
  // Actions
  updatePreferences: state.updatePreferences,
  addBookmark: state.addBookmark,
  removeBookmark: state.removeBookmark,
  toggleBookmark: state.toggleBookmark,
  isBookmarked: state.isBookmarked,
  markAsRead: state.markAsRead,
  markAsUnread: state.markAsUnread,
  isRead: state.isRead,
  updateReadingProgress: state.updateReadingProgress,
  getReadingProgress: state.getReadingProgress,
  addToSearchHistory: state.addToSearchHistory,
  clearSearchHistory: state.clearSearchHistory,
  addPersonalizedTopic: state.addPersonalizedTopic,
  removePersonalizedTopic: state.removePersonalizedTopic,
  addFavoriteAuthor: state.addFavoriteAuthor,
  removeFavoriteAuthor: state.removeFavoriteAuthor,
}));

export const useUISettings = () => useAppStore((state) => ({
  sidebar: state.sidebar,
  theme: state.theme,
  layout: state.layout,
  sortBy: state.sortBy,
  sortOrder: state.sortOrder,
  showThumbnails: state.showThumbnails,
  fontSize: state.fontSize,
  density: state.density,
  showFilters: state.showFilters,
  showCategories: state.showCategories,
  fullscreenMode: state.fullscreenMode,
  readerMode: state.readerMode,
  animations: state.animations,
  
  // Actions
  toggleSidebar: state.toggleSidebar,
  setSidebarPinned: state.setSidebarPinned,
  setSidebarWidth: state.setSidebarWidth,
  setSidebarCollapsed: state.setSidebarCollapsed,
  setTheme: state.setTheme,
  setLayout: state.setLayout,
  setSortBy: state.setSortBy,
  setSortOrder: state.setSortOrder,
  setShowThumbnails: state.setShowThumbnails,
  setFontSize: state.setFontSize,
  setDensity: state.setDensity,
  toggleFilters: state.toggleFilters,
  toggleCategories: state.toggleCategories,
  setFullscreenMode: state.setFullscreenMode,
  setReaderMode: state.setReaderMode,
  setAnimations: state.setAnimations,
}));

export const useAppMetrics = () => useAppStore((state) => ({
  metrics: state.metrics,
  stats: state.getStats(),
  isInitialized: state.isInitialized,
  version: state.version,
  
  // Actions
  trackPageView: state.trackPageView,
  trackReadingTime: state.trackReadingTime,
  trackSearch: state.trackSearch,
  updatePerformanceScore: state.updatePerformanceScore,
  exportData: state.exportData,
  importData: state.importData,
  validateState: state.validateState,
}));

// ============================================================================
// AUTO-REFRESH SETUP WITH CIRCUIT BREAKER PROTECTION
// ============================================================================

export const setupStoreSubscriptions = () => {
  let autoRefreshInterval: NodeJS.Timeout | null = null;
  
  // Auto-refresh subscription with circuit breaker protection
  const unsubscribeAutoRefresh = useAppStore.subscribe(
    (state) => ({
      autoRefreshEnabled: state.autoRefreshEnabled,
      refreshInterval: state.refreshInterval,
      nextRefresh: state.nextRefresh,
    }),
    ({ autoRefreshEnabled, refreshInterval }) => {
      // Clear existing interval
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
      }
      
      // Set up new interval if enabled
      if (autoRefreshEnabled && refreshInterval > 0) {
        console.log(`🔄 Auto-refresh enabled: ${refreshInterval / 1000}s intervals`);
        
        autoRefreshInterval = setInterval(async () => {
          try {
            const currentState = useAppStore.getState();
            
            // Check if circuit breaker allows this update
            if (storeCircuitBreaker.shouldAllowUpdate(currentState, 'auto-refresh')) {
              await currentState.refreshNews();
              console.log('🔄 Auto-refresh completed');
            } else {
              console.log('🚫 Auto-refresh blocked by circuit breaker');
            }
          } catch (error) {
            console.error('🔄 Auto-refresh failed:', error);
            useAppStore.getState().updatePerformanceScore(0.8);
          }
        }, refreshInterval);
      }
    },
    {
      equalityFn: (a, b) => 
        a.autoRefreshEnabled === b.autoRefreshEnabled && 
        a.refreshInterval === b.refreshInterval
    }
  );
  
  // Performance monitoring
  const unsubscribePerformance = storeCircuitBreaker.onStatsUpdate((stats) => {
    useAppStore.getState().updatePerformanceScore(stats.performanceScore);
    
    if (stats.isTripped) {
      console.log('🚨 Store circuit breaker tripped - auto-refresh paused');
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
      }
    }
  });
  
  // Initialize state validation
  setTimeout(() => {
    const state = useAppStore.getState();
    if (!state.validateState()) {
      console.warn('🔧 Invalid state detected - attempting repair');
      state.repairState();
    }
    
    // Mark as initialized
    if (!state.isInitialized) {
      useAppStore.setState({ isInitialized: true });
    }
  }, 100);
  
  // Cleanup function
  return () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    unsubscribeAutoRefresh();
    unsubscribePerformance();
    storeCircuitBreaker.destroy();
  };
};

export default useAppStore;