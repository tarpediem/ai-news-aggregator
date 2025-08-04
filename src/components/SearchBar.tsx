import { Search, X, Sparkles, Zap } from 'lucide-react';
import React, { useState, useEffect, memo, useCallback } from 'react';

import { cn } from '../lib/utils';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = memo(({ 
  placeholder = "Search AI news and papers...", 
  onSearch, 
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsSearching(true);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate search delay
      onSearch(query);
      setIsSearching(false);
    }
  }, [query, onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
  }, [onSearch]);

  // Auto-search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        onSearch(query);
      } else if (query === '') {
        onSearch('');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <form onSubmit={handleSubmit} className={cn("relative group", className)}>
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
      
      {/* Search Suggestions (if needed) */}
      {isFocused && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/30 dark:border-slate-700/30 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300">
              <Sparkles className="w-4 h-4" />
              <span>Searching for "{query}"...</span>
            </div>
          </div>
        </div>
      )}
    </form>
  );
});