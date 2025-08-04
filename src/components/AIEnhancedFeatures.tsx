/**
 * AI Enhanced Features Demo Component
 * Demonstrates how the AI service integrates with the settings system
 */

import { Zap, MessageSquare, Tag, TrendingUp, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { aiService } from '../services/aiService';
import type { NewsArticle } from '../types/news';

import { ShimmerButton } from './ui/shimmer-button';


interface AIEnhancedFeaturesProps {
  articles: NewsArticle[];
}

export const AIEnhancedFeatures: React.FC<AIEnhancedFeaturesProps> = ({ articles }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    summaries: Record<string, string>;
    tags: Record<string, string[]>;
    relevanceScores: Record<string, number>;
  }>({
    summaries: {},
    tags: {},
    relevanceScores: {}
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enhancedQuery, setEnhancedQuery] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [usageStats, setUsageStats] = useState({ totalRequests: 0, totalTokens: 0 });

  useEffect(() => {
    // Load usage stats on component mount
    setUsageStats(aiService.getCurrentUsageStats());
  }, []);

  const enhanceArticles = async () => {
    if (articles.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const sampleArticles = articles.slice(0, 3); // Process first 3 articles for demo
      const newResults = {
        summaries: { ...results.summaries },
        tags: { ...results.tags },
        relevanceScores: { ...results.relevanceScores }
      };

      for (const article of sampleArticles) {
        // Generate summary
        if (!newResults.summaries[article.id]) {
          const summary = await aiService.summarizeArticle(article.title, article.description);
          newResults.summaries[article.id] = summary;
        }

        // Generate tags
        if (!newResults.tags[article.id]) {
          const tags = await aiService.generateTags({
            title: article.title,
            description: article.description,
            content: article.content
          });
          newResults.tags[article.id] = tags;
        }

        // Analyze relevance (using sample interests)
        if (!newResults.relevanceScores[article.id]) {
          const relevance = await aiService.analyzeRelevance(
            {
              title: article.title,
              description: article.description,
              content: article.content
            },
            ['artificial intelligence', 'machine learning', 'technology', 'innovation']
          );
          newResults.relevanceScores[article.id] = relevance;
        }
      }

      setResults(newResults);
      setUsageStats(aiService.getCurrentUsageStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing articles');
    } finally {
      setIsProcessing(false);
    }
  };

  const enhanceSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsEnhancing(true);
    try {
      const enhanced = await aiService.enhanceSearchQuery(
        searchQuery,
        'AI and technology news search'
      );
      setEnhancedQuery(enhanced);
      setUsageStats(aiService.getCurrentUsageStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance search query');
    } finally {
      setIsEnhancing(false);
    }
  };

  const testConnection = async () => {
    try {
      const isConnected = await aiService.testConnection();
      if (isConnected) {
        setError(null);
        alert('✅ API connection successful!');
      } else {
        setError('❌ API connection failed. Please check your API key in settings.');
      }
    } catch (err) {
      setError('❌ Failed to test connection. Please check your settings.');
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-2">
          <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span>AI Enhanced Features</span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Leverage AI to enhance your news reading experience with summaries, tags, and relevance scoring.
        </p>
      </div>

      {/* Usage Stats */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Usage Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{usageStats.totalRequests}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{usageStats.totalTokens.toLocaleString()}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
        </div>
      )}

      {/* Connection Test */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">API Connection</h3>
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Test Connection
        </button>
      </div>

      {/* Search Enhancement */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-2">
          <MessageSquare className="w-4 h-4" />
          <span>Search Query Enhancement</span>
        </h3>
        <div className="space-y-3">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter a search query to enhance..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div className="flex space-x-2">
            <ShimmerButton
              onClick={enhanceSearch}
              disabled={!searchQuery.trim() || isEnhancing}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              shimmerColor="#ffffff"
              background="rgba(34, 197, 94, 1)"
            >
              {isEnhancing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Enhancing...
                </>
              ) : (
                'Enhance Query'
              )}
            </ShimmerButton>
          </div>
          {enhancedQuery && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-800 dark:text-green-200">Enhanced Query:</span>
              </div>
              <p className="text-green-700 dark:text-green-300">"{enhancedQuery}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Article Enhancement */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-2">
          <TrendingUp className="w-4 h-4" />
          <span>Article Enhancement</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Generate AI-powered summaries, tags, and relevance scores for the first 3 articles.
        </p>
        <ShimmerButton
          onClick={enhanceArticles}
          disabled={articles.length === 0 || isProcessing}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          shimmerColor="#ffffff"
          background="rgba(147, 51, 234, 1)"
        >
          {isProcessing ? (
            <>
              <Loader className="w-4 h-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Enhance Articles
            </>
          )}
        </ShimmerButton>
      </div>

      {/* Results Display */}
      {Object.keys(results.summaries).length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Enhancement Results</h3>
          {articles.slice(0, 3).map(article => (
            <div key={article.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{article.title}</h4>
              
              {results.summaries[article.id] && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Summary:</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                    {results.summaries[article.id]}
                  </p>
                </div>
              )}

              {results.tags[article.id] && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <Tag className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Tags:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {results.tags[article.id]?.map(tag => (
                      <span key={tag} className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {results.relevanceScores[article.id] !== undefined && (
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Relevance Score:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full" 
                        style={{ width: `${(results.relevanceScores[article.id] || 0) * 10}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {results.relevanceScores[article.id]}/10
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {articles.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Load some articles to see AI enhancements in action!</p>
        </div>
      )}
    </div>
  );
};

export default AIEnhancedFeatures;