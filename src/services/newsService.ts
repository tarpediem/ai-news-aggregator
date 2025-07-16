import axios from 'axios';
import type { NewsArticle, ArxivPaper, NewsCategory } from '../types/news';
import { fallbackScraper } from './fallbackScraper';

// AI News Source Configuration
const AI_NEWS_SOURCES = [
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog',
    category: 'artificial-intelligence' as NewsCategory,
    selector: 'article, .post-item, .blog-post',
    titleSelector: 'h1, h2, h3, .title, .post-title',
    descriptionSelector: '.excerpt, .summary, p',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'openai'
  },
  {
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/',
    category: 'artificial-intelligence' as NewsCategory,
    selector: '.post, article',
    titleSelector: '.post-title a, h1, h2',
    descriptionSelector: '.post-body, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'google-ai'
  },
  {
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/news',
    category: 'artificial-intelligence' as NewsCategory,
    selector: '.news-item, article, .post',
    titleSelector: 'h1, h2, h3, .title',
    descriptionSelector: '.excerpt, .summary, p',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'anthropic'
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    category: 'tech-news' as NewsCategory,
    selector: '.story, article',
    titleSelector: '.story__title a, h1, h2',
    descriptionSelector: '.story__excerpt, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'mit-tech-review'
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    category: 'tech-news' as NewsCategory,
    selector: '.c-entry-box, article',
    titleSelector: '.c-entry-box--compact__title a, h1, h2',
    descriptionSelector: '.c-entry-summary, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'the-verge'
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/',
    category: 'industry' as NewsCategory,
    selector: '.ArticleListing, article',
    titleSelector: '.ArticleListing__title a, h1, h2',
    descriptionSelector: '.ArticleListing__excerpt, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'venturebeat'
  },
  {
    name: 'AI News',
    url: 'https://artificialintelligence-news.com/',
    category: 'artificial-intelligence' as NewsCategory,
    selector: '.post, article',
    titleSelector: '.post-title a, h1, h2',
    descriptionSelector: '.post-excerpt, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'ai-news'
  },
  {
    name: 'Towards Data Science',
    url: 'https://towardsdatascience.com/tagged/artificial-intelligence',
    category: 'machine-learning' as NewsCategory,
    selector: '.streamItem, article',
    titleSelector: 'h1, h2, h3, .graf--title',
    descriptionSelector: '.graf--p, .summary',
    linkSelector: 'a[href]',
    imageSelector: 'img',
    sourceId: 'towards-data-science'
  }
];

class NewsService {
  private scraperEndpoint: string;
  private cache: Map<string, { data: NewsArticle[], timestamp: number }> = new Map();
  private cacheTimeout = 15 * 60 * 1000; // 15 minutes

  constructor() {
    // Using a backend scraper service (you'll need to set this up)
    this.scraperEndpoint = import.meta.env.VITE_SCRAPER_ENDPOINT || 'http://localhost:8001/scrape';
  }

  private async scrapeNewsSource(source: typeof AI_NEWS_SOURCES[0]): Promise<NewsArticle[]> {
    try {
      const response = await axios.post(this.scraperEndpoint, {
        url: source.url,
        selectors: {
          container: source.selector,
          title: source.titleSelector,
          description: source.descriptionSelector,
          link: source.linkSelector,
          image: source.imageSelector
        }
      });

      const scrapedData = response.data.results || [];
      
      return scrapedData.map((item: any, index: number) => ({
        id: `${source.sourceId}-${Date.now()}-${index}`,
        title: item.title || 'No Title',
        description: item.description || 'No description available',
        url: item.link?.startsWith('http') ? item.link : `${new URL(source.url).origin}${item.link}`,
        urlToImage: item.image?.startsWith('http') ? item.image : 
                   item.image ? `${new URL(source.url).origin}${item.image}` : 
                   `https://via.placeholder.com/400x200?text=${encodeURIComponent(source.name)}`,
        publishedAt: new Date().toISOString(),
        source: {
          id: source.sourceId,
          name: source.name,
          category: source.category
        },
        author: source.name,
        category: source.category,
        tags: this.extractTags(item.title + ' ' + item.description),
        relevanceScore: this.calculateRelevanceScore(item.title + ' ' + item.description)
      })).filter((article: NewsArticle) => article.title !== 'No Title' && article.title.length > 10);

    } catch (error) {
      console.error(`Error scraping ${source.name}:`, error);
      return [];
    }
  }

  private extractTags(content: string): string[] {
    const aiKeywords = [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'gpt', 'llm', 'large language model', 'transformer', 'chatbot', 'openai', 'google',
      'anthropic', 'meta', 'microsoft', 'nvidia', 'computer vision', 'nlp', 'robotics',
      'automation', 'algorithm', 'data science', 'python', 'tensorflow', 'pytorch'
    ];
    
    const lowerContent = content.toLowerCase();
    return aiKeywords.filter(keyword => lowerContent.includes(keyword))
                    .slice(0, 5); // Limit to 5 most relevant tags
  }

  private calculateRelevanceScore(content: string): number {
    const highValueKeywords = ['breakthrough', 'new', 'launches', 'releases', 'announces', 'revolutionary'];
    const lowerContent = content.toLowerCase();
    
    let score = 0.5; // Base score
    
    highValueKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
      }
    });
    
    // Bonus for AI-specific terms
    if (lowerContent.includes('gpt') || lowerContent.includes('llm')) score += 0.2;
    if (lowerContent.includes('openai') || lowerContent.includes('anthropic')) score += 0.15;
    
    return Math.min(score, 1.0);
  }

  async fetchNews(category?: NewsCategory): Promise<NewsArticle[]> {
    const cacheKey = `news-${category || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const sourcesToScrape = category 
        ? AI_NEWS_SOURCES.filter(source => source.category === category)
        : AI_NEWS_SOURCES;

      const scrapePromises = sourcesToScrape.map(source => this.scrapeNewsSource(source));
      const results = await Promise.all(scrapePromises);
      
      const allArticles = results.flat();
      const sortedArticles = allArticles.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      // Cache the results
      this.cache.set(cacheKey, {
        data: sortedArticles,
        timestamp: Date.now()
      });

      return sortedArticles;

    } catch (error) {
      console.error('Error fetching news:', error);
      console.log('Falling back to alternative scraping methods...');
      
      // Try fallback scraping methods
      try {
        const fallbackArticles = await this.getFallbackNews(category);
        return fallbackArticles;
      } catch (fallbackError) {
        console.error('Fallback scraping also failed:', fallbackError);
        return this.getMinimalFallbackNews(category);
      }
    }
  }

  private async getFallbackNews(category?: NewsCategory): Promise<NewsArticle[]> {
    console.log('Using fallback scraping methods...');
    
    // Try multiple fallback methods
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
        console.error(`Fallback method ${index} failed:`, result.reason);
      }
    });

    // Filter by category if specified
    const filteredArticles = category 
      ? allArticles.filter(article => article.category === category)
      : allArticles;

    // Sort by relevance score and publish date
    const sortedArticles = filteredArticles.sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return sortedArticles.slice(0, 50); // Limit to 50 articles
  }

  private getMinimalFallbackNews(category?: NewsCategory): NewsArticle[] {
    const fallbackArticles = [
      {
        id: 'fallback-1',
        title: 'AI News Service Temporarily Unavailable',
        description: 'The news scraping service is currently unavailable. Please try again later. You can also check major AI news sources directly.',
        url: '#',
        urlToImage: 'https://via.placeholder.com/400x200?text=News+Unavailable',
        publishedAt: new Date().toISOString(),
        source: {
          id: 'system',
          name: 'System',
          category: 'Tech News'
        },
        author: 'System',
        category: (category || 'tech-news') as NewsCategory,
        tags: ['system', 'unavailable'],
        relevanceScore: 0.1
      }
    ];

    return fallbackArticles;
  }

  async fetchArxivPapers(query: string = 'artificial intelligence'): Promise<ArxivPaper[]> {
    try {
      const response = await axios.get('http://export.arxiv.org/api/query', {
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
          tags: this.extractTags(title + ' ' + summary)
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