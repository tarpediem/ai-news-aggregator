/**
 * Virtualized news list component for optimal performance with large datasets
 * Integrates with existing NewsCard while providing virtual scrolling capabilities
 */

import React, { useMemo, useState, useCallback } from 'react';

import { cn } from '../lib/utils';
import type { NewsArticle } from '../types/news';

import { NewsCard } from './NewsCard';
import { VirtualScrollList } from './VirtualScrollList';

interface VirtualizedNewsListProps {
  articles: NewsArticle[];
  className?: string;
  onArticleClick?: (article: NewsArticle) => void;
  itemsPerRow?: number;
  containerHeight?: number;
  showPerformanceMetrics?: boolean;
}

interface GridItem {
  articles: NewsArticle[];
  rowIndex: number;
}

export function VirtualizedNewsList({
  articles,
  className = '',
  onArticleClick,
  itemsPerRow = 3,
  containerHeight = 600,
  showPerformanceMetrics = false,
}: VirtualizedNewsListProps) {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderTime: 0,
    visibleItems: 0,
    scrollPosition: 0,
  });

  // Group articles into rows for grid layout
  const gridItems = useMemo(() => {
    const groups: GridItem[] = [];
    for (let i = 0; i < articles.length; i += itemsPerRow) {
      groups.push({
        articles: articles.slice(i, i + itemsPerRow),
        rowIndex: Math.floor(i / itemsPerRow),
      });
    }
    return groups;
  }, [articles, itemsPerRow]);

  // Calculate row height based on card height + spacing
  const rowHeight = useMemo(() => {
    // Base card height + margin/padding
    return 420; // Approximate height of NewsCard + spacing
  }, []);

  // Memoized render function for better performance
  const renderRow = useCallback(
    (gridItem: GridItem, index: number) => {
      const renderStart = showPerformanceMetrics ? performance.now() : 0;
      
      const row = (
        <div
          className="grid gap-8 px-4 py-2"
          style={{
            gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
            minHeight: rowHeight - 16, // Account for padding
          }}
        >
          {gridItem.articles.map((article, articleIndex) => (
            <div
              key={article.id}
              className="animate-fade-in"
              style={{
                // Only animate first few items to reduce CPU load
                animationDelay: index < 3 ? `${articleIndex * 50}ms` : '0ms',
              }}
            >
              <NewsCard
                article={article}
                onClick={() => onArticleClick?.(article)}
                priority={index < 2} // High priority for first 2 rows
                lazy={index > 1} // Lazy load images after first 2 rows
              />
            </div>
          ))}
          
          {/* Fill empty slots in last row - memoized to prevent re-creation */}
          {gridItem.articles.length < itemsPerRow &&
            Array.from({ length: itemsPerRow - gridItem.articles.length }, (_, i) => (
              <div key={`empty-${i}`} className="invisible" aria-hidden="true" />
            ))}
        </div>
      );

      // Update performance metrics only in development and when requested
      if (showPerformanceMetrics && process.env.NODE_ENV === 'development') {
        const renderTime = performance.now() - renderStart;
        // Use requestAnimationFrame to avoid blocking render and throttle updates
        requestAnimationFrame(() => {
          setPerformanceMetrics(prev => {
            // Only update if significantly different to prevent excessive re-renders
            const newRenderTime = Math.max(prev.renderTime, renderTime);
            const newVisibleItems = gridItem.articles.length;
            
            if (Math.abs(newRenderTime - prev.renderTime) < 0.1 && 
                newVisibleItems === prev.visibleItems) {
              return prev; // Don't update if changes are minimal
            }
            
            return {
              ...prev,
              renderTime: newRenderTime,
              visibleItems: newVisibleItems,
            };
          });
        });
      }

      return row;
    },
    [itemsPerRow, rowHeight, onArticleClick, showPerformanceMetrics]
  );

  // Throttled scroll handler for performance monitoring
  const handleScroll = useCallback(
    (scrollTop: number) => {
      if (showPerformanceMetrics && process.env.NODE_ENV === 'development') {
        // Use requestAnimationFrame to avoid blocking scroll and throttle updates
        requestAnimationFrame(() => {
          setPerformanceMetrics(prev => {
            // Only update if scroll position changed significantly (>10px)
            if (Math.abs(scrollTop - prev.scrollPosition) < 10) {
              return prev;
            }
            
            return {
              ...prev,
              scrollPosition: scrollTop,
            };
          });
        });
      }
    },
    [showPerformanceMetrics]
  );

  // Generate unique key for each row
  const getRowKey = useCallback(
    (gridItem: GridItem, index: number) => {
      return `row-${gridItem.rowIndex}-${gridItem.articles[0]?.id || index}`;
    },
    []
  );

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">📰</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-lg">No articles available</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Try adjusting your filters or check back later
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Performance metrics overlay (development only) */}
      {showPerformanceMetrics && process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 right-4 z-10 bg-black/80 text-white text-xs p-2 rounded">
          <div>Render: {performanceMetrics.renderTime.toFixed(2)}ms</div>
          <div>Visible: {performanceMetrics.visibleItems}</div>
          <div>Scroll: {Math.round(performanceMetrics.scrollPosition)}px</div>
          <div>Total: {articles.length} articles</div>
          <div>Rows: {gridItems.length}</div>
        </div>
      )}

      {/* Virtual scrolling container */}
      <VirtualScrollList
        items={gridItems}
        itemHeight={rowHeight}
        containerHeight={containerHeight}
        renderItem={renderRow}
        getItemKey={getRowKey}
        onScroll={handleScroll}
        overscan={2} // Render 2 extra rows above/below viewport
        className="rounded-lg"
      />

      {/* Optimized scrollbar styles - only inject once */}
      {process.env.NODE_ENV === 'development' && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .virtual-scroll-container::-webkit-scrollbar {
              width: 8px;
            }
            .virtual-scroll-container::-webkit-scrollbar-track {
              background: transparent;
            }
            .virtual-scroll-container::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.3);
              border-radius: 4px;
            }
            .virtual-scroll-container::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.5);
            }
            
            .animate-fade-in {
              animation: fadeIn 0.3s ease-out;
            }
            
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `
        }} />
      )}
    </div>
  );
}

// Hook for responsive grid configuration
export function useResponsiveGrid() {
  const [itemsPerRow, setItemsPerRow] = useState(3);
  const [containerHeight, setContainerHeight] = useState(600);

  React.useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const updateLayout = () => {
      // Clear any pending timeout to debounce resize events
      clearTimeout(resizeTimeout);
      
      resizeTimeout = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Responsive grid columns
        let newItemsPerRow = 3;
        if (width < 768) {
          newItemsPerRow = 1; // Mobile: single column
        } else if (width < 1024) {
          newItemsPerRow = 2; // Tablet: two columns
        }

        // Responsive container height (80% of viewport height)
        const newContainerHeight = Math.max(400, Math.round(height * 0.8));
        
        // Only update state if values actually changed
        setItemsPerRow(prev => prev !== newItemsPerRow ? newItemsPerRow : prev);
        setContainerHeight(prev => {
          // Only update if difference is significant (>20px)
          return Math.abs(prev - newContainerHeight) > 20 ? newContainerHeight : prev;
        });
      }, 100); // Debounce resize events by 100ms
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    
    return () => {
      window.removeEventListener('resize', updateLayout);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return { itemsPerRow, containerHeight };
}

// Performance monitoring utilities
export const VirtualScrollPerformance = {
  measure: (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  },
  
  markStart: (name: string) => {
    performance.mark(`${name}-start`);
  },
  
  markEnd: (name: string) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  },
};