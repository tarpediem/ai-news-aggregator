import { Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '../lib/utils';
import type { NewsCategory } from '../types/news';

interface CategoryFilterProps {
  selectedCategory: NewsCategory | null;
  onCategoryChange: (category: NewsCategory | null) => void;
  className?: string;
}

const categories: { value: NewsCategory | null; label: string; icon: string; color: string; gradient: string }[] = [
  { value: null, label: 'All', icon: '🌐', color: 'from-slate-500 to-slate-600', gradient: 'from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700' },
  { value: 'artificial-intelligence', label: 'AI', icon: '🤖', color: 'from-blue-500 to-cyan-600', gradient: 'from-blue-100 to-cyan-100 dark:from-blue-900 dark:to-cyan-900' },
  { value: 'machine-learning', label: 'ML', icon: '🧠', color: 'from-purple-500 to-violet-600', gradient: 'from-purple-100 to-violet-100 dark:from-purple-900 dark:to-violet-900' },
  { value: 'deep-learning', label: 'Deep Learning', icon: '🔥', color: 'from-red-500 to-orange-600', gradient: 'from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900' },
  { value: 'nlp', label: 'NLP', icon: '💬', color: 'from-green-500 to-emerald-600', gradient: 'from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900' },
  { value: 'computer-vision', label: 'Computer Vision', icon: '👁️', color: 'from-indigo-500 to-blue-600', gradient: 'from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-900' },
  { value: 'robotics', label: 'Robotics', icon: '🤖', color: 'from-teal-500 to-cyan-600', gradient: 'from-teal-100 to-cyan-100 dark:from-teal-900 dark:to-cyan-900' },
  { value: 'research', label: 'Research', icon: '🔬', color: 'from-pink-500 to-rose-600', gradient: 'from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900' },
  { value: 'industry', label: 'Industry', icon: '🏢', color: 'from-amber-500 to-yellow-600', gradient: 'from-amber-100 to-yellow-100 dark:from-amber-900 dark:to-yellow-900' },
  { value: 'startups', label: 'Startups', icon: '🚀', color: 'from-violet-500 to-purple-600', gradient: 'from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900' },
  { value: 'tech-news', label: 'Tech News', icon: '📱', color: 'from-gray-500 to-slate-600', gradient: 'from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800' },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
  selectedCategory, 
  onCategoryChange, 
  className = '' 
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<NewsCategory | null>(null);

  return (
    <div className={cn("relative", className)}>
      {/* Background Container */}
      <div className="backdrop-blur-xl bg-white/20 dark:bg-slate-900/20 border border-white/20 dark:border-slate-700/20 rounded-2xl p-4 shadow-lg">
        
        {/* Category Pills Container */}
        <div className="flex flex-wrap gap-3">
          {categories.map((category, index) => {
            const isSelected = selectedCategory === category.value;
            const isHovered = hoveredCategory === category.value;
            
            return (
              <button
                key={category.value || 'all'}
                onClick={() => onCategoryChange(category.value)}
                onMouseEnter={() => setHoveredCategory(category.value)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={cn(
                  "group relative flex items-center space-x-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105",
                  "backdrop-blur-sm border border-white/20 dark:border-slate-700/20",
                  isSelected
                    ? "shadow-lg scale-105"
                    : "hover:shadow-md"
                )}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Background Gradient */}
                <div className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  isSelected
                    ? `bg-gradient-to-r ${category.color}`
                    : `bg-gradient-to-r ${category.gradient} opacity-50 group-hover:opacity-80`
                )} />
                
                {/* Glow Effect for Selected */}
                {isSelected && (
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-r rounded-full blur-md opacity-40 animate-pulse",
                    category.color
                  )} />
                )}
                
                {/* Hover Glow */}
                {isHovered && !isSelected && (
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-r rounded-full blur-sm opacity-30 transition-opacity duration-300",
                    category.color
                  )} />
                )}
                
                {/* Content */}
                <div className="relative z-10 flex items-center space-x-2">
                  <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                    {category.icon}
                  </span>
                  <span className={cn(
                    "transition-colors duration-200",
                    isSelected 
                      ? "text-white font-semibold" 
                      : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                  )}>
                    {category.label}
                  </span>
                  
                  {/* Active Indicator */}
                  {isSelected && (
                    <div className="flex items-center space-x-1">
                      <Zap className="w-3 h-3 text-white animate-pulse" />
                    </div>
                  )}
                  
                  {/* Hover Effect Sparkles */}
                  {isHovered && !isSelected && (
                    <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" />
                  )}
                </div>
                
                {/* Selection Ring */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
        
        {/* Category Count Badge */}
        <div className="mt-3 pt-3 border-t border-white/10 dark:border-slate-700/10">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>
                {selectedCategory ? `Filtered by ${categories.find(c => c.value === selectedCategory)?.label}` : 'Showing all categories'}
              </span>
            </div>
            <div className="flex items-center space-x-1 px-2 py-1 bg-white/20 dark:bg-slate-800/20 rounded-lg">
              <span>{categories.length}</span>
              <span>categories</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};