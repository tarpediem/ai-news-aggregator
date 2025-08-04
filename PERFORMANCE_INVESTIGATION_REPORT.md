# AI News App Performance Investigation Report

## Executive Summary

The AI News App is experiencing severe performance issues that cause long loading times and crashes. The primary bottleneck is the synchronous scraping of 8 news sources on initial page load, with each source having a 30-second timeout. This can block the UI for 4+ minutes in worst-case scenarios.

## Critical Issues Identified

### 1. **Blocking Initial Load (CRITICAL)**
**Location**: `/src/hooks/useNews.ts` and `/src/services/newsService.ts`
- **Problem**: The `useNews` hook immediately triggers `fetchNews()` which scrapes all 8 sources simultaneously
- **Impact**: Page navigation times out after 30 seconds, app becomes unresponsive
- **Root Cause**: Synchronous operations with 30-second timeouts per source

### 2. **Aggressive Scraping Timeouts (CRITICAL)**
**Location**: `/scraper-backend/server.js` (line 110)
- **Problem**: Each scraping request has a 30-second timeout
- **Impact**: 8 sources × 30 seconds = 4+ minutes worst-case load time
- **Current Code**:
```javascript
timeout: 30000, // 30 seconds - TOO LONG
```

### 3. **No Progressive Loading (HIGH)**
**Location**: `/src/services/newsService.ts` (lines 290-304)
- **Problem**: All articles must be fetched before any are displayed
- **Impact**: Users see blank screen for minutes
- **Current Code**:
```typescript
const articles = await batchRequests(
  sourcesToScrape,
  async (sources: NewsSourceConfig[]) => {
    // Waits for ALL sources to complete
    const results = await Promise.allSettled(scrapePromises);
    return results // Only returns after all complete
  }
);
```

### 4. **Memory Leaks in Virtual Scrolling (HIGH)**
**Location**: `/src/components/VirtualScrollList.tsx`
- **Problem**: Multiple `performance.now()` calls and state updates on every render
- **Impact**: Memory usage grows over time, eventual crashes
- **Current Code**:
```typescript
const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
  // Called on every scroll event
  setVirtualState(prev => ({ ...prev, scrollTop, isScrolling: true }));
  // Multiple setTimeout calls accumulate
}, [onScroll]);
```

### 5. **Cache Invalidation Issues (MEDIUM)**
**Location**: `/src/hooks/useNews.ts` (lines 50-58)
- **Problem**: Refresh function invalidates ALL caches simultaneously
- **Impact**: Cache thrashing causes repeated expensive operations
- **Current Code**:
```typescript
export const useRefreshNews = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['news'] });
    queryClient.invalidateQueries({ queryKey: ['arxiv'] });
    queryClient.invalidateQueries({ queryKey: ['trending-topics'] });
  };
};
```

### 6. **Request Queue Bottleneck (MEDIUM)**
**Location**: `/src/utils/requestQueue.ts`
- **Problem**: Maximum 3 concurrent requests for 8 news sources
- **Impact**: Creates significant queuing delays
- **Current Code**:
```typescript
maxConcurrent: 3, // Too low for 8 sources
minDelay: 100, // Too aggressive for external APIs
```

## Performance Metrics

### Current State (Problematic)
- **Initial Load Time**: 30+ seconds (timeout)
- **Memory Usage**: Growing over time (memory leaks)
- **Cache Hit Rate**: Low due to short cache times
- **Error Rate**: High due to aggressive timeouts

### Target State (Optimized)
- **Initial Load Time**: <3 seconds for first articles
- **Progressive Loading**: Articles appear as they're scraped
- **Memory Usage**: Stable over time
- **Cache Hit Rate**: >80% for repeat visits

## Recommended Immediate Fixes

### 1. **Reduce Scraping Timeouts**
**File**: `/scraper-backend/server.js`
```javascript
// Change from:
timeout: 30000,

// To:
timeout: 5000, // 5 seconds maximum
```

### 2. **Implement Progressive Loading**
**File**: `/src/services/newsService.ts`
```typescript
// Add progressive loading to fetchNews method
async fetchNews(category?: NewsCategory): Promise<NewsArticle[]> {
  const sourcesToScrape = this.getSourcesForCategory(category);
  const articles: NewsArticle[] = [];
  
  // Process sources progressively
  for (const source of sourcesToScrape) {
    try {
      const sourceArticles = await this.scrapeNewsSource(source);
      articles.push(...sourceArticles);
      
      // Yield control to UI thread
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      console.warn(`Failed to scrape ${source.name}:`, error);
      // Continue with other sources
    }
  }
  
  return this.sortAndLimitArticles(articles);
}
```

### 3. **Add Error Boundaries**
**File**: `/src/components/ErrorBoundary.tsx` (already exists, needs implementation)
```typescript
// Wrap the main app content with proper error handling
<ErrorBoundary>
  <AppContent />
</ErrorBoundary>
```

### 4. **Optimize Virtual Scrolling**
**File**: `/src/components/VirtualScrollList.tsx`
```typescript
// Throttle performance measurements
const throttledUpdateMetrics = useMemo(
  () => throttle(updateMetrics, 100), // Only update every 100ms
  []
);

// Remove performance monitoring in production
if (process.env.NODE_ENV === 'development') {
  throttledUpdateMetrics(renderStart, visibleCount, totalCount);
}
```

### 5. **Increase Cache Duration**
**File**: `/src/config/constants.ts`
```typescript
export const CACHE_CONFIG = {
  NEWS_TIMEOUT: 30 * 60 * 1000, // 30 minutes instead of 15
  QUERY_STALE_TIME: 15 * 60 * 1000, // 15 minutes instead of 5
  QUERY_GC_TIME: 30 * 60 * 1000, // 30 minutes instead of 10
  // ... other cache settings
};
```

## Architecture Recommendations

### Short-term (1-2 weeks)
1. **Implement circuit breaker pattern** for failed scrapers
2. **Add skeleton loading screens** for better UX
3. **Implement request deduplication** to prevent duplicate API calls
4. **Add health check endpoints** for monitoring

### Medium-term (1-2 months)
1. **Move scraping to background workers** with job queuing
2. **Implement real-time updates** via WebSockets
3. **Add comprehensive monitoring** and alerting
4. **Implement proper offline support**

### Long-term (3+ months)
1. **Migrate to server-side rendering** for better initial load
2. **Implement microservices architecture** for scalability
3. **Add CDN and edge caching** for global performance
4. **Implement machine learning** for content relevance

## Testing Strategy

### Performance Testing
1. **Load Testing**: Test with 100+ concurrent users
2. **Stress Testing**: Test with limited network conditions
3. **Memory Testing**: Monitor memory usage over extended periods
4. **Timeout Testing**: Verify behavior when external APIs are slow

### Monitoring
1. **Add performance monitoring** to track real-world usage
2. **Implement error tracking** for production issues
3. **Set up alerts** for performance degradation
4. **Add user experience metrics** (Core Web Vitals)

## Files Requiring Immediate Attention

1. `/scraper-backend/server.js` - Reduce timeouts
2. `/src/services/newsService.ts` - Implement progressive loading
3. `/src/components/VirtualScrollList.tsx` - Optimize performance monitoring
4. `/src/config/constants.ts` - Adjust cache settings
5. `/src/hooks/useNews.ts` - Add error handling

## Conclusion

The AI News App's performance issues stem from an overly aggressive scraping strategy that blocks the UI thread. The immediate priority is reducing timeouts and implementing progressive loading. With these changes, the app should load within 3-5 seconds instead of timing out after 30+ seconds.

The recommended fixes are relatively straightforward to implement and will provide immediate performance improvements while maintaining the app's core functionality.