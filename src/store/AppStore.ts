/**
 * NUCLEAR MODE: Minimal AppStore without subscriptions
 * Simplified state management to prevent infinite loops
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { NewsArticle, NewsCategory } from '../types/news';

// Minimal state interfaces
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

interface AppState extends UserState, UIState {
  // Minimal actions only
  updatePreferences: (preferences: Partial<UserState['preferences']>) => void;
  addBookmark: (articleId: string) => void;
  removeBookmark: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
  markAsRead: (articleId: string) => void;
  isRead: (articleId: string) => boolean;
  clearSearchHistory: () => void;
  
  // UI actions
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
  
  // Utility actions
  exportData: () => string;
  importData: (data: string) => void;
  reset: () => void;
  getStats: () => {
    totalArticles: number;
    bookmarkedArticles: number;
    readArticles: number;
    sourcesVisited: number;
  };
}

// Initial state
const initialUserState: UserState = {
  preferences: {
    defaultCategory: 'all',
    articlesPerPage: 20,
    autoRefresh: false, // NUCLEAR: Disable auto-refresh
    refreshInterval: 300000,
    compactView: false,
    darkMode: false,
    notifications: false, // NUCLEAR: Disable notifications
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

// NUCLEAR: Minimal store without complex middleware
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialUserState,
      ...initialUIState,

      // User actions
      updatePreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences }
      })),

      addBookmark: (articleId) => set((state) => ({
        bookmarks: state.bookmarks.includes(articleId) 
          ? state.bookmarks 
          : [...state.bookmarks, articleId]
      })),

      removeBookmark: (articleId) => set((state) => ({
        bookmarks: state.bookmarks.filter(id => id !== articleId)
      })),

      isBookmarked: (articleId) => {
        return get().bookmarks.includes(articleId);
      },

      markAsRead: (articleId) => set((state) => ({
        readArticles: state.readArticles.includes(articleId) 
          ? state.readArticles 
          : [...state.readArticles, articleId]
      })),

      isRead: (articleId) => {
        return get().readArticles.includes(articleId);
      },

      clearSearchHistory: () => set({ searchHistory: [] }),

      // UI actions
      toggleSidebar: () => set((state) => ({
        sidebar: { ...state.sidebar, isOpen: !state.sidebar.isOpen }
      })),

      setSidebarPinned: (isPinned) => set((state) => ({
        sidebar: { ...state.sidebar, isPinned, isOpen: isPinned || state.sidebar.isOpen }
      })),

      setSidebarWidth: (width) => set((state) => ({
        sidebar: { ...state.sidebar, width: Math.max(200, Math.min(400, width)) }
      })),

      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setShowThumbnails: (showThumbnails) => set({ showThumbnails }),
      setFontSize: (fontSize) => set({ fontSize }),
      setDensity: (density) => set({ density }),

      // Utility actions
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
          set((state) => ({
            ...state,
            bookmarks: imported.bookmarks || state.bookmarks,
            readArticles: imported.readArticles || state.readArticles,
            searchHistory: imported.searchHistory || state.searchHistory,
            preferences: imported.preferences ? { ...state.preferences, ...imported.preferences } : state.preferences,
            ...(imported.uiSettings || {})
          }));
        } catch (error) {
          console.error('Failed to import data:', error);
        }
      },

      reset: () => set({ ...initialUserState, ...initialUIState }),

      getStats: () => {
        const state = get();
        return {
          totalArticles: 0, // NUCLEAR: Simplified stats
          bookmarkedArticles: state.bookmarks.length,
          readArticles: state.readArticles.length,
          sourcesVisited: state.visitedSources.length,
        };
      },
    }),
    {
      name: 'ai-news-app-store-nuclear',
      partialize: (state) => ({
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
      }),
    }
  )
);

// NUCLEAR: Simplified selectors without complex dependencies
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
}));

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
}));

// NUCLEAR: No store subscriptions - let components handle their own state
export const setupStoreSubscriptions = () => {
  console.log('🚫 NUCLEAR MODE: Store subscriptions disabled');
  // No subscriptions to prevent infinite loops
};

export default useAppStore;