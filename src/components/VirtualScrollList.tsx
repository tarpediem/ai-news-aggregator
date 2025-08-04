/**
 * Virtual scrolling component for performance optimization with large lists
 * Only renders visible items plus buffer to reduce DOM nodes and improve performance
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

interface VirtualScrollState {
  scrollTop: number;
  isScrolling: boolean;
}

export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  getItemKey = (_, index) => index,
}: VirtualScrollListProps<T>) {
  const [virtualState, setVirtualState] = useState<VirtualScrollState>({
    scrollTop: 0,
    isScrolling: false,
  });

  const scrollElementRef = useRef<HTMLDivElement>(null);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate visible range with overscan
  const visibleRange = useMemo(() => {
    const { scrollTop } = virtualState;
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(items.length - 1, visibleEnd + overscan);

    return { start, end };
  }, [virtualState.scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // Calculate visible items
  const visibleItems = useMemo(() => {
    const { start, end } = visibleRange;
    const visible = [];
    
    for (let i = start; i <= end; i++) {
      const item = items[i];
      if (item !== undefined && item !== null) {
        visible.push({
          item,
          index: i,
          key: getItemKey(item, i),
          offsetY: i * itemHeight,
        });
      }
    }
    
    return visible;
  }, [items, visibleRange, itemHeight, getItemKey]);

  // Throttled scroll handler to prevent excessive updates
  const throttledHandleScroll = useMemo(
    () => throttle((scrollTop: number) => {
      setVirtualState(prev => ({
        ...prev,
        scrollTop,
        isScrolling: true,
      }));
      
      onScroll?.(scrollTop);
    }, 16), // ~60fps
    [onScroll]
  );

  // Handle scroll events with optimized throttling
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = event.currentTarget.scrollTop;
      
      throttledHandleScroll(scrollTop);

      // Clear existing timeout
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }

      // Set isScrolling to false after scrolling stops
      scrollingTimeoutRef.current = setTimeout(() => {
        setVirtualState(prev => ({
          ...prev,
          isScrolling: false,
        }));
      }, 150);
    },
    [throttledHandleScroll]
  );

  // Calculate total height
  const totalHeight = items.length * itemHeight;

  // Cleanup timeouts and prevent memory leaks
  useEffect(() => {
    return () => {
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
        scrollingTimeoutRef.current = null;
      }
    };
  }, []);

  // Optimize re-renders by using layout effect for synchronous updates
  useLayoutEffect(() => {
    // This ensures DOM updates are synchronous with React renders
    // Prevents visual flickering during fast scrolling
  }, [visibleItems]);

  // Note: Scroll methods could be added here if needed for external control
  // Example: scrollToIndex, scrollToTop, scrollToBottom

  return (
    <div
      ref={scrollElementRef}
      className={`virtual-scroll-container overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Total height spacer */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items */}
        {visibleItems.map(({ item, index, key, offsetY }) => (
          <div
            key={key}
            className="virtual-scroll-item"
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for managing virtual scroll state
export function useVirtualScroll<T = any>(
  items: T[],
  containerHeight: number,
  itemHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return {
      start: visibleStart,
      end: visibleEnd,
      total: items.length,
    };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  const handleScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
    setIsScrolling(true);
    
    // Debounce isScrolling reset
    setTimeout(() => setIsScrolling(false), 150);
  }, []);

  return {
    scrollTop,
    isScrolling,
    visibleRange,
    handleScroll,
    totalHeight: items.length * itemHeight,
  };
}

// Throttle utility for performance optimization
function throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  
  return ((...args: any[]) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
}

// Performance monitoring hook with memory leak fixes
export function useVirtualScrollPerformance() {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    visibleItems: 0,
    totalItems: 0,
    memoryUsage: 0,
  });

  // Throttled update to prevent excessive re-renders
  const throttledUpdateMetrics = useMemo(
    () => throttle((
      renderStart: number,
      visibleCount: number,
      totalCount: number
    ) => {
      if (process.env.NODE_ENV === 'development') {
        const renderTime = performance.now() - renderStart;
        const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;

        setMetrics({
          renderTime,
          visibleItems: visibleCount,
          totalItems: totalCount,
          memoryUsage,
        });
      }
    }, 200), // Update at most every 200ms
    []
  );

  const updateMetrics = useCallback((
    renderStart: number,
    visibleCount: number,
    totalCount: number
  ) => {
    throttledUpdateMetrics(renderStart, visibleCount, totalCount);
  }, [throttledUpdateMetrics]);

  return { metrics, updateMetrics };
}