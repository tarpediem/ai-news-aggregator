/**
 * Centralized image service for AI News Aggregator
 * Handles image URLs, fallbacks, and optimization
 */

import { IMAGE_CONFIG, NEWS_CATEGORIES, type NewsCategory } from '../config/constants';

interface ImageMetadata {
  url: string;
  alt: string;
  category: NewsCategory;
  quality?: number;
}

interface CategoryImageSet {
  primary: string[];
  fallback: string[];
}

/**
 * High-quality Unsplash images organized by category
 * Using consistent parameters for optimization and caching
 */
const CATEGORY_IMAGES: Record<NewsCategory | 'default', CategoryImageSet> = {
  'artificial-intelligence': {
    primary: [
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'machine-learning': {
    primary: [
      'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1509228627152-72ae9ad3344e?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'deep-learning': {
    primary: [
      'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'tech-news': {
    primary: [
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'nlp': {
    primary: [
      'https://images.unsplash.com/photo-1516110833967-0b5716ca1387?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1456428746267-a1756408f782?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1516110833967-0b5716ca1387?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'computer-vision': {
    primary: [
      'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1574068468668-a05a11f871da?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'robotics': {
    primary: [
      'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1518085250887-2f903c200fee?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1563207153-f403bf289096?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'research': {
    primary: [
      'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'industry': {
    primary: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'startups': {
    primary: [
      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1553484771-371a605b060b?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
  'default': {
    primary: [
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
    fallback: [
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=200&fit=crop&crop=center&auto=format',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=200&fit=crop&crop=center&auto=format',
    ],
  },
};

class ImageService {
  private imageCache = new Map<string, string>();

  /**
   * Get a random image for a specific category
   */
  getImageForCategory(
    category: NewsCategory | string,
    useFallback = false
  ): string {
    const cacheKey = `${category}-${useFallback}`;
    
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    const categoryKey = this.isValidCategory(category) ? category : 'default';
    const imageSet = CATEGORY_IMAGES[categoryKey];
    const images = useFallback ? imageSet.fallback : imageSet.primary;
    
    const randomIndex = Math.floor(Math.random() * images.length);
    const selectedImage = images[randomIndex];
    
    this.imageCache.set(cacheKey, selectedImage);
    return selectedImage;
  }

  /**
   * Get image with metadata for better accessibility and SEO
   */
  getImageWithMetadata(
    category: NewsCategory | string,
    alt?: string
  ): ImageMetadata {
    const url = this.getImageForCategory(category);
    const categoryKey = this.isValidCategory(category) ? category : ('tech-news' as NewsCategory);
    
    return {
      url,
      alt: alt || this.generateAltText(categoryKey),
      category: categoryKey,
      quality: IMAGE_CONFIG.FALLBACK_QUALITY,
    };
  }

  /**
   * Extract and validate image from article content
   */
  extractImageFromContent(description: string): string | null {
    if (!description) return null;
    
    const imgRegex = /<img[^>]+src="([^"]+)"/i;
    const match = imgRegex.exec(description);
    
    if (match && this.isValidImageUrl(match[1])) {
      return match[1];
    }
    
    return null;
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  resolveImageUrl(imageUrl: string, baseUrl: string): string {
    if (!imageUrl) return '';
    
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    try {
      const base = new URL(baseUrl);
      return new URL(imageUrl, base.origin).toString();
    } catch {
      return imageUrl;
    }
  }

  /**
   * Optimize image URL with parameters
   */
  optimizeImageUrl(url: string, width?: number, height?: number): string {
    if (!url?.includes('unsplash.com')) {
      return url;
    }

    const targetWidth = width || IMAGE_CONFIG.DEFAULT_DIMENSIONS.WIDTH;
    const targetHeight = height || IMAGE_CONFIG.DEFAULT_DIMENSIONS.HEIGHT;
    
    // Remove existing parameters and add optimized ones
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?w=${targetWidth}&h=${targetHeight}&fit=crop&crop=center&auto=format&q=${IMAGE_CONFIG.FALLBACK_QUALITY}`;
  }

  /**
   * Preload critical images for better performance
   */
  preloadCriticalImages(): void {
    const criticalCategories: NewsCategory[] = ['artificial-intelligence', 'tech-news', 'machine-learning'];
    
    criticalCategories.forEach(category => {
      const imageSet = CATEGORY_IMAGES[category];
      // Preload primary images only
      imageSet.primary.slice(0, 2).forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
      });
    });
  }

  /**
   * Clear image cache (useful for memory management)
   */
  clearCache(): void {
    this.imageCache.clear();
  }

  private isValidCategory(category: string): category is NewsCategory {
    return NEWS_CATEGORIES.includes(category as NewsCategory);
  }

  private isValidImageUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http') && 
             (url.includes('.jpg') || url.includes('.jpeg') || 
              url.includes('.png') || url.includes('.webp') ||
              url.includes('unsplash.com'));
    } catch {
      return false;
    }
  }

  private generateAltText(category: NewsCategory): string {
    const altTextMap: Record<NewsCategory, string> = {
      'artificial-intelligence': 'Artificial Intelligence technology illustration',
      'machine-learning': 'Machine Learning algorithms visualization',
      'deep-learning': 'Deep Learning neural networks concept',
      'tech-news': 'Technology news and innovation',
      'nlp': 'Natural Language Processing technology',
      'computer-vision': 'Computer Vision and image recognition',
      'robotics': 'Robotics and automation technology',
      'research': 'Scientific research and development',
      'industry': 'Technology industry and business',
      'startups': 'Tech startups and entrepreneurship',
    };

    return altTextMap[category] || 'AI and technology news';
  }
}

// Export singleton instance
export const imageService = new ImageService();

// Export types for external use
export type { ImageMetadata, NewsCategory };