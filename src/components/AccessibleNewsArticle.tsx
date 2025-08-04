/**
 * Accessibility-enhanced news article component
 * Demonstrates proper ARIA labels, semantic HTML, and keyboard navigation
 */

import React, { useState, useRef } from 'react';

import type { NewsArticle } from '../types/news';

import { useAccessibility } from './AccessibilityProvider';

interface AccessibleNewsArticleProps {
  article: NewsArticle;
  index: number;
  onRead?: (article: NewsArticle) => void;
  onShare?: (article: NewsArticle) => void;
  onBookmark?: (article: NewsArticle) => void;
  isBookmarked?: boolean;
  className?: string;
}

export const AccessibleNewsArticle: React.FC<AccessibleNewsArticleProps> = ({
  article,
  index,
  onRead,
  onShare,
  onBookmark,
  isBookmarked = false,
  className = '',
}) => {
  const { announceMessage, settings } = useAccessibility();
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    announceMessage('Article image failed to load', 'polite');
  };

  const handleReadMore = () => {
    setIsExpanded(!isExpanded);
    announceMessage(
      isExpanded ? 'Article collapsed' : 'Article expanded',
      'polite'
    );
  };

  const handleShare = () => {
    onShare?.(article);
    announceMessage('Article shared', 'polite');
  };

  const handleBookmark = () => {
    onBookmark?.(article);
    announceMessage(
      isBookmarked ? 'Article removed from bookmarks' : 'Article bookmarked',
      'polite'
    );
  };

  const handleReadArticle = () => {
    onRead?.(article);
    announceMessage('Opening article', 'polite');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleReadArticle();
        break;
      case 'b':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleBookmark();
        }
        break;
      case 's':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleShare();
        }
        break;
      case 'e':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleReadMore();
        }
        break;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const words = text.split(' ').length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  const readingTime = getReadingTime(article.description);

  return (
    <article
      ref={articleRef}
      className={`accessible-news-article bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${className}`}
      aria-labelledby={`article-title-${index}`}
      aria-describedby={`article-description-${index}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="article"
    >
      {/* Article Header */}
      <header className="p-4 border-b border-gray-100">
        <div className="flex items-start space-x-4">
          {/* Article Image */}
          <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
            {!imageError && article.urlToImage ? (
              <img
                src={article.urlToImage}
                alt={`Image for article: ${article.title}`}
                className={`w-full h-full object-cover transition-opacity ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="lazy"
              />
            ) : (
              <div
                className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500"
                aria-hidden="true"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Article Content */}
          <div className="flex-1 min-w-0">
            <h2
              id={`article-title-${index}`}
              className="text-lg font-semibold text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors"
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                aria-describedby={`article-meta-${index}`}
              >
                {article.title}
              </a>
            </h2>

            <div
              id={`article-meta-${index}`}
              className="flex items-center space-x-2 text-sm text-gray-500 mt-1"
            >
              <span>{article.source.name}</span>
              <span aria-hidden="true">•</span>
              <time dateTime={article.publishedAt}>
                {formatDate(article.publishedAt)}
              </time>
              <span aria-hidden="true">•</span>
              <span>{readingTime} min read</span>
              {article.author && (
                <>
                  <span aria-hidden="true">•</span>
                  <span>By {article.author}</span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2 mt-2">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  settings.colorBlindFriendly
                    ? 'bg-gray-100 text-gray-800 border border-gray-300'
                    : 'bg-blue-100 text-blue-800'
                }`}
                aria-label={`Category: ${article.category}`}
              >
                {article.category.replace('-', ' ')}
              </span>
              
              {article.relevanceScore && (
                <span
                  className="text-xs text-gray-500"
                  aria-label={`Relevance score: ${Math.round(article.relevanceScore * 100)}%`}
                >
                  {Math.round(article.relevanceScore * 100)}% relevant
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Article Body */}
      <div className="p-4">
        <div
          id={`article-description-${index}`}
          className={`text-gray-700 ${isExpanded ? '' : 'line-clamp-3'}`}
        >
          {article.description}
        </div>

        {/* Expandable Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="prose prose-sm max-w-none">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Additional Details</h3>
              <div className="space-y-2 text-sm text-gray-600">
                {article.tags && article.tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {article.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <span className="font-medium">Source:</span> {article.source.name}
                </div>
                
                <div>
                  <span className="font-medium">Published:</span>{' '}
                  <time dateTime={article.publishedAt}>
                    {formatDate(article.publishedAt)}
                  </time>
                </div>
                
                {article.author && (
                  <div>
                    <span className="font-medium">Author:</span> {article.author}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Article Actions */}
      <footer className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReadArticle}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              aria-label={`Read full article: ${article.title}`}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Read Article
            </button>

            <button
              onClick={handleReadMore}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded"
              aria-label={isExpanded ? 'Collapse article preview' : 'Expand article preview'}
              aria-expanded={isExpanded}
            >
              <svg
                className={`w-4 h-4 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {isExpanded ? 'Less' : 'More'}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded"
              aria-label={`Share article: ${article.title}`}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share
            </button>

            <button
              onClick={handleBookmark}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 rounded ${
                isBookmarked
                  ? 'text-yellow-600 hover:text-yellow-700 focus:ring-yellow-500'
                  : 'text-gray-600 hover:text-gray-700 focus:ring-gray-500'
              }`}
              aria-label={`${isBookmarked ? 'Remove from' : 'Add to'} bookmarks: ${article.title}`}
              aria-pressed={isBookmarked}
            >
              <svg
                className={`w-4 h-4 mr-1 ${isBookmarked ? 'fill-current' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {isBookmarked ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        {settings.keyboardNavigation && (
          <div className="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-2">
            <details>
              <summary className="cursor-pointer hover:text-gray-700">
                Keyboard shortcuts
              </summary>
              <div className="mt-1 space-y-1">
                <div>Enter/Space: Read article</div>
                <div>Ctrl+B: Bookmark</div>
                <div>Ctrl+S: Share</div>
                <div>Ctrl+E: Expand/Collapse</div>
              </div>
            </details>
          </div>
        )}
      </footer>
    </article>
  );
};

export default AccessibleNewsArticle;