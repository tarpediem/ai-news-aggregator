import { Brain, Sparkles, Loader, AlertTriangle, CheckCircle } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '../lib/utils';
import { aiService } from '../services/aiService';
import type { SummarizationResult, SummarizationOptions } from '../types/ai';
import type { NewsArticle } from '../types/news';
import { useSafeCallback } from '../hooks/useSafeCallback';
import { useSafeMemo } from '../hooks/useSafeMemo';
import { SafeComponentErrorBoundary } from './SafeErrorBoundary';

import { NewsCard } from './NewsCard';
import { ShimmerButton } from './ui/shimmer-button';


interface AIEnhancedNewsCardProps {
  article: NewsArticle;
  priority?: boolean;
  lazy?: boolean;
  enableAISummary?: boolean;
}

export const AIEnhancedNewsCard: React.FC<AIEnhancedNewsCardProps> = ({
  article,
  priority = false,
  lazy = false,
  enableAISummary = true
}) => {
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummarizationResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showAISummary, setShowAISummary] = useState(false);

  // Safe callback to prevent multiple simultaneous requests
  const [generateSummary] = useSafeCallback(async () => {
    if (!aiService.getSettings()?.apiKey) {
      setSummaryError('OpenRouter API key not configured. Please check settings.');
      return;
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const content = `${article.title}\n\n${article.description}`;
      const options: SummarizationOptions = {
        length: 'medium',
        format: 'paragraph',
        focus: 'technical',
        includeSentiment: true,
        includeKeywords: true
      };

      const result = await aiService.summarizeContent(content, options);
      setSummaryResult(result);
      setShowAISummary(true);
    } catch (error: any) {
      console.error('AI summarization failed:', error);
      setSummaryError(error.message || 'Failed to generate AI summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [article], {
    callbackId: `ai-summary-${article.id}`,
    maxExecutionsPerSecond: 1, // Prevent spamming AI requests
    debounceMs: 500
  });

  // Safe memo for sentiment color calculation
  const [getSentimentColor] = useSafeMemo(() => {
    return (sentiment?: string) => {
      switch (sentiment) {
        case 'positive': return 'text-green-600 dark:text-green-400';
        case 'negative': return 'text-red-600 dark:text-red-400';
        case 'neutral': return 'text-gray-600 dark:text-gray-400';
        default: return 'text-gray-600 dark:text-gray-400';
      }
    };
  }, [], {
    memoId: `sentiment-color-${article.id}`
  });

  // Safe memo for sentiment icon calculation
  const [getSentimentIcon] = useSafeMemo(() => {
    return (sentiment?: string) => {
      switch (sentiment) {
        case 'positive': return '😊';
        case 'negative': return '😔';
        case 'neutral': return '😐';
        default: return '🤔';
      }
    };
  }, [], {
    memoId: `sentiment-icon-${article.id}`
  });

  return (
    <SafeComponentErrorBoundary componentId={`ai-enhanced-card-${article.id}`}>
      <div className="relative">
        <NewsCard article={article} priority={priority} lazy={lazy} />
      
      {enableAISummary && (
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {!showAISummary && !summaryResult && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  AI Summary
                </span>
              </div>
              <ShimmerButton
                onClick={generateSummary}
                disabled={isGeneratingSummary}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                shimmerColor="#ffffff"
                background="linear-gradient(45deg, #7c3aed, #a855f7)"
              >
                {isGeneratingSummary ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>{isGeneratingSummary ? 'Generating...' : 'Generate'}</span>
              </ShimmerButton>
            </div>
          )}

          {summaryError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  AI Summary Failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {summaryError}
                </p>
              </div>
            </div>
          )}

          {summaryResult && showAISummary && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI Summary
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    by {summaryResult.model.split('/').pop()}
                  </span>
                </div>
                <button
                  onClick={() => setShowAISummary(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Hide
                </button>
              </div>

              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {summaryResult.summary}
                </p>

                {/* Key Points */}
                {summaryResult.keyPoints && summaryResult.keyPoints.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Key Points:
                    </h5>
                    <ul className="list-disc list-inside space-y-1">
                      {summaryResult.keyPoints.map((point, index) => (
                        <li key={index} className="text-xs text-gray-600 dark:text-gray-400">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Keywords */}
                {summaryResult.keywords && summaryResult.keywords.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Keywords:
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {summaryResult.keywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer with metadata */}
                <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-4">
                    {summaryResult.sentiment && (
                      <div className="flex items-center space-x-1">
                        <span>Sentiment:</span>
                        <span className={cn('font-medium', getSentimentColor(summaryResult.sentiment))}>
                          {getSentimentIcon(summaryResult.sentiment)} {summaryResult.sentiment}
                        </span>
                      </div>
                    )}
                    <div>
                      Confidence: {Math.round(summaryResult.confidence * 100)}%
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div>
                      Tokens: {summaryResult.tokensUsed.input + summaryResult.tokensUsed.output}
                    </div>
                    <div>
                      Cost: ${summaryResult.cost.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </SafeComponentErrorBoundary>
  );
};