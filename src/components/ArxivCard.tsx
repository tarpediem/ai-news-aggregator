import { ExternalLink, Clock, Users, FileText, Download, Sparkles, BookOpen, Star, Zap } from 'lucide-react';
import React, { useState } from 'react';

import { formatDate, truncateText, cn } from '../lib/utils';
import type { ArxivPaper } from '../types/news';

interface ArxivCardProps {
  paper: ArxivPaper;
  className?: string;
}

export const ArxivCard: React.FC<ArxivCardProps> = ({ paper, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleReadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(paper.url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(paper.pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'cs.AI': 'from-blue-500 to-cyan-600',
      'cs.LG': 'from-purple-500 to-violet-600',
      'cs.CL': 'from-green-500 to-emerald-600',
      'cs.CV': 'from-indigo-500 to-blue-600',
      'cs.NE': 'from-pink-500 to-rose-600',
      'stat.ML': 'from-orange-500 to-amber-600',
      'math.ST': 'from-teal-500 to-cyan-600',
      'default': 'from-slate-500 to-slate-600'
    };
    return colors[category as keyof typeof colors] || colors.default;
  };

  return (
    <div 
      className={cn(
        "group relative cursor-pointer transform transition-all duration-500 hover:scale-[1.02]",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Container with Advanced Glassmorphism */}
      <div className="relative backdrop-blur-xl bg-white/50 dark:bg-slate-900/50 border border-white/30 dark:border-slate-700/30 rounded-3xl overflow-hidden shadow-2xl group-hover:shadow-3xl transition-all duration-500">
        
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Outer Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-cyan-600/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 -z-10" />
        
        {/* Floating Action Buttons */}
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
          <div className="flex space-x-2">
            <button
              onClick={handleReadClick}
              className="group/btn relative p-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-0 group-hover/btn:opacity-20 transition-opacity" />
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 relative z-10" />
            </button>
            <button
              onClick={handleDownloadClick}
              className="group/btn relative p-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl opacity-0 group-hover/btn:opacity-20 transition-opacity" />
              <Download className="w-4 h-4 text-purple-600 dark:text-purple-400 relative z-10" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-8">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-lg">🔬</span>
                </div>
                {isHovered && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur animate-pulse" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  arXiv
                </span>
                <div className="w-1 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
                <span className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg",
                  `bg-gradient-to-r ${getCategoryColor(paper.primaryCategory)}`
                )}>
                  {paper.primaryCategory}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/20">
              <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {formatDate(paper.published)}
              </span>
            </div>
          </div>

          {/* Title with Gradient Hover Effect */}
          <h3 className="text-xl font-bold leading-tight text-slate-900 dark:text-slate-100 mb-4 group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-blue-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
            {paper.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5 line-clamp-4">
            {truncateText(paper.summary, 250)}
          </p>

          {/* Authors Section */}
          <div className="flex items-center space-x-2 mb-5 p-3 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-xl border border-white/20">
            <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Users className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              {paper.authors.length > 2 
                ? `${paper.authors.slice(0, 2).join(', ')} +${paper.authors.length - 2} more`
                : paper.authors.join(', ')
              }
            </span>
          </div>

          {/* Categories */}
          {paper.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {paper.categories.slice(0, 4).map((category, index) => (
                <span 
                  key={index}
                  className={cn(
                    "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-md transition-all duration-200 hover:scale-105",
                    `bg-gradient-to-r ${getCategoryColor(category)}`
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  {category}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {paper.tags && paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {paper.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-300 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 transition-all duration-200 transform hover:scale-105"
                >
                  <Star className="w-2.5 h-2.5 mr-1" />
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/20 dark:border-slate-700/20">
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <Zap className="w-3 h-3" />
              <span>ID: {paper.id}</span>
              {paper.updated !== paper.published && (
                <>
                  <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                  <span>Updated: {formatDate(paper.updated)}</span>
                </>
              )}
            </div>
            
            {/* Interactive Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleReadClick}
                className="group/read flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <FileText className="w-3 h-3 group-hover/read:rotate-12 transition-transform" />
                <span>Read Paper</span>
                <ExternalLink className="w-3 h-3 group-hover/read:translate-x-0.5 group-hover/read:-translate-y-0.5 transition-transform" />
              </button>
              
              <button
                onClick={handleDownloadClick}
                className="group/download flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 backdrop-blur-sm border border-white/20 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-all duration-200 hover:scale-105"
              >
                <Download className="w-3 h-3 group-hover/download:translate-y-0.5 transition-transform" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Animated Border Effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none" style={{ padding: '1px' }}>
          <div className="w-full h-full bg-white/50 dark:bg-slate-900/50 rounded-3xl" />
        </div>
      </div>
    </div>
  );
};