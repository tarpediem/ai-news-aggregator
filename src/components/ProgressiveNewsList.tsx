/**
 * Progressive News List Component
 * Displays news articles as they load progressively
 */

import React, { useState, useEffect, useCallback } from 'react';

import { useProgressiveNewsLoader } from '../services/ProgressiveNewsLoader';
import { useAppStore, useNewsData } from '../store/AppStore';
import type { NewsArticle, NewsCategory } from '../types/news';

import { useAccessibility } from './AccessibilityProvider';
import { AccessibleNewsArticle } from './AccessibleNewsArticle';
import { VirtualScrollList } from './VirtualScrollList';


interface ProgressiveNewsListProps {
  className?: string;
  layout?: 'list' | 'grid' | 'compact';
  showProgress?: boolean;
  autoLoad?: boolean;
  categories?: NewsCategory[];
}

export const ProgressiveNewsList: React.FC<ProgressiveNewsListProps> = ({
  className = '',
  layout = 'list',
  showProgress = true,
  autoLoad = true,
  categories,
}) => {
  const [loadingMessages, setLoadingMessages] = useState<string[]>([]);
  const [showLoadingDetails, setShowLoadingDetails] = useState(false);
  
  const { loadingState, isLoading, quickLoad, qualityLoad, refresh } = useProgressiveNewsLoader();
  const { articles, selectedCategory } = useNewsData();
  const { announceMessage } = useAccessibility();
  const store = useAppStore.getState();


  // Initial load
  useEffect(() => {
    if (autoLoad && articles.length === 0) {
      quickLoad(20);
    }
  }, [autoLoad, articles.length, quickLoad]);

  // Handle category changes
  useEffect(() => {
    if (selectedCategory && selectedCategory !== 'all') {
      qualityLoad([selectedCategory]);
    }
  }, [selectedCategory, qualityLoad]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setLoadingMessages([]);
    await refresh();
  }, [refresh]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    await qualityLoad(categories);
  }, [qualityLoad, categories]);

  // Render loading indicator
  const renderLoadingIndicator = () => {
    if (!isLoading && !showProgress) return null;

    return (
      <div className="loading-indicator bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <div>
              <div className="font-medium text-blue-900">
                {isLoading ? 'Loading news articles...' : 'Loading complete'}
              </div>
              <div className="text-sm text-blue-700">
                {loadingState.loadedSources} of {loadingState.totalSources} sources loaded
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowLoadingDetails(!showLoadingDetails)}
            className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded text-sm"
            aria-expanded={showLoadingDetails}
          >
            {showLoadingDetails ? 'Hide' : 'Show'} Details
          </button>
        </div>

        {/* Progress bar */}
        {loadingState.totalSources > 0 && (
          <div className="mt-3">
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(loadingState.loadedSources / loadingState.totalSources) * 100}%` 
                }}
              />
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {Math.round((loadingState.loadedSources / loadingState.totalSources) * 100)}% complete
            </div>
          </div>
        )}

        {/* Loading details */}
        {showLoadingDetails && (
          <div className="mt-3 border-t border-blue-200 pt-3">
            <div className="space-y-1">
              {loadingMessages.map((message, index) => (
                <div key={index} className="text-sm text-blue-700">
                  {message}
                </div>
              ))}
            </div>
            
            {loadingState.errors.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-red-600 mb-1">Errors:</div>
                {loadingState.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600">
                    {error.source}: {error.error.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render article item
  const renderArticleItem = useCallback((article: NewsArticle, index: number) => {
    return (
      <AccessibleNewsArticle
        key={article.id}
        article={article}
        index={index}
        onRead={(article) => {
          store.markAsRead(article.id);
          window.open(article.url, '_blank', 'noopener,noreferrer');
        }}
        onBookmark={(article) => {
          if (store.isBookmarked(article.id)) {
            store.removeBookmark(article.id);
          } else {
            store.addBookmark(article.id);
          }
        }}
        onShare={(article) => {
          if (navigator.share) {
            navigator.share({
              title: article.title,
              text: article.description,
              url: article.url,
            });
          } else {
            navigator.clipboard.writeText(article.url);
            announceMessage('Article URL copied to clipboard', 'polite');
          }
        }}
        isBookmarked={store.isBookmarked(article.id)}
        className="mb-4"
      />
    );
  }, [store, announceMessage]);

  // Render actions
  const renderActions = () => (
    <div className="flex items-center space-x-4 mb-4">
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
      
      <button
        onClick={handleLoadMore}
        disabled={isLoading}
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Load More
      </button>
      
      <div className="text-sm text-gray-600">
        {articles.length} article{articles.length !== 1 ? 's' : ''} loaded
      </div>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="text-center py-12">
      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
      <p className="text-gray-600 mb-4">
        Try adjusting your filters or refresh to load new articles.
      </p>
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        Load Articles
      </button>
    </div>
  );

  return (
    <div className={`progressive-news-list ${className}`}>
      {/* Loading indicator */}
      {renderLoadingIndicator()}

      {/* Actions */}
      {renderActions()}

      {/* Articles list */}
      {articles.length > 0 ? (
        layout === 'list' ? (
          <VirtualScrollList
            items={articles}
            itemHeight={200}
            containerHeight={600}
            renderItem={renderArticleItem}
            className="border border-gray-200 rounded-lg"
          />
        ) : (
          <div className={`articles-grid ${
            layout === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-2'
          }`}>
            {articles.map((article, index) => renderArticleItem(article, index))}
          </div>
        )
      ) : (
        !isLoading && renderEmptyState()
      )}

      {/* Load more button for non-virtual lists */}
      {articles.length > 0 && layout !== 'list' && (
        <div className="text-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Load More Articles'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProgressiveNewsList;