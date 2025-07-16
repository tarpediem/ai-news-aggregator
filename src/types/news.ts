export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  source: NewsSource;
  author?: string;
  category: NewsCategory;
  tags?: string[];
  relevanceScore?: number;
}

export interface NewsSource {
  id: string;
  name: string;
  url?: string;
  category: string;
  favicon?: string;
}

export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  url: string;
  pdfUrl: string;
  categories: string[];
  primaryCategory: string;
  tags?: string[];
}

export interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

export interface ArxivApiResponse {
  feed: {
    entry: ArxivPaper[];
  };
}

export type NewsCategory = 
  | "artificial-intelligence"
  | "machine-learning"
  | "deep-learning"
  | "nlp"
  | "computer-vision"
  | "robotics"
  | "research"
  | "industry"
  | "startups"
  | "tech-news"
  | "general";

export interface NewsFilters {
  category?: NewsCategory;
  source?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  searchQuery?: string;
  sortBy?: "publishedAt" | "relevanceScore" | "title";
  sortOrder?: "asc" | "desc";
}

export interface NewsState {
  articles: NewsArticle[];
  papers: ArxivPaper[];
  loading: boolean;
  error: string | null;
  filters: NewsFilters;
  lastUpdated: Date | null;
}