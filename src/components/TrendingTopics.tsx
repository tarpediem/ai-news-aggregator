import { TrendingUp, Sparkles, Zap, Star, Hash, Flame } from 'lucide-react';
import React, { useState } from 'react';

import { useTrendingTopics } from '../hooks/useNews';
import { cn } from '../lib/utils';

interface TrendingTopicsProps {
  onTopicClick: (topic: string) => void;
  className?: string;
}

const topicIcons = ['🔥', '⚡', '🌟', '💫', '🚀', '💎', '🌈', '✨'];
const gradientColors = [
  'from-red-500 to-orange-600',
  'from-blue-500 to-cyan-600', 
  'from-purple-500 to-violet-600',
  'from-green-500 to-emerald-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-amber-500 to-yellow-600',
  'from-teal-500 to-cyan-600'
];

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({ 
  onTopicClick, 
  className = '' 
}) => {
  const { data: topics, isLoading, error } = useTrendingTopics();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className={cn("relative", className)}>
        {/* Glassmorphism Container */}
        <div className="backdrop-blur-xl bg-white/20 dark:bg-slate-900/20 border border-white/20 dark:border-slate-700/20 rounded-2xl p-6 shadow-lg">
          {/* Header Skeleton */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-xl animate-pulse" />
            <div className="w-40 h-6 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg animate-pulse" />
          </div>
          
          {/* Topic Pills Skeleton */}
          <div className="flex flex-wrap gap-3">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="h-10 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-full animate-pulse"
                style={{ 
                  width: `${80 + Math.random() * 60}px`,
                  animationDelay: `${i * 100}ms` 
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !topics) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 via-red-400/10 to-pink-400/10 rounded-2xl blur-xl opacity-50" />
      
      {/* Glassmorphism Container */}
      <div className="relative backdrop-blur-xl bg-white/30 dark:bg-slate-900/30 border border-white/20 dark:border-slate-700/20 rounded-2xl p-6 shadow-2xl">
        {/* Header with Animated Icon */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl blur opacity-75 animate-pulse" />
              <div className="relative p-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl shadow-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-red-600 via-orange-600 to-pink-600 bg-clip-text text-transparent">
                Trending Topics
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                <Flame className="w-3 h-3" />
                <span>Hot AI discussions right now</span>
              </p>
            </div>
          </div>
          
          {/* Live Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/20 border border-red-300/30 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">LIVE</span>
          </div>
        </div>
        
        {/* Topic Pills with Advanced Animations */}
        <div className="flex flex-wrap gap-3">
          {topics.map((topic, index) => {
            const isHovered = hoveredIndex === index;
            const icon = topicIcons[index % topicIcons.length];
            const gradient = gradientColors[index % gradientColors.length];
            
            return (
              <button
                key={index}
                onClick={() => onTopicClick(topic)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 focus:scale-105 outline-none"
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                {/* Background Gradient */}
                <div className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  isHovered
                    ? `bg-gradient-to-r ${gradient} opacity-90`
                    : "bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border border-white/30 dark:border-slate-700/30"
                )} />
                
                {/* Hover Glow Effect */}
                {isHovered && (
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-r rounded-full blur-md opacity-50 animate-pulse -z-10",
                    gradient
                  )} />
                )}
                
                {/* Content */}
                <div className="relative z-10 flex items-center space-x-2">
                  <span className="text-base group-hover:scale-110 transition-transform duration-200">
                    {icon}
                  </span>
                  <span className={cn(
                    "transition-colors duration-200 font-semibold",
                    isHovered 
                      ? "text-white" 
                      : "text-slate-700 dark:text-slate-300"
                  )}>
                    {topic}
                  </span>
                  
                  {/* Trending Indicator for hot topics */}
                  {index < 3 && (
                    <div className="flex items-center">
                      {isHovered ? (
                        <Star className="w-3 h-3 text-white animate-pulse" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-orange-500 animate-pulse" />
                      )}
                    </div>
                  )}
                  
                  {/* Hash symbol for lower priority topics */}
                  {index >= 3 && isHovered && (
                    <Hash className="w-3 h-3 text-white/80" />
                  )}
                </div>
                
                {/* Ripple Effect on Click */}
                <div className="absolute inset-0 rounded-full bg-white/20 scale-0 group-active:scale-100 transition-transform duration-150 pointer-events-none" />
              </button>
            );
          })}
        </div>
        
        {/* Stats Footer */}
        <div className="mt-4 pt-4 border-t border-white/10 dark:border-slate-700/10">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <Zap className="w-3 h-3" />
              <span>Updated every 5 minutes</span>
            </div>
            <div className="flex items-center space-x-1 px-2 py-1 bg-white/20 dark:bg-slate-800/20 rounded-lg">
              <span>{topics.length}</span>
              <span>trending now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};