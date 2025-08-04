/**
 * Web scraping implementations for news websites
 * Handles direct HTML parsing with CSS selectors and SPA content extraction
 */

import axios from 'axios';

import { BaseWebScraper } from '../abstracts/BaseScraper';
import { API_CONFIG } from '../config/constants';
import type { ScrapeOptions, ScraperConfig, SelectorConfig } from '../interfaces/INewsScaper';
import { imageService } from '../services/imageService';
import type { NewsArticle, NewsCategory } from '../types/news';


/**
 * Generic web scraper using CSS selectors
 */
export class WebScraper extends BaseWebScraper {
  readonly selectors: SelectorConfig;
  private readonly corsProxy: string;

  constructor(config: ScraperConfig) {
    super(config);
    
    if (!config.selectors) {
      throw new Error('Web scraper requires selectors configuration');
    }
    
    this.selectors = config.selectors;
    this.corsProxy = API_CONFIG.CORS_PROXY;
  }

  async extractContent(html: string, url: string): Promise<NewsArticle[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Check for parsing errors
    if (doc.querySelector('parsererror')) {
      throw new Error('Failed to parse HTML content');
    }

    const articles: NewsArticle[] = [];
    const containers = doc.querySelectorAll(this.selectors.container);

    Array.from(containers).forEach((container, index) => {
      try {
        const article = this.extractArticleFromContainer(container, url, index);
        if (article && this.isAIRelated(`${article.title  } ${  article.description}`)) {
          articles.push(article);
        }
      } catch (error) {
        console.warn(`Failed to extract article from container ${index}:`, error);
      }
    });

    return articles;
  }

  private extractArticleFromContainer(container: Element, baseUrl: string, index: number): NewsArticle | null {
    const title = this.extractText(container, this.selectors.title);
    const description = this.extractText(container, this.selectors.description);
    const link = this.extractAttribute(container, this.selectors.link, 'href') || 
                 this.extractAttribute(container, this.selectors.link, 'data-href');
    
    if (!title || !link) {
      return null;
    }

    const author = this.selectors.author ? 
      this.extractText(container, this.selectors.author) : this.name;
    const publishedAt = this.selectors.publishedAt ? 
      this.extractText(container, this.selectors.publishedAt) : new Date().toISOString();
    const categoryText = this.selectors.category ? 
      this.extractText(container, this.selectors.category) : '';
    
    const imageUrl = this.extractImageUrl(container) || 
                    imageService.extractImageFromContent(description) ||
                    imageService.getImageForCategory(this.getArticleCategory(categoryText));

    return {
      id: this.generateArticleId({ title, url: link } as NewsArticle),
      title: this.cleanHtml(title),
      description: this.cleanHtml(description) || 'No description available',
      url: this.resolveUrl(link, baseUrl),
      urlToImage: imageUrl,
      publishedAt: this.parseDate(publishedAt),
      source: {
        id: this.id,
        name: this.name,
        category: this.getArticleCategory(categoryText),
      },
      author: this.cleanHtml(author) || this.name,
      category: this.getArticleCategory(categoryText),
      tags: this.extractTags(`${title  } ${  description}`),
      relevanceScore: this.calculateRelevanceScore({ title, description } as NewsArticle),
    };
  }

  private extractText(container: Element, selector: string): string {
    const element = container.querySelector(selector);
    return element?.textContent?.trim() || '';
  }

  private extractAttribute(container: Element, selector: string, attribute: string): string | null {
    const element = container.querySelector(selector);
    return element?.getAttribute(attribute) || null;
  }

  private extractImageUrl(container: Element): string | null {
    if (!this.selectors.image) return null;

    const img = container.querySelector(this.selectors.image);
    if (!img) return null;

    // Try different image URL attributes
    const imageUrl = img.getAttribute('src') || 
                    img.getAttribute('data-src') || 
                    img.getAttribute('data-lazy-src') ||
                    img.getAttribute('data-original');

    return imageUrl && this.isValidImageUrl(imageUrl) ? imageUrl : null;
  }

  private isValidImageUrl(url: string): boolean {
    try {
      new URL(url);
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || 
             url.includes('images.') ||
             url.includes('cdn.') ||
             url.includes('img.');
    } catch {
      return false;
    }
  }

  private parseDate(dateString: string): string {
    if (!dateString) return new Date().toISOString();

    try {
      // Handle various date formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Try parsing relative dates like "2 hours ago"
        const relativeMatch = /(\d+)\s*(hour|day|week|month)s?\s*ago/i.exec(dateString);
        if (relativeMatch) {
          const amount = parseInt(relativeMatch[1]);
          const unit = relativeMatch[2].toLowerCase();
          const now = new Date();
          
          switch (unit) {
            case 'hour':
              now.setHours(now.getHours() - amount);
              break;
            case 'day':
              now.setDate(now.getDate() - amount);
              break;
            case 'week':
              now.setDate(now.getDate() - (amount * 7));
              break;
            case 'month':
              now.setMonth(now.getMonth() - amount);
              break;
          }
          
          return now.toISOString();
        }
        
        return new Date().toISOString();
      }
      
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private getArticleCategory(categoryText?: string): NewsCategory {
    if (!categoryText) return this.categories[0] || 'tech-news';

    const lowerCategory = categoryText.toLowerCase();
    
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

  // Override to handle CORS proxy
  protected async fetchHtml(url: string): Promise<string> {
    const proxyUrl = `${this.corsProxy}${encodeURIComponent(url)}`;
    
    const response = await axios.get(proxyUrl, {
      headers: {
        'User-Agent': this.userAgent || 'Mozilla/5.0 (compatible; AI News Aggregator)',
        ...this.config.headers,
      },
      timeout: this.config.timeout,
    });

    return response.data.contents || response.data;
  }

  // Enhanced SPA handling with retry logic
  async handleSPA(url: string): Promise<string> {
    try {
      // First try regular fetch
      const html = await this.fetchHtml(url);
      
      // Check if content looks like SPA (minimal content)
      if (this.detectSPA(html)) {
        // For SPA content, we might need to use a headless browser
        // For now, we'll return the HTML and let the extraction handle it
        console.warn(`SPA detected for ${url}, content may be incomplete`);
      }
      
      return html;
    } catch (error) {
      console.error(`SPA handling failed for ${url}:`, error);
      throw error;
    }
  }

  private detectSPA(html: string): boolean {
    // Simple SPA detection - look for minimal content and JS frameworks
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const textContent = doc.body?.textContent || '';
    
    return (
      textContent.length < 1000 && // Very little text content
      (html.includes('react') || html.includes('vue') || html.includes('angular')) &&
      doc.querySelectorAll('script').length > 5 // Lots of scripts
    );
  }

  protected async checkHealth(): Promise<boolean> {
    if (!this.config.enabled || !this.config.url) return false;

    try {
      const html = await this.fetchHtml(this.config.url);
      
      // Check if we can find expected selectors
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const containers = doc.querySelectorAll(this.selectors.container);
      
      return containers.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Specialized scraper for TechCrunch AI articles
 */
export class TechCrunchScraper extends WebScraper {
  constructor(config: Partial<ScraperConfig> = {}) {
    super({
      id: 'techcrunch',
      name: 'TechCrunch AI',
      type: 'web',
      priority: 1,
      categories: ['artificial-intelligence', 'tech-news'],
      url: 'https://techcrunch.com/category/artificial-intelligence/',
      selectors: {
        container: '.post-block',
        title: '.post-block__title__link',
        description: '.post-block__content',
        link: '.post-block__title__link',
        image: '.post-block__media img',
        author: '.post-block__author',
        publishedAt: '.post-block__time',
      },
      rateLimitMs: 2000,
      maxRetries: 3,
      timeout: 15000,
      enabled: true,
      ...config,
    });
  }
}

/**
 * Specialized scraper for The Verge AI articles
 */
export class TheVergeScraper extends WebScraper {
  constructor(config: Partial<ScraperConfig> = {}) {
    super({
      id: 'theverge',
      name: 'The Verge AI',
      type: 'web',
      priority: 1,
      categories: ['artificial-intelligence', 'tech-news'],
      url: 'https://www.theverge.com/ai-artificial-intelligence',
      selectors: {
        container: '.c-entry-box--compact',
        title: '.c-entry-box--compact__title a',
        description: '.c-entry-box--compact__dek',
        link: '.c-entry-box--compact__title a',
        image: '.c-entry-box--compact__image img',
        author: '.c-byline__author-name',
        publishedAt: '.c-byline__item time',
      },
      rateLimitMs: 2000,
      maxRetries: 3,
      timeout: 15000,
      enabled: true,
      ...config,
    });
  }
}

// Factory functions
export function createWebScraper(config: ScraperConfig): WebScraper {
  return new WebScraper({
    ...config,
    type: 'web',
  });
}

export function createTechCrunchScraper(config: Partial<ScraperConfig> = {}): TechCrunchScraper {
  return new TechCrunchScraper(config);
}

export function createTheVergeScraper(config: Partial<ScraperConfig> = {}): TheVergeScraper {
  return new TheVergeScraper(config);
}

// Predefined web scraper configurations
export const WEB_SCRAPER_CONFIGS: ScraperConfig[] = [
  {
    id: 'techcrunch',
    name: 'TechCrunch AI',
    type: 'web',
    priority: 1,
    categories: ['artificial-intelligence', 'tech-news'],
    url: 'https://techcrunch.com/category/artificial-intelligence/',
    selectors: {
      container: '.post-block',
      title: '.post-block__title__link',
      description: '.post-block__content',
      link: '.post-block__title__link',
      image: '.post-block__media img',
      author: '.post-block__author',
      publishedAt: '.post-block__time',
    },
    rateLimitMs: 2000,
    maxRetries: 3,
    timeout: 15000,
    enabled: true,
  },
  {
    id: 'theverge',
    name: 'The Verge AI',
    type: 'web',
    priority: 1,
    categories: ['artificial-intelligence', 'tech-news'],
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    selectors: {
      container: '.c-entry-box--compact',
      title: '.c-entry-box--compact__title a',
      description: '.c-entry-box--compact__dek',
      link: '.c-entry-box--compact__title a',
      image: '.c-entry-box--compact__image img',
      author: '.c-byline__author-name',
      publishedAt: '.c-byline__item time',
    },
    rateLimitMs: 2000,
    maxRetries: 3,
    timeout: 15000,
    enabled: true,
  },
];