import axios from 'axios';

import { 
  REQUEST_LIMITS, 
  CACHE_CONFIG, 
  AI_KEYWORDS,
  ENV_CONFIG
} from '../config/constants';
import type { NewsArticle, ArxivPaper, NewsCategory } from '../types/news';
import { errorHandler, withRetry, withTimeout } from '../utils/errorHandler';
import { throttledRequest, batchRequests } from '../utils/requestQueue';

import { fallbackScraper } from './fallbackScraper';
import { imageService } from './imageService';


// AI News Source Configuration - Organized by category
interface NewsSourceConfig {
  name: string;
  url: string;
  category: NewsCategory;
  selector: string;
  titleSelector: string;
  descriptionSelector: string;
  linkSelector: string;
  imageSelector: string;
  sourceId: string;
  priority?: number;
}

const AI_NEWS_SOURCES: NewsSourceConfig[] = [
  // High-priority AI research sources
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog',
    category: 'artificial-intelligence',
    selector: 'article, .post-item, .blog-post',
    titleSelector: 'h1, h2, h3, .title, .post-title',
    descriptionSelector: '.excerpt, .summary, p',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'openai',
    priority: 0
  },
  {
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/',
    category: 'artificial-intelligence',
    selector: '.post, article',
    titleSelector: '.post-title a, h1, h2',
    descriptionSelector: '.post-body, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'google-ai',
    priority: 0
  },
  {
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/news',
    category: 'artificial-intelligence',
    selector: '.news-item, article, .post',
    titleSelector: 'h1, h2, h3, .title',
    descriptionSelector: '.excerpt, .summary, p',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'anthropic',
    priority: 0
  },
  // Tech news sources
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    category: 'tech-news',
    selector: '.story, article',
    titleSelector: '.story__title a, h1, h2',
    descriptionSelector: '.story__excerpt, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'mit-tech-review',
    priority: 1
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    category: 'tech-news',
    selector: '.c-entry-box, article',
    titleSelector: '.c-entry-box--compact__title a, h1, h2',
    descriptionSelector: '.c-entry-summary, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'the-verge',
    priority: 1
  },
  // Industry sources
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/',
    category: 'industry',
    selector: '.ArticleListing, article',
    titleSelector: '.ArticleListing__title a, h1, h2',
    descriptionSelector: '.ArticleListing__excerpt, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'venturebeat',
    priority: 1
  },
  {
    name: 'AI News',
    url: 'https://artificialintelligence-news.com/',
    category: 'artificial-intelligence',
    selector: '.post, article',
    titleSelector: '.post-title a, h1, h2',
    descriptionSelector: '.post-excerpt, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'ai-news',
    priority: 2
  },
  // Machine learning sources
  {
    name: 'Towards Data Science',
    url: 'https://towardsdatascience.com/tagged/artificial-intelligence',
    category: 'machine-learning',
    selector: '.streamItem, article',
    titleSelector: 'h1, h2, h3, .graf--title',
    descriptionSelector: '.graf--p, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'towards-data-science',
    priority: 2
  }
];

class NewsService {
  private readonly scraperEndpoint: string;
  private readonly cache = new Map<string, { data: NewsArticle[], timestamp: number }>();
  private readonly cacheTimeout = CACHE_CONFIG.NEWS_TIMEOUT;

  constructor() {
    this.scraperEndpoint = ENV_CONFIG.SCRAPER_ENDPOINT;
  }

  private async scrapeNewsSource(source: NewsSourceConfig): Promise<NewsArticle[]> {
    const scrapeOperation = async (): Promise<NewsArticle[]> => {
      const response = await withTimeout(
        () => axios.post(this.scraperEndpoint, {
          url: source.url,
          selectors: {
            container: source.selector,
            title: source.titleSelector,
            description: source.descriptionSelector,
            link: source.linkSelector,
            image: source.imageSelector
          }
        }),
        5000 // Reduced from 10s to 5s timeout
      );

      const scrapedData = response.data.results || [];
      
      return scrapedData
        .slice(0, REQUEST_LIMITS.MAX_ARTICLES_PER_SOURCE)
        .map((item: any, index: number) => this.transformScrapedItem(item, source, index))
        .filter((article: NewsArticle) => this.isValidArticle(article));
    };

    try {
      return await throttledRequest(
        scrapeOperation,
        source.priority || 1,
        { sourceName: source.name, sourceId: source.sourceId }
      );
    } catch (error) {
      errorHandler.logError(error as Error, {
        sourceName: source.name,
        sourceUrl: source.url,
        operation: 'scrapeNewsSource'
      });
      return [];
    }
  }

  private transformScrapedItem(item: any, source: NewsSourceConfig, index: number): NewsArticle {
    const content = `${item.title || ''} ${item.description || ''}`;
    
    return {
      id: `${source.sourceId}-${Date.now()}-${index}`,
      title: item.title || 'No Title',
      description: item.description || 'No description available',
      url: this.resolveUrl(item.link, source.url),
      urlToImage: this.resolveImageUrl(item.image, source),
      publishedAt: new Date().toISOString(),
      source: {
        id: source.sourceId,
        name: source.name,
        category: source.category
      },
      author: source.name,
      category: source.category,
      tags: this.extractTags(content),
      relevanceScore: this.calculateRelevanceScore(content)
    };
  }

  private resolveUrl(link: string, baseUrl: string): string {
    if (!link) return baseUrl;
    if (link.startsWith('http')) return link;
    
    try {
      return new URL(link, new URL(baseUrl).origin).toString();
    } catch {
      return baseUrl;
    }
  }

  private resolveImageUrl(image: string, source: NewsSourceConfig): string {
    if (!image) {
      return imageService.getImageForCategory(source.category);
    }
    
    if (image.startsWith('http')) {
      return imageService.optimizeImageUrl(image);
    }
    
    const resolvedImage = imageService.resolveImageUrl(image, source.url);
    return imageService.optimizeImageUrl(resolvedImage);
  }

  private isValidArticle(article: NewsArticle): boolean {
    return article.title !== 'No Title' && 
           article.title.length > 10 &&
           article.description.length > 20;
  }

  private extractTags(content: string): string[] {
    const allKeywords = [
      ...AI_KEYWORDS.PRIMARY,
      ...AI_KEYWORDS.COMPANIES,
      ...AI_KEYWORDS.TECHNOLOGIES,
      ...AI_KEYWORDS.DOMAINS
    ];
    
    const lowerContent = content.toLowerCase();
    return allKeywords
      .filter(keyword => lowerContent.includes(keyword))
      .slice(0, REQUEST_LIMITS.MAX_TAGS_PER_ARTICLE);
  }

  private calculateRelevanceScore(content: string): number {
    const lowerContent = content.toLowerCase();
    let score = 0.5; // Base score
    
    // High-value keywords boost
    AI_KEYWORDS.HIGH_VALUE.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
      }
    });
    
    // AI-specific terms bonus
    if (lowerContent.includes('gpt') || lowerContent.includes('llm')) {
      score += 0.2;
    }
    
    // Major AI companies bonus
    AI_KEYWORDS.COMPANIES.forEach(company => {
      if (lowerContent.includes(company.toLowerCase())) {
        score += 0.15;
      }
    });
    
    // Technical depth bonus
    const technicalTerms = AI_KEYWORDS.TECHNOLOGIES.filter(term => 
      lowerContent.includes(term.toLowerCase())
    ).length;
    score += Math.min(technicalTerms * 0.05, 0.3);
    
    return Math.min(score, 1.0);
  }

  async fetchNews(category?: NewsCategory, options: { progressive?: boolean } = {}): Promise<NewsArticle[]> {
    const cacheKey = `news-${category || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Use progressive loading for better performance
    if (options.progressive) {
      return this.fetchNewsProgressively(category);
    }

    try {
      const sourcesToScrape = this.getSourcesForCategory(category);
      
      // Use batch processing for better performance and error handling
      const articles = await batchRequests(
        sourcesToScrape,
        async (sources: NewsSourceConfig[]) => {
          const scrapePromises = sources.map(source => this.scrapeNewsSource(source));
          const results = await Promise.allSettled(scrapePromises);
          
          return results
            .filter((result): result is PromiseFulfilledResult<NewsArticle[]> => 
              result.status === 'fulfilled'
            )
            .flatMap(result => result.value);
        },
        { batchSize: 2, keyExtractor: (source) => source.category } // Reduced batch size
      );

      const allArticles = articles.flat();
      const sortedArticles = this.sortAndLimitArticles(allArticles);

      // Cache the results
      this.cache.set(cacheKey, {
        data: sortedArticles,
        timestamp: Date.now()
      });

      return sortedArticles;

    } catch (error) {
      errorHandler.logError(error as Error, { 
        operation: 'fetchNews', 
        category,
        sourcesCount: AI_NEWS_SOURCES.length 
      });
      
      // Try fallback scraping methods
      return this.getFallbackNewsWithRetry(category);
    }
  }

  private getSourcesForCategory(category?: NewsCategory): NewsSourceConfig[] {
    const sources = category 
      ? AI_NEWS_SOURCES.filter(source => source.category === category)
      : AI_NEWS_SOURCES;
    
    // Sort by priority (lower numbers = higher priority)
    return sources.sort((a, b) => (a.priority || 1) - (b.priority || 1));
  }

  private sortAndLimitArticles(articles: NewsArticle[]): NewsArticle[] {
    return articles
      .sort((a, b) => {
        // Primary sort: relevance score
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        
        // Secondary sort: publish date
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, REQUEST_LIMITS.MAX_SEARCH_RESULTS);
  }

  private async getFallbackNewsWithRetry(category?: NewsCategory): Promise<NewsArticle[]> {
    console.log('Using fallback scraping methods...');
    
    try {
      const fallbackArticles = await withRetry(async () => {
        const fallbackPromises = [
          fallbackScraper.fetchFromRSS(),
          fallbackScraper.fetchFromNewsAPI(),
          fallbackScraper.fetchHackerNews()
        ];

        const results = await Promise.allSettled(fallbackPromises);
        const allArticles: NewsArticle[] = [];

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allArticles.push(...result.value);
          } else {
            errorHandler.logError(result.reason, { 
              fallbackMethod: index,
              operation: 'getFallbackNews' 
            });
          }
        });

        if (allArticles.length === 0) {
          throw new Error('All fallback methods failed');
        }

        // Filter by category if specified
        const filteredArticles = category 
          ? allArticles.filter(article => article.category === category)
          : allArticles;

        return this.sortAndLimitArticles(filteredArticles);
      });
      
      return fallbackArticles;
    } catch (error) {
      errorHandler.logError(error as Error, { 
        operation: 'getFallbackNewsWithRetry',
        category 
      });
      return this.getMinimalFallbackNews(category);
    }
  }

  // Progressive loading implementation
  private async fetchNewsProgressively(category?: NewsCategory): Promise<NewsArticle[]> {
    const sourcesToScrape = this.getSourcesForCategory(category);
    const allArticles: NewsArticle[] = [];
    const cacheKey = `news-${category || 'all'}`;
    
    // Process sources in priority order with immediate yielding
    for (const source of sourcesToScrape) {
      try {
        const articles = await this.scrapeNewsSource(source);
        if (articles.length > 0) {
          allArticles.push(...articles);
          
          // Cache intermediate results for immediate display
          const intermediateResults = this.sortAndLimitArticles(allArticles);
          this.cache.set(`${cacheKey}-partial`, {
            data: intermediateResults,
            timestamp: Date.now()
          });
          
          // Small delay to prevent overwhelming the UI
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.warn(`Failed to scrape ${source.name}:`, error);
        // Continue with other sources
      }
    }
    
    const sortedArticles = this.sortAndLimitArticles(allArticles);
    
    // Cache final results
    this.cache.set(cacheKey, {
      data: sortedArticles,
      timestamp: Date.now()
    });
    
    return sortedArticles;
  }

  // Get partial results while loading
  getPartialResults(category?: NewsCategory): NewsArticle[] {
    const cacheKey = `news-${category || 'all'}-partial`;
    const cached = this.cache.get(cacheKey);
    return cached?.data || [];
  }

  private getMinimalFallbackNews(category?: NewsCategory): NewsArticle[] {
    const targetCategory = category || 'tech-news';
    return [
      {
        id: 'fallback-1',
        title: 'AI News Service Temporarily Unavailable',
        description: 'The news scraping service is currently unavailable. Please try again later. You can also check major AI news sources directly.',
        url: '#',
        urlToImage: imageService.getImageForCategory(targetCategory, true),
        publishedAt: new Date().toISOString(),
        source: {
          id: 'system',
          name: 'System',
          category: 'Tech News'
        },
        author: 'System',
        category: targetCategory,
        tags: ['system', 'unavailable'],
        relevanceScore: 0.1
      }
    ];
  }

  async fetchArxivPapers(query = 'artificial intelligence'): Promise<ArxivPaper[]> {
    try {
      const response = await axios.get('/api/arxiv', {
        params: {
          search_query: `all:${query}`,
          start: 0,
          max_results: 20,
          sortBy: 'submittedDate',
          sortOrder: 'descending'
        }
      });

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, 'text/xml');
      const entries = xmlDoc.querySelectorAll('entry');

      const papers: ArxivPaper[] = Array.from(entries).map(entry => {
        const id = entry.querySelector('id')?.textContent?.split('/').pop() || '';
        const title = entry.querySelector('title')?.textContent?.trim() || '';
        const summary = entry.querySelector('summary')?.textContent?.trim() || '';
        const published = entry.querySelector('published')?.textContent || '';
        const updated = entry.querySelector('updated')?.textContent || '';
        
        const authors = Array.from(entry.querySelectorAll('author name')).map(
          author => author.textContent || ''
        );
        
        const categories = Array.from(entry.querySelectorAll('category')).map(
          cat => cat.getAttribute('term') || ''
        );

        return {
          id,
          title,
          summary,
          authors,
          published,
          updated,
          url: `https://arxiv.org/abs/${id}`,
          pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
          categories,
          primaryCategory: categories[0] || '',
          tags: this.extractTags(`${title  } ${  summary}`)
        };
      });

      return papers;

    } catch (error) {
      console.error('Error fetching arXiv papers:', error);
      return [];
    }
  }

  async searchNews(query: string): Promise<NewsArticle[]> {
    try {
      const allNews = await this.fetchNews();
      
      const filteredNews = allNews.filter(article =>
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.description.toLowerCase().includes(query.toLowerCase()) ||
        article.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      
      return filteredNews.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    } catch (error) {
      console.error('Error searching news:', error);
      return [];
    }
  }

  async fetchTrendingTopics(): Promise<string[]> {
    try {
      const allNews = await this.fetchNews();
      const tagCounts = new Map<string, number>();
      
      allNews.forEach(article => {
        article.tags?.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      
      return Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
        
    } catch (error) {
      console.error('Error fetching trending topics:', error);
      return [
        'AI', 'Machine Learning', 'Deep Learning', 'Neural Networks', 'GPT',
        'OpenAI', 'Google AI', 'Computer Vision', 'NLP', 'Robotics'
      ];
    }
  }

}

export const newsService = new NewsService();