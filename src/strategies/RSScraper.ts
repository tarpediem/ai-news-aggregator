/**
 * RSS/Atom feed scraper implementation
 * Handles parsing of RSS and Atom feeds with robust error handling
 */

import axios from 'axios';

import { BaseRSSScraper } from '../abstracts/BaseScraper';
import { API_CONFIG } from '../config/constants';
import type { ScrapeOptions, ScraperConfig } from '../interfaces/INewsScaper';
import { imageService } from '../services/imageService';
import type { NewsArticle, NewsCategory } from '../types/news';


export class RSSScraper extends BaseRSSScraper {
  readonly feedUrls: string[];

  constructor(config: ScraperConfig) {
    super(config);
    this.feedUrls = config.feedUrls || [];
    
    if (this.feedUrls.length === 0) {
      throw new Error('RSS scraper requires at least one feed URL');
    }
  }

  async parseFeed(feedUrl: string): Promise<NewsArticle[]> {
    try {
      // Use CORS proxy for client-side requests
      const proxyUrl = `${API_CONFIG.CORS_PROXY}${encodeURIComponent(feedUrl)}`;
      const response = await axios.get(proxyUrl, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': this.config.userAgent || 'AI News Aggregator RSS Reader',
        },
      });

      const feedContent = response.data.contents || response.data;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(feedContent, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error(`XML parsing error: ${parseError.textContent}`);
      }

      // Determine feed type (RSS vs Atom)
      const isAtom = xmlDoc.querySelector('feed[xmlns*="atom"]') !== null;
      
      return isAtom ? this.parseAtomFeed(xmlDoc, feedUrl) : this.parseRSSFeed(xmlDoc, feedUrl);

    } catch (error) {
      throw new Error(`Failed to parse RSS feed ${feedUrl}: ${(error as Error).message}`);
    }
  }

  private parseRSSFeed(xmlDoc: Document, feedUrl: string): NewsArticle[] {
    const items = xmlDoc.querySelectorAll('item');
    const articles: NewsArticle[] = [];

    Array.from(items).forEach((item, index) => {
      try {
        const article = this.parseRSSItem(item, feedUrl, index);
        if (article && this.isAIRelated(`${article.title  } ${  article.description}`)) {
          articles.push(article);
        }
      } catch (error) {
        console.warn(`Failed to parse RSS item ${index}:`, error);
      }
    });

    return articles;
  }

  private parseAtomFeed(xmlDoc: Document, feedUrl: string): NewsArticle[] {
    const entries = xmlDoc.querySelectorAll('entry');
    const articles: NewsArticle[] = [];

    Array.from(entries).forEach((entry, index) => {
      try {
        const article = this.parseAtomEntry(entry, feedUrl, index);
        if (article && this.isAIRelated(`${article.title  } ${  article.description}`)) {
          articles.push(article);
        }
      } catch (error) {
        console.warn(`Failed to parse Atom entry ${index}:`, error);
      }
    });

    return articles;
  }

  private parseRSSItem(item: Element, feedUrl: string, index: number): NewsArticle | null {
    const title = this.getTextContent(item, 'title');
    const description = this.getTextContent(item, 'description') || this.getTextContent(item, 'content:encoded');
    const link = this.getTextContent(item, 'link');
    const pubDate = this.getTextContent(item, 'pubDate') || this.getTextContent(item, 'dc:date');
    const author = this.getTextContent(item, 'author') || this.getTextContent(item, 'dc:creator');
    const category = this.getTextContent(item, 'category');

    if (!title || !link) {
      return null;
    }

    const imageUrl = this.extractImageFromItem(item) || 
                    imageService.extractImageFromContent(description) ||
                    imageService.getImageForCategory(this.getArticleCategory(category));

    return {
      id: this.generateArticleId({ title, url: link } as NewsArticle),
      title: this.cleanHtml(title),
      description: this.cleanHtml(description) || 'No description available',
      url: this.resolveUrl(link, feedUrl),
      urlToImage: imageUrl,
      publishedAt: this.parseDate(pubDate),
      source: {
        id: this.id,
        name: this.name,
        category: this.getArticleCategory(category),
      },
      author: this.cleanHtml(author) || this.name,
      category: this.getArticleCategory(category),
      tags: this.extractTags(`${title  } ${  description}`),
      relevanceScore: this.calculateRelevanceScore({ title, description } as NewsArticle),
    };
  }

  private parseAtomEntry(entry: Element, feedUrl: string, index: number): NewsArticle | null {
    const title = this.getTextContent(entry, 'title');
    const content = this.getTextContent(entry, 'content') || this.getTextContent(entry, 'summary');
    const linkElement = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
    const link = linkElement?.getAttribute('href');
    const published = this.getTextContent(entry, 'published') || this.getTextContent(entry, 'updated');
    const authorElement = entry.querySelector('author name');
    const author = authorElement?.textContent;
    const categoryElement = entry.querySelector('category');
    const category = categoryElement?.getAttribute('term') || categoryElement?.textContent;

    if (!title || !link) {
      return null;
    }

    const imageUrl = this.extractImageFromItem(entry) || 
                    imageService.extractImageFromContent(content) ||
                    imageService.getImageForCategory(this.getArticleCategory(category));

    return {
      id: this.generateArticleId({ title, url: link } as NewsArticle),
      title: this.cleanHtml(title),
      description: this.cleanHtml(content) || 'No description available',
      url: this.resolveUrl(link, feedUrl),
      urlToImage: imageUrl,
      publishedAt: this.parseDate(published),
      source: {
        id: this.id,
        name: this.name,
        category: this.getArticleCategory(category),
      },
      author: this.cleanHtml(author) || this.name,
      category: this.getArticleCategory(category),
      tags: this.extractTags(`${title  } ${  content}`),
      relevanceScore: this.calculateRelevanceScore({ title, description: content } as NewsArticle),
    };
  }

  private getTextContent(element: Element, selector: string): string {
    const found = element.querySelector(selector);
    return found?.textContent?.trim() || '';
  }

  private extractImageFromItem(item: Element): string | null {
    // Try multiple image extraction methods
    const imageSelectors = [
      'enclosure[type^="image"]',
      'media\\:thumbnail',
      'media\\:content[medium="image"]',
      'image url',
      'itunes\\:image',
    ];

    for (const selector of imageSelectors) {
      const element = item.querySelector(selector);
      if (element) {
        const url = element.getAttribute('url') || 
                   element.getAttribute('href') || 
                   element.textContent?.trim();
        
        if (url && this.isValidImageUrl(url)) {
          return url;
        }
      }
    }

    return null;
  }

  private isValidImageUrl(url: string): boolean {
    try {
      new URL(url);
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || 
             url.includes('images.unsplash.com') ||
             url.includes('cdn.') ||
             url.includes('img.');
    } catch {
      return false;
    }
  }

  private parseDate(dateString: string): string {
    if (!dateString) {
      return new Date().toISOString();
    }

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private getArticleCategory(categoryText?: string): NewsCategory {
    if (!categoryText) return this.categories[0] || 'tech-news';

    const lowerCategory = categoryText.toLowerCase();
    
    // Map category text to our NewsCategory types
    if (lowerCategory.includes('ai') || lowerCategory.includes('artificial')) {
      return 'artificial-intelligence';
    }
    if (lowerCategory.includes('machine') || lowerCategory.includes('ml')) {
      return 'machine-learning';
    }
    if (lowerCategory.includes('deep') || lowerCategory.includes('neural')) {
      return 'deep-learning';
    }
    if (lowerCategory.includes('nlp') || lowerCategory.includes('language')) {
      return 'nlp';
    }
    if (lowerCategory.includes('vision') || lowerCategory.includes('computer vision')) {
      return 'computer-vision';
    }
    if (lowerCategory.includes('robot')) {
      return 'robotics';
    }
    if (lowerCategory.includes('research') || lowerCategory.includes('paper')) {
      return 'research';
    }
    if (lowerCategory.includes('industry') || lowerCategory.includes('business')) {
      return 'industry';
    }
    if (lowerCategory.includes('startup')) {
      return 'startups';
    }

    return this.categories[0] || 'tech-news';
  }

  private isAIRelated(text: string): boolean {
    const lowerText = text.toLowerCase();
    const aiKeywords = [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'ai', 'ml', 'gpt', 'llm', 'openai', 'anthropic', 'google ai', 'deepmind',
      'computer vision', 'nlp', 'natural language', 'robotics', 'automation',
      'algorithm', 'chatbot', 'transformer', 'tensorflow', 'pytorch',
    ];

    return aiKeywords.some(keyword => lowerText.includes(keyword));
  }

  // Override health check to validate feeds
  protected async checkHealth(): Promise<boolean> {
    if (!this.config.enabled) return false;

    let healthyFeeds = 0;
    for (const feedUrl of this.feedUrls) {
      try {
        if (await this.validateFeed(feedUrl)) {
          healthyFeeds++;
        }
      } catch {
        // Feed is not healthy
      }
    }

    // Consider healthy if at least 50% of feeds are accessible
    return healthyFeeds >= Math.ceil(this.feedUrls.length * 0.5);
  }
}

// Factory function for creating RSS scrapers
export function createRSSScraper(config: ScraperConfig): RSSScraper {
  return new RSSScraper({
    ...config,
    type: 'rss',
  });
}

// Predefined RSS scraper configurations
export const RSS_SCRAPER_CONFIGS: ScraperConfig[] = [
  {
    id: 'mit-tech-review-rss',
    name: 'MIT Technology Review AI',
    type: 'rss',
    priority: 1,
    categories: ['artificial-intelligence', 'tech-news'],
    feedUrls: ['https://www.technologyreview.com/feed/'],
    rateLimitMs: 1000,
    maxRetries: 3,
    timeout: 10000,
    enabled: true,
  },
  {
    id: 'venturebeat-ai-rss',
    name: 'VentureBeat AI',
    type: 'rss',
    priority: 1,
    categories: ['industry', 'artificial-intelligence'],
    feedUrls: ['https://venturebeat.com/ai/feed/'],
    rateLimitMs: 1000,
    maxRetries: 3,
    timeout: 10000,
    enabled: true,
  },
  {
    id: 'ai-news-rss',
    name: 'AI News RSS',
    type: 'rss',
    priority: 2,
    categories: ['artificial-intelligence'],
    feedUrls: ['https://artificialintelligence-news.com/feed/'],
    rateLimitMs: 1500,
    maxRetries: 3,
    timeout: 10000,
    enabled: true,
  },
];