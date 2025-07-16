import React, { useState } from 'react';
import type { NewsArticle } from '../types/news';
import { formatDate, truncateText, getSourceLogo } from '../lib/utils';
import { ExternalLink, Clock, User, Tag, Sparkles, TrendingUp, Eye } from 'lucide-react';

interface NewsCardProps {
  article: NewsArticle;
  className?: string;
}

export const NewsCard: React.FC<NewsCardProps> = ({ article, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const relevanceColor = article.relevanceScore && article.relevanceScore > 0.8 
    ? 'from-emerald-500 to-green-600' 
    : article.relevanceScore && article.relevanceScore > 0.6 
    ? 'from-blue-500 to-cyan-600' 
    : 'from-slate-400 to-slate-500';

  return (
    <div 
      className={`group relative cursor-pointer transform transition-all duration-300 hover:scale-[1.02] ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Container with Glassmorphism */}
      <div className="relative backdrop-blur-xl bg-white/40 dark:bg-slate-900/40 border border-white/20 dark:border-slate-700/20 rounded-2xl overflow-hidden shadow-xl group-hover:shadow-2xl transition-all duration-500">
        
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 -z-10" />
        
        {/* Content */}
        <div className="relative z-10 p-6">
          {/* Image Section */}
          {article.urlToImage && (
            <div className="relative mb-6 overflow-hidden rounded-xl group/image">
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img 
                src={article.urlToImage} 
                alt={article.title}
                className="w-full h-48 object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
              />
              
              {/* Floating Read Button */}
              <div className="absolute bottom-4 right-4 z-20 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                <div className="flex items-center space-x-1 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full text-xs font-medium text-slate-900 dark:text-slate-100">
                  <Eye className="w-3 h-3" />
                  <span>Read</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Header with Source and Time */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs">
                  {getSourceLogo(article.source.name)}
                </div>
                {isHovered && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur animate-pulse" />
                )}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                {article.source.name}
              </span>
              {article.relevanceScore && article.relevanceScore > 0.8 && (
                <div className="flex items-center space-x-1 px-2 py-0.5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full">
                  <TrendingUp className="w-3 h-3 text-white" />
                  <span className="text-xs text-white font-medium">Hot</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3" />
              <span>{formatDate(article.publishedAt)}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-100 mb-3 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
            {article.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 line-clamp-3">
            {truncateText(article.description, 150)}
          </p>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {article.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-300 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/50 dark:hover:to-purple-900/50 transition-all duration-200 transform hover:scale-105"
                >
                  <Tag className="w-2.5 h-2.5 mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            {/* Author */}
            {article.author && (
              <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
                <User className="w-3 h-3" />
                <span>{article.author}</span>
              </div>
            )}
            
            {/* Read More Button */}
            <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              <ExternalLink className="w-3 h-3 transform group-hover:scale-110 transition-transform" />
              <span>Read more</span>
            </div>
          </div>

          {/* Relevance Score */}
          {article.relevanceScore && (
            <div className="mt-4 pt-4 border-t border-white/20 dark:border-slate-700/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Relevance Score</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`bg-gradient-to-r ${relevanceColor} rounded-full h-1.5 transition-all duration-500 shadow-sm`}
                      style={{ 
                        width: `${article.relevanceScore * 100}%`,
                        boxShadow: article.relevanceScore > 0.8 ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none'
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {Math.round(article.relevanceScore * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Hover Border Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none" style={{ padding: '1px' }}>
          <div className="w-full h-full bg-white/40 dark:bg-slate-900/40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
};