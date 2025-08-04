/**
 * Advanced state management with persistence
 * Zustand-based store with middleware for persistence, devtools, and state synchronization
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { NewsArticle, NewsCategory } from '../types/news';

// State interfaces
interface NewsState {
  articles: NewsArticle[];
  filteredArticles: NewsArticle[];
  categories: NewsCategory[];
  selectedCategory: NewsCategory | 'all';
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  totalArticles: number;
  hasMore: boolean;
  currentPage: number;
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
  };
  bookmarks: string[];
  readArticles: string[];
  searchHistory: string[];
  visitedSources: string[];
}

interface UIState {
  sidebar: {
    isOpen: boolean;
    isPinned: boolean;
    width: number;
  };
  theme: 'light' | 'dark' | 'system';
  layout: 'grid' | 'list' | 'compact';
  sortBy: 'relevance' | 'date' | 'source';
  sortOrder: 'asc' | 'desc';
  showThumbnails: boolean;
  fontSize: 'small' | 'medium' | 'large';
  density: 'comfortable' | 'compact' | 'spacious';
}

interface AppState extends NewsState, UserState, UIState {
  // News actions
  setArticles: (articles: NewsArticle[]) => void;
  addArticles: (articles: NewsArticle[]) => void;
  updateArticle: (id: string, updates: Partial<NewsArticle>) => void;
  removeArticle: (id: string) => void;
  clearArticles: () => void;
  
  // Filter actions
  setCategory: (category: NewsCategory | 'all') => void;
  setSearchQuery: (query: string) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  
  // UI actions
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  setSidebarPinned: (isPinned: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLayout: (layout: 'grid' | 'list' | 'compact') => void;
  setSortBy: (sortBy: 'relevance' | 'date' | 'source') => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  setShowThumbnails: (show: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setDensity: (density: 'comfortable' | 'compact' | 'spacious') => void;
  
  // User actions
  updatePreferences: (preferences: Partial<UserState['preferences']>) => void;
  addBookmark: (articleId: string) => void;
  removeBookmark: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
  markAsRead: (articleId: string) => void;
  isRead: (articleId: string) => boolean;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  addVisitedSource: (source: string) => void;
  
  // Pagination actions
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setHasMore: (hasMore: boolean) => void;
  
  // Utility actions
  refresh: () => void;
  reset: () => void;
  exportData: () => string;
  importData: (data: string) => void;
  getStats: () => {
    totalArticles: number;
    bookmarkedArticles: number;
    readArticles: number;
    favoriteCategory: NewsCategory | 'all';
    averageReadingTime: number;
    sourcesVisited: number;
  };
}

// Initial state
const initialNewsState: NewsState = {
  articles: [],
  filteredArticles: [],
  categories: ['artificial-intelligence', 'machine-learning', 'deep-learning', 'nlp', 'computer-vision', 'robotics', 'research', 'industry', 'startups', 'tech-news'],
  selectedCategory: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  lastUpdated: null,
  totalArticles: 0,
  hasMore: true,
  currentPage: 1,
};

const initialUserState: UserState = {
  preferences: {
    defaultCategory: 'all',
    articlesPerPage: 20,
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutes
    compactView: false,
    darkMode: false,
    notifications: true,
  },
  bookmarks: [],
  readArticles: [],
  searchHistory: [],
  visitedSources: [],
};

const initialUIState: UIState = {
  sidebar: {
    isOpen: false,
    isPinned: false,
    width: 280,
  },
  theme: 'system',
  layout: 'list',
  sortBy: 'relevance',
  sortOrder: 'desc',
  showThumbnails: true,
  fontSize: 'medium',
  density: 'comfortable',
};

// Create store with middleware
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          ...initialNewsState,
          ...initialUserState,
          ...initialUIState,

          // News actions
          setArticles: (articles) => set((state) => {
            console.log(`📰 Setting articles: ${articles.length} articles`);
            state.articles = articles;
            state.totalArticles = articles.length;
            state.lastUpdated = new Date();
            // IMPORTANT: Don't call applyFilters here - let subscriptions handle it
            // This prevents the infinite loop by breaking the cycle
          }, false, 'setArticles'),

          addArticles: (articles) => set((state) => {
            const existingIds = new Set(state.articles.map(a => a.id));
            const newArticles = articles.filter(a => !existingIds.has(a.id));
            state.articles = [...state.articles, ...newArticles];
            state.totalArticles = state.articles.length;
            state.lastUpdated = new Date();
          }, false, 'addArticles'),

          updateArticle: (id, updates) => set((state) => {
            const index = state.articles.findIndex(a => a.id === id);
            if (index !== -1) {
              state.articles[index] = { ...state.articles[index], ...updates };
            }
          }, false, 'updateArticle'),

          removeArticle: (id) => set((state) => {
            state.articles = state.articles.filter(a => a.id !== id);
            state.totalArticles = state.articles.length;
          }, false, 'removeArticle'),

          clearArticles: () => set((state) => {
            state.articles = [];
            state.filteredArticles = [];
            state.totalArticles = 0;
            state.lastUpdated = null;
            state.currentPage = 1;
            state.hasMore = true;
          }),

          // Filter actions
          setCategory: (category) => set((state) => {
            state.selectedCategory = category;
            state.currentPage = 1;
          }, false, 'setCategory'),

          setSearchQuery: (query) => set((state) => {
            state.searchQuery = query;
            state.currentPage = 1;
            if (query.trim()) {
              // Avoid calling addToSearchHistory here to prevent loops
              const history = state.searchHistory.filter(q => q !== query.trim());
              history.unshift(query.trim());
              state.searchHistory = history.slice(0, 10);
            }
          }, false, 'setSearchQuery'),

          applyFilters: () => {
            const state = get();
            
            // Enhanced loop prevention
            if (state.isLoading) {
              console.log('⏸️ Skipping applyFilters - store is loading');
              return;
            }
            
            // Use a static flag to prevent recursive calls
            if ((applyFilters as any).isRunning) {
              console.warn('🔄 applyFilters already running, preventing recursion');
              return;
            }
            
            try {
              (applyFilters as any).isRunning = true;
              
              let filtered = [...state.articles];

              // Category filter
              if (state.selectedCategory !== 'all') {
                filtered = filtered.filter(article => article.category === state.selectedCategory);
              }

              // Search filter
              if (state.searchQuery.trim()) {
                const query = state.searchQuery.toLowerCase();
                filtered = filtered.filter(article =>
                  article.title.toLowerCase().includes(query) ||
                  article.description.toLowerCase().includes(query) ||
                  article.tags?.some(tag => tag.toLowerCase().includes(query)) ||
                  article.author?.toLowerCase().includes(query)
                );
              }

              // Sort
              filtered.sort((a, b) => {
                let comparison = 0;
                
                switch (state.sortBy) {
                  case 'relevance':
                    comparison = (b.relevanceScore || 0) - (a.relevanceScore || 0);
                    break;
                  case 'date':
                    comparison = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
                    break;
                  case 'source':
                    comparison = a.source.name.localeCompare(b.source.name);
                    break;
                }

                return state.sortOrder === 'asc' ? -comparison : comparison;
              });

              // More efficient change detection using ID arrays
              const currentFiltered = state.filteredArticles;
              const currentIds = currentFiltered.map(a => a.id).join(',');
              const newIds = filtered.map(a => a.id).join(',');
              
              if (currentIds !== newIds) {
                console.log(`🔍 Updating filtered articles: ${currentFiltered.length} → ${filtered.length}`);
                set({ filteredArticles: filtered }, false, 'applyFilters');
              } else {
                console.log('📋 Filtered articles unchanged, skipping update');
              }
            } finally {
              (applyFilters as any).isRunning = false;
            }
          },

          resetFilters: () => set((state) => {
            state.selectedCategory = 'all';
            state.searchQuery = '';
            state.currentPage = 1;
          }, false, 'resetFilters'),

          // UI actions
          setLoading: (isLoading) => set((state) => {
            state.isLoading = isLoading;
          }),

          setError: (error) => set((state) => {
            state.error = error;
          }),

          toggleSidebar: () => set((state) => {
            state.sidebar.isOpen = !state.sidebar.isOpen;
          }),

          setSidebarPinned: (isPinned) => set((state) => {
            state.sidebar.isPinned = isPinned;
            if (isPinned) {
              state.sidebar.isOpen = true;
            }
          }),

          setSidebarWidth: (width) => set((state) => {
            state.sidebar.width = Math.max(200, Math.min(400, width));
          }),

          setTheme: (theme) => set((state) => {
            state.theme = theme;
          }),

          setLayout: (layout) => set((state) => {
            state.layout = layout;
          }),

          setSortBy: (sortBy) => set((state) => {
            state.sortBy = sortBy;
          }, false, 'setSortBy'),

          setSortOrder: (sortOrder) => set((state) => {
            state.sortOrder = sortOrder;
          }, false, 'setSortOrder'),

          setShowThumbnails: (show) => set((state) => {
            state.showThumbnails = show;
          }),

          setFontSize: (size) => set((state) => {
            state.fontSize = size;
          }),

          setDensity: (density) => set((state) => {
            state.density = density;
          }),

          // User actions
          updatePreferences: (preferences) => set((state) => {
            state.preferences = { ...state.preferences, ...preferences };
          }),

          addBookmark: (articleId) => set((state) => {
            if (!state.bookmarks.includes(articleId)) {
              state.bookmarks.push(articleId);
            }
          }),

          removeBookmark: (articleId) => set((state) => {
            state.bookmarks = state.bookmarks.filter(id => id !== articleId);
          }),

          isBookmarked: (articleId) => {
            return get().bookmarks.includes(articleId);
          },

          markAsRead: (articleId) => set((state) => {
            if (!state.readArticles.includes(articleId)) {
              state.readArticles.push(articleId);
            }
          }),

          isRead: (articleId) => {
            return get().readArticles.includes(articleId);
          },

          addToSearchHistory: (query) => set((state) => {
            const history = state.searchHistory.filter(q => q !== query);
            history.unshift(query);
            state.searchHistory = history.slice(0, 10); // Keep only last 10 searches
          }),

          clearSearchHistory: () => set((state) => {
            state.searchHistory = [];
          }),

          addVisitedSource: (source) => set((state) => {
            if (!state.visitedSources.includes(source)) {
              state.visitedSources.push(source);
            }
          }),

          // Pagination actions
          setCurrentPage: (page) => set((state) => {
            state.currentPage = Math.max(1, page);
          }),

          nextPage: () => set((state) => {
            if (state.hasMore) {
              state.currentPage += 1;
            }
          }),

          previousPage: () => set((state) => {
            state.currentPage = Math.max(1, state.currentPage - 1);
          }),

          setHasMore: (hasMore) => set((state) => {
            state.hasMore = hasMore;
          }),

          // Utility actions
          refresh: () => set((state) => {
            state.isLoading = true;
            state.error = null;
            // Note: In a real app, this would trigger a data refresh
          }),

          reset: () => set((state) => {
            Object.assign(state, initialNewsState, initialUserState, initialUIState);
          }),

          exportData: () => {
            const state = get();
            const exportData = {
              bookmarks: state.bookmarks,
              readArticles: state.readArticles,
              searchHistory: state.searchHistory,
              preferences: state.preferences,
              uiSettings: {
                theme: state.theme,
                layout: state.layout,
                sortBy: state.sortBy,
                sortOrder: state.sortOrder,
                showThumbnails: state.showThumbnails,
                fontSize: state.fontSize,
                density: state.density,
              },
            };
            return JSON.stringify(exportData, null, 2);
          },

          importData: (data) => {
            try {
              const imported = JSON.parse(data);
              set((state) => {
                if (imported.bookmarks) state.bookmarks = imported.bookmarks;
                if (imported.readArticles) state.readArticles = imported.readArticles;
                if (imported.searchHistory) state.searchHistory = imported.searchHistory;
                if (imported.preferences) state.preferences = { ...state.preferences, ...imported.preferences };
                if (imported.uiSettings) {
                  Object.assign(state, imported.uiSettings);
                }
              });
            } catch (error) {
              console.error('Failed to import data:', error);
            }
          },

          getStats: () => {
            const state = get();
            const categoryCounts: Record<string, number> = {};
            
            state.articles.forEach(article => {
              categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
            });
            
            const favoriteCategory = Object.entries(categoryCounts)
              .reduce((a, b) => a[1] > b[1] ? a : b, ['all', 0])[0] as NewsCategory | 'all';
            
            const readArticleObjs = state.articles.filter(a => state.readArticles.includes(a.id));
            const averageReadingTime = readArticleObjs.reduce((sum, article) => {
              const words = article.description.split(' ').length;
              return sum + Math.ceil(words / 200); // 200 words per minute
            }, 0) / Math.max(readArticleObjs.length, 1);

            return {
              totalArticles: state.totalArticles,
              bookmarkedArticles: state.bookmarks.length,
              readArticles: state.readArticles.length,
              favoriteCategory,
              averageReadingTime,
              sourcesVisited: state.visitedSources.length,
            };
          },
        }))
      ),
      {
        name: 'ai-news-app-store',
        partialize: (state) => ({
          // Persist only user preferences and UI settings
          preferences: state.preferences,
          bookmarks: state.bookmarks,
          readArticles: state.readArticles,
          searchHistory: state.searchHistory,
          visitedSources: state.visitedSources,
          theme: state.theme,
          layout: state.layout,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          showThumbnails: state.showThumbnails,
          fontSize: state.fontSize,
          density: state.density,
          sidebar: state.sidebar,
          selectedCategory: state.selectedCategory,
        }),
        version: 1,
        migrate: (persistedState: any, version: number) => {
          // Handle state migrations for different versions
          if (version === 0) {
            // Migration from version 0 to 1
            return {
              ...persistedState,
              preferences: {
                ...initialUserState.preferences,
                ...persistedState.preferences,
              },
            };
          }
          return persistedState;
        },
      }
    ),
    {
      name: 'ai-news-app-store',
    }
  )
);

// Selectors for commonly used state combinations
export const useNewsData = () => useAppStore((state) => ({
  articles: state.filteredArticles,
  isLoading: state.isLoading,
  error: state.error,
  totalArticles: state.totalArticles,
  hasMore: state.hasMore,
  currentPage: state.currentPage,
  selectedCategory: state.selectedCategory,
  searchQuery: state.searchQuery,
}));

export const useUserPreferences = () => useAppStore((state) => ({
  preferences: state.preferences,
  bookmarks: state.bookmarks,
  readArticles: state.readArticles,
  searchHistory: state.searchHistory,
  updatePreferences: state.updatePreferences,
  addBookmark: state.addBookmark,
  removeBookmark: state.removeBookmark,
  isBookmarked: state.isBookmarked,
  markAsRead: state.markAsRead,
  isRead: state.isRead,
  clearSearchHistory: state.clearSearchHistory,
}), (a, b) => {
  // Shallow equality check to prevent unnecessary re-renders
  return JSON.stringify(a.preferences) === JSON.stringify(b.preferences) && 
         a.bookmarks.length === b.bookmarks.length && 
         a.readArticles.length === b.readArticles.length && 
         a.searchHistory.length === b.searchHistory.length;
});

export const useUISettings = () => useAppStore((state) => ({
  theme: state.theme,
  layout: state.layout,
  sortBy: state.sortBy,
  sortOrder: state.sortOrder,
  showThumbnails: state.showThumbnails,
  fontSize: state.fontSize,
  density: state.density,
  sidebar: state.sidebar,
  setTheme: state.setTheme,
  setLayout: state.setLayout,
  setSortBy: state.setSortBy,
  setSortOrder: state.setSortOrder,
  setShowThumbnails: state.setShowThumbnails,
  setFontSize: state.setFontSize,
  setDensity: state.setDensity,
  toggleSidebar: state.toggleSidebar,
  setSidebarPinned: state.setSidebarPinned,
  setSidebarWidth: state.setSidebarWidth,
}), (a, b) => {
  // Shallow equality check to prevent unnecessary re-renders
  return a.theme === b.theme && 
         a.layout === b.layout && 
         a.sortBy === b.sortBy && 
         a.sortOrder === b.sortOrder && 
         a.showThumbnails === b.showThumbnails && 
         a.fontSize === b.fontSize && 
         a.density === b.density && 
         JSON.stringify(a.sidebar) === JSON.stringify(b.sidebar);
});

// Store subscriptions for side effects with circuit breaker protection
let subscriptionActive = false;
let filterTimeout: NodeJS.Timeout | null = null;
let lastFilterApply = 0;
const FILTER_COOLDOWN = 300; // Minimum time between filter applications

export const setupStoreSubscriptions = () => {
  // Prevent duplicate subscriptions
  if (subscriptionActive) {
    console.warn('Store subscriptions already active, skipping setup');
    return;
  }
  
  subscriptionActive = true;
  console.log('🔧 Setting up store subscriptions with loop protection');
  
  // Filter subscriptions with enhanced loop protection
  let filterApplicationCount = 0;
  const FILTER_APPLICATION_LIMIT = 10;
  const FILTER_RESET_INTERVAL = 2000;
  
  // Reset filter application count periodically
  setInterval(() => {
    filterApplicationCount = 0;
  }, FILTER_RESET_INTERVAL);
  
  useAppStore.subscribe(
    (state) => {
      // Use a stable hash instead of length to detect real changes
      const articlesHash = state.articles.slice(0, 5).map(a => a.id).join(',');
      return {
        articlesHash,
        selectedCategory: state.selectedCategory,
        searchQuery: state.searchQuery.trim(),
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        articlesCount: state.articles.length
      };
    },
    (current, previous) => {
      // Shallow equality check instead of JSON stringify
      const hasChanged = current.articlesHash !== previous.articlesHash ||
                        current.selectedCategory !== previous.selectedCategory ||
                        current.searchQuery !== previous.searchQuery ||
                        current.sortBy !== previous.sortBy ||
                        current.sortOrder !== previous.sortOrder ||
                        current.articlesCount !== previous.articlesCount;
      
      if (!hasChanged) {
        return;
      }
      
      // Circuit breaker for filter applications
      if (filterApplicationCount >= FILTER_APPLICATION_LIMIT) {
        console.warn('🛑 Filter application limit reached, preventing infinite loop');
        return;
      }
      
      // Cooldown check
      const now = Date.now();
      if (now - lastFilterApply < FILTER_COOLDOWN) {
        console.log('⏳ Filter application in cooldown, skipping');
        return;
      }
      
      // Clear existing timeout
      if (filterTimeout) {
        clearTimeout(filterTimeout);
      }
      
      // Debounced filter application with error handling
      filterTimeout = setTimeout(() => {
        try {
          filterApplicationCount++;
          lastFilterApply = Date.now();
          
          const state = useAppStore.getState();
          if (state.isLoading) {
            console.log('⏸️ Skipping filter application - store is loading');
            return;
          }
          
          console.log(`🔍 Applying filters (${filterApplicationCount}/${FILTER_APPLICATION_LIMIT})`);
          state.applyFilters();
        } catch (error) {
          console.error('❌ Filter application failed:', error);
          filterApplicationCount--; // Don't penalize for errors
        }
      }, 250); // Increased debounce time
    },
    {
      fireImmediately: false
    }
  );

  // Auto-refresh articles based on preferences
  useAppStore.subscribe(
    (state) => state.preferences.autoRefresh,
    (autoRefresh) => {
      if (autoRefresh) {
        const interval = setInterval(() => {
          const state = useAppStore.getState();
          if (!state.isLoading && document.visibilityState === 'visible') {
            state.refresh();
          }
        }, useAppStore.getState().preferences.refreshInterval);

        return () => clearInterval(interval);
      }
    }
  );

  // Theme synchronization
  useAppStore.subscribe(
    (state) => state.theme,
    (theme) => {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    }
  );

  // Font size application
  useAppStore.subscribe(
    (state) => state.fontSize,
    (fontSize) => {
      const root = document.documentElement;
      root.classList.remove('text-small', 'text-medium', 'text-large');
      root.classList.add(`text-${fontSize}`);
    }
  );

  // Density application
  useAppStore.subscribe(
    (state) => state.density,
    (density) => {
      const root = document.documentElement;
      root.classList.remove('density-comfortable', 'density-compact', 'density-spacious');
      root.classList.add(`density-${density}`);
    }
  );
};

export default useAppStore;