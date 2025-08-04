/**
 * Centralized configuration constants for AI News Aggregator
 * This file contains all magic numbers, timeouts, and configuration values
 */

// Cache Configuration
export const CACHE_CONFIG = {
  NEWS_TIMEOUT: 30 * 60 * 1000, // 30 minutes (increased for better caching)
  QUERY_STALE_TIME: 15 * 60 * 1000, // 15 minutes (increased from 5 minutes)
  QUERY_GC_TIME: 30 * 60 * 1000, // 30 minutes (increased from 10 minutes)
  ARXIV_STALE_TIME: 30 * 60 * 1000, // 30 minutes (increased from 15 minutes)
  ARXIV_GC_TIME: 60 * 60 * 1000, // 1 hour (increased from 30 minutes)
  SEARCH_STALE_TIME: 5 * 60 * 1000, // 5 minutes (increased from 2 minutes)
  SEARCH_GC_TIME: 15 * 60 * 1000, // 15 minutes (increased from 5 minutes)
  TRENDING_STALE_TIME: 45 * 60 * 1000, // 45 minutes (increased from 30 minutes)
  TRENDING_GC_TIME: 90 * 60 * 1000, // 1.5 hours (increased from 1 hour)
} as const;

// API Configuration
export const API_CONFIG = {
  SCRAPER_ENDPOINT: 'http://localhost:8001/scrape',
  CORS_PROXY: 'https://api.allorigins.win/get?url=',
  ARXIV_API_BASE: 'http://export.arxiv.org/api/query',
  HACKER_NEWS_API_BASE: 'https://hacker-news.firebaseio.com/v0',
  NEWS_API_BASE: 'https://newsapi.org/v2/everything',
} as const;

// Request Limits
export const REQUEST_LIMITS = {
  MAX_ARTICLES_PER_SOURCE: 10,
  MAX_RSS_ITEMS: 5,
  MAX_ARXIV_RESULTS: 20,
  MAX_HACKER_NEWS_STORIES: 50,
  MAX_HACKER_NEWS_PROCESS: 20,
  MAX_TRENDING_TOPICS: 10,
  MAX_SEARCH_RESULTS: 50,
  MAX_TAGS_PER_ARTICLE: 5,
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 2, // Reduced from 3 to 2 for faster failures
  INITIAL_DELAY: 500, // 0.5 seconds (reduced from 1 second)
  MAX_DELAY: 5000, // 5 seconds (reduced from 30 seconds)
  BACKOFF_FACTOR: 2,
  TIMEOUT: 5000, // 5 seconds (reduced from 10 seconds)
} as const;

// UI Configuration
export const UI_CONFIG = {
  LOADING_SKELETON_COUNT: 6,
  PAPERS_SKELETON_COUNT: 4,
  ANIMATION_DELAY_INCREMENT: 100, // milliseconds
  SEARCH_MIN_LENGTH: 2,
  DEBOUNCE_DELAY: 300,
} as const;

// Image Configuration
export const IMAGE_CONFIG = {
  DEFAULT_DIMENSIONS: {
    WIDTH: 400,
    HEIGHT: 200,
  },
  UNSPLASH_PARAMS: 'w=400&h=200&fit=crop&crop=center&auto=format',
  FALLBACK_QUALITY: 80,
} as const;

// News Source Categories
export const NEWS_CATEGORIES = [
  'artificial-intelligence',
  'machine-learning', 
  'deep-learning',
  'tech-news',
  'nlp',
  'computer-vision',
  'robotics',
  'research',
  'industry',
  'startups',
] as const;

export type NewsCategory = typeof NEWS_CATEGORIES[number];

// AI Keywords for Content Analysis
export const AI_KEYWORDS = {
  PRIMARY: [
    'artificial intelligence',
    'machine learning', 
    'deep learning',
    'neural network',
    'ai',
    'ml',
    'gpt',
    'llm',
    'large language model',
  ],
  COMPANIES: [
    'openai',
    'google ai',
    'deepmind',
    'anthropic',
    'meta',
    'microsoft',
    'nvidia',
  ],
  TECHNOLOGIES: [
    'computer vision',
    'natural language processing',
    'nlp',
    'robotics',
    'automation',
    'algorithm',
    'chatbot',
    'transformer',
    'bert',
    'tensorflow',
    'pytorch',
  ],
  DOMAINS: [
    'data science',
    'predictive analytics',
    'python',
  ],
  HIGH_VALUE: [
    'breakthrough',
    'new',
    'launches',
    'releases',
    'announces',
    'revolutionary',
  ],
} as const;

// Environment Variables with Defaults
export const ENV_CONFIG = {
  NEWS_API_KEY: import.meta.env.VITE_NEWS_API_KEY || null,
  SCRAPER_ENDPOINT: import.meta.env.VITE_SCRAPER_API_URL || API_CONFIG.SCRAPER_ENDPOINT,
  NODE_ENV: import.meta.env.NODE_ENV || 'development',
  IS_DEVELOPMENT: import.meta.env.NODE_ENV === 'development',
  IS_PRODUCTION: import.meta.env.NODE_ENV === 'production',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to news sources. Please check your internet connection.',
  API_RATE_LIMIT: 'Too many requests. Please try again in a moment.',
  PARSING_ERROR: 'Error processing news data. Please try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  NO_RESULTS: 'No news articles found. Try adjusting your search or category filters.',
  SERVICE_UNAVAILABLE: 'News service is temporarily unavailable. Please try again later.',
} as const;

// Success Messages  
export const SUCCESS_MESSAGES = {
  NEWS_LOADED: 'News articles loaded successfully',
  PAPERS_LOADED: 'Research papers loaded successfully',
  SEARCH_COMPLETE: 'Search completed',
  REFRESH_COMPLETE: 'Content refreshed successfully',
} as const;

// Performance Monitoring
export const PERFORMANCE_CONFIG = {
  SLOW_REQUEST_THRESHOLD: 5000, // 5 seconds
  MEMORY_USAGE_THRESHOLD: 100 * 1024 * 1024, // 100MB
  BUNDLE_SIZE_TARGET: 500 * 1024, // 500KB
} as const;