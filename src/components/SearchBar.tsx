import { Search, X, Sparkles, Zap, Filter, Calendar, Tag } from 'lucide-react';
import React, { useState, memo } from 'react';

import { SafeComponentErrorBoundary } from './SafeErrorBoundary';
import { useSafeEffect } from '../hooks/useSafeEffect';
import { useSafeCallback } from '../hooks/useSafeCallback';
import { useSafeMemo } from '../hooks/useSafeMemo';
import { cn } from '../lib/utils';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onFilterChange?: (filters: SearchFilters) => void;
  showAdvancedFilters?: boolean;
  recentSearches?: string[];
  suggestedTerms?: string[];
  className?: string;
}

interface SearchFilters {
  dateRange?: { from: Date; to: Date };
  categories?: string[];
  sources?: string[];
  tags?: string[];
}

const QUICK_FILTERS = [
  { label: 'Today', value: 'today', icon: Calendar },
  { label: 'This Week', value: 'week', icon: Calendar },
  { label: 'AI Research', value: 'ai-research', icon: Sparkles },
  { label: 'Tech News', value: 'tech-news', icon: Zap },
];

const SUGGESTED_SEARCHES = [
  'GPT-4', 'Machine Learning', 'Neural Networks', 'OpenAI', 'Google AI',
  'Computer Vision', 'Natural Language Processing', 'Deep Learning'
];

export const SearchBar: React.FC<SearchBarProps> = memo(({ 
  placeholder = "Search AI news and papers...", 
  onSearch,
  onFilterChange,
  showAdvancedFilters = false,
  recentSearches = [],
  suggestedTerms = SUGGESTED_SEARCHES,
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const [handleSubmit] = useSafeCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsSearching(true);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate search delay
      onSearch(query);
      setIsSearching(false);
    }
  }, [query, onSearch], {
    callbackId: 'searchBar-handleSubmit',
    maxExecutionsPerSecond: 2
  });

  const [handleClear] = useSafeCallback(() => {
    setQuery('');
    onSearch('');
    setFilters({});
    if (onFilterChange) {
      onFilterChange({});
    }
  }, [onSearch, onFilterChange], {
    callbackId: 'searchBar-handleClear',
    maxExecutionsPerSecond: 3
  });

  // Safe auto-search with debounce
  useSafeEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        onSearch(query);
      } else if (query === '') {
        onSearch('');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, onSearch], {
    effectId: 'searchBar-autoSearch',
    maxExecutionsPerSecond: 2
  });
  
  // Apply filters when they change
  useSafeEffect(() => {
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange], {
    effectId: 'searchBar-filterChange',
    maxExecutionsPerSecond: 5
  });

  // Handle quick filter selection
  const [handleQuickFilter] = useSafeCallback((filterValue: string) => {
    switch (filterValue) {
      case 'today':
        setFilters(prev => ({
          ...prev,
          dateRange: {
            from: new Date(),
            to: new Date()
          }
        }));
        break;
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        setFilters(prev => ({
          ...prev,
          dateRange: {
            from: weekAgo,
            to: new Date()
          }
        }));
        break;
      default:
        setQuery(filterValue);
        onSearch(filterValue);
    }
  }, [onSearch], {
    callbackId: 'searchBar-handleQuickFilter', 
    maxExecutionsPerSecond: 5
  });
  
  // Handle suggested search selection
  const [handleSuggestedSearch] = useSafeCallback((suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setIsFocused(false);
  }, [onSearch], {
    callbackId: 'searchBar-handleSuggestedSearch',
    maxExecutionsPerSecond: 5
  });
  
  // Memoized suggestions display
  const [displaySuggestions] = useSafeMemo(() => {
    if (!isFocused || query.length > 2) return [];
    
    const filtered = suggestedTerms.filter(term => 
      term.toLowerCase().includes(query.toLowerCase())
    );
    
    return [...new Set([...recentSearches.slice(0, 3), ...filtered.slice(0, 5)])];
  }, [isFocused, query, suggestedTerms, recentSearches], {
    memoId: 'searchBar-displaySuggestions',
    maxComputationsPerSecond: 10
  });

  return (
    <SafeComponentErrorBoundary componentId="search-bar">
      <div className={cn("relative group", className)}>
        <form onSubmit={handleSubmit} className="relative">
      {/* Background Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 transition-opacity duration-500 -z-10" />
      
      <div className={cn(
        "relative backdrop-blur-xl bg-white/50 dark:bg-slate-900/50 border border-white/30 dark:border-slate-700/30 rounded-2xl transition-all duration-300 shadow-lg",
        isFocused && "bg-white/70 dark:bg-slate-900/70 border-white/50 dark:border-slate-600/50 shadow-2xl scale-[1.02]"
      )}>
        {/* Search Icon with Animation */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
          {isSearching ? (
            <div className="relative">
              <Zap className="w-5 h-5 text-blue-500 animate-pulse" />
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-sm opacity-50 animate-ping" />
            </div>
          ) : (
            <Search className={cn(
              "w-5 h-5 transition-all duration-300",
              isFocused 
                ? "text-blue-500 scale-110" 
                : "text-slate-500 dark:text-slate-400"
            )} />
          )}
        </div>
        
        {/* Input Field */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "w-full pl-12 pr-12 py-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none rounded-2xl font-medium text-lg transition-all duration-300",
            isFocused && "placeholder:text-slate-400 dark:placeholder:text-slate-500"
          )}
        />
        
        {/* Animated Placeholder Enhancement */}
        {!query && !isFocused && (
          <div className="absolute left-12 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 pointer-events-none">
            <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" style={{ animationDelay: '0s' }} />
            <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" style={{ animationDelay: '1s' }} />
            <Sparkles className="w-2 h-2 text-pink-400 animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
        )}
        
        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 hover:bg-white/20 dark:hover:bg-slate-800/50 rounded-xl transition-all duration-200 group/clear hover:scale-110"
          >
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover/clear:text-red-500 transition-colors" />
          </button>
        )}
        
        {/* Submit Button (appears on focus) */}
        {query && isFocused && (
          <button
            type="submit"
            className="absolute right-14 top-1/2 transform -translate-y-1/2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 hover:scale-105 shadow-lg"
          >
            Search
          </button>
        )}
        
        {/* Border Glow Effect */}
        <div className={cn(
          "absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 transition-opacity duration-300 pointer-events-none",
          isFocused && "opacity-20"
        )} style={{ padding: '1px' }}>
          <div className="w-full h-full bg-white/50 dark:bg-slate-900/50 rounded-2xl" />
        </div>
      </div>
      
        </form>
        
        {/* Advanced Filters Button */}
        {showAdvancedFilters && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "absolute right-2 top-2 p-2 rounded-lg transition-all duration-200 hover:scale-110",
              showFilters 
                ? "bg-blue-500 text-white shadow-lg" 
                : "bg-white/20 text-slate-500 hover:bg-white/30"
            )}
          >
            <Filter className="w-4 h-4" />
          </button>
        )}
        
        {/* Quick Filters */}
        {!query && !isFocused && (
          <div className="mt-4 flex items-center space-x-2 overflow-x-auto pb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Quick filters:
            </span>
            {QUICK_FILTERS.map(({ label, value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleQuickFilter(value)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 dark:bg-slate-800/20 dark:hover:bg-slate-800/30 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Search Suggestions and Results */}
        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-white/30 dark:border-slate-700/30 rounded-xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto">
            {query.length > 0 ? (
              <div className="p-4">
                <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300 mb-3">
                  <Sparkles className="w-4 h-4" />
                  <span>Searching for "{query}"...</span>
                </div>
                
                {/* Search Results Preview */}
                {isSearching && (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Recent Searches
                    </h4>
                    <div className="space-y-1">
                      {recentSearches.slice(0, 3).map((search, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestedSearch(search)}
                          className="w-full text-left px-3 py-2 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg text-sm transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <Search className="w-3 h-3 text-slate-400" />
                            <span>{search}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Suggested Searches */}
                {displaySuggestions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Suggested Searches
                    </h4>
                    <div className="grid grid-cols-2 gap-1">
                      {displaySuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestedSearch(suggestion)}
                          className="text-left px-3 py-2 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg text-sm transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <Tag className="w-3 h-3 text-blue-400" />
                            <span>{suggestion}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Advanced Filters Panel */}
        {showFilters && showAdvancedFilters && (
          <div className="absolute top-full right-0 mt-2 w-80 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-white/30 dark:border-slate-700/30 rounded-xl shadow-2xl z-50 p-4">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Advanced Filters
            </h4>
            
            <div className="space-y-4">
              {/* Date Range Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, from: date } as any
                      }));
                    }}
                  />
                  <input
                    type="date"
                    className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, to: date } as any
                      }));
                    }}
                  />
                </div>
              </div>
              
              {/* Categories Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Categories
                </label>
                <div className="flex flex-wrap gap-1">
                  {['AI Research', 'Tech News', 'Industry', 'Machine Learning'].map(category => (
                    <button
                      key={category}
                      onClick={() => {
                        setFilters(prev => {
                          const categories = prev.categories || [];
                          const exists = categories.includes(category);
                          return {
                            ...prev,
                            categories: exists 
                              ? categories.filter(c => c !== category)
                              : [...categories, category]
                          };
                        });
                      }}
                      className={cn(
                        "px-2 py-1 text-xs rounded transition-colors",
                        (filters.categories || []).includes(category)
                          ? "bg-blue-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Clear Filters */}
              <button
                onClick={() => setFilters({})}
                className="w-full px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </SafeComponentErrorBoundary>
  );
});