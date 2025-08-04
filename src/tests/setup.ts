/**
 * Test setup and configuration
 * Provides common utilities and mocks for the test suite
 */

import { vi } from 'vitest';

// Mock axios globally
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    head: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      head: vi.fn(),
    })),
  },
}));

// Mock DOM APIs
Object.defineProperty(window, 'DOMParser', {
  value: class DOMParser {
    parseFromString(str: string, type: string) {
      // Simple mock - returns a basic document structure
      return {
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
        body: { textContent: str },
      };
    }
  },
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 10000000,
    },
  },
});

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  value: class IntersectionObserver {
    constructor(callback: any) {
      // Mock implementation
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  },
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock Image
Object.defineProperty(window, 'Image', {
  value: class Image {
    onload: any;
    onerror: any;
    src = '';
    
    constructor() {
      setTimeout(() => {
        this.onload?.();
      }, 0);
    }
  },
});

// Common test utilities
export const createMockNewsArticle = (overrides = {}) => ({
  id: 'test-article-1',
  title: 'Test AI News Article',
  description: 'This is a test article about artificial intelligence',
  url: 'https://example.com/test-article',
  urlToImage: 'https://example.com/image.jpg',
  publishedAt: '2024-01-01T00:00:00Z',
  source: {
    id: 'test-source',
    name: 'Test Source',
    category: 'Tech News',
  },
  author: 'Test Author',
  category: 'artificial-intelligence' as const,
  tags: ['ai', 'technology'],
  relevanceScore: 0.8,
  ...overrides,
});

export const createMockScraperConfig = (overrides = {}) => ({
  id: 'test-scraper',
  name: 'Test Scraper',
  type: 'rss' as const,
  priority: 1,
  categories: ['artificial-intelligence' as const],
  rateLimitMs: 1000,
  maxRetries: 3,
  timeout: 10000,
  enabled: true,
  ...overrides,
});

export const createMockHealthStatus = (overrides = {}) => ({
  healthy: true,
  status: 'active' as const,
  responseTime: 100,
  lastChecked: new Date(),
  ...overrides,
});

export const createMockScrapingResult = (overrides = {}) => ({
  articles: [createMockNewsArticle()],
  sources: ['Test Source'],
  totalProcessed: 1,
  successCount: 1,
  errorCount: 0,
  duration: 1000,
  errors: [],
  ...overrides,
});

// Test helpers
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock API responses
export const mockApiResponses = {
  newsApi: {
    articles: [
      {
        title: 'AI News Article',
        description: 'Article about AI',
        url: 'https://example.com/ai-news',
        urlToImage: 'https://example.com/ai.jpg',
        publishedAt: '2024-01-01T00:00:00Z',
        source: { id: 'test', name: 'Test Source' },
        author: 'Test Author',
      },
    ],
    status: 'ok',
    totalResults: 1,
  },
  
  hackerNews: {
    topStories: [1, 2, 3],
    item: {
      id: 1,
      title: 'AI Discussion on HN',
      text: 'This is about artificial intelligence',
      url: 'https://example.com/hn-story',
      by: 'testuser',
      time: 1640995200,
      type: 'story',
    },
  },
  
  rssResponse: `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>AI News Feed</title>
        <item>
          <title>AI News Article</title>
          <description>Article about AI</description>
          <link>https://example.com/rss-article</link>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          <author>Test Author</author>
        </item>
      </channel>
    </rss>`,
};

// React Testing Library utilities
export const renderOptions = {
  // Add common providers here if needed
  wrapper: ({ children }: { children: React.ReactNode }) => children,
};