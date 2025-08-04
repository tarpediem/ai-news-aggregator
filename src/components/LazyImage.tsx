/**
 * Lazy loading image component with intersection observer
 * Provides performance benefits and reduces bandwidth usage
 */

import React, { useState, useRef, useEffect } from 'react';

import { cn } from '../lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean; // Skip lazy loading for above-the-fold content
  placeholder?: string; // Placeholder image URL
  onLoad?: () => void;
  onError?: () => void;
  sizes?: string;
  style?: React.CSSProperties;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  priority = false,
  placeholder,
  onLoad,
  onError,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  style,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority); // Skip intersection for priority images
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const currentImgRef = imgRef.current;
    if (!currentImgRef) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before element enters viewport
        threshold: 0.1,
      }
    );

    observerRef.current.observe(currentImgRef);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Fallback/placeholder image
  const placeholderSrc = placeholder || 
    `data:image/svg+xml;base64,${btoa(`
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f1f5f9"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#64748b" text-anchor="middle" dy=".3em">
          Loading...
        </text>
      </svg>
    `)}`;

  return (
    <div className={cn("relative overflow-hidden", className)} style={style}>
      {/* Placeholder/Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-pulse w-12 h-12 bg-slate-300 dark:bg-slate-600 rounded-full" />
            <div className="text-xs text-slate-500 dark:text-slate-400">Loading...</div>
          </div>
        </div>
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={isInView || priority ? src : placeholderSrc}
        alt={alt}
        className={cn(
          "transition-all duration-500",
          isLoaded ? "opacity-100" : "opacity-0",
          hasError && "hidden",
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? "eager" : "lazy"}
        sizes={sizes}
        style={style}
      />

      {/* Error state */}
      {hasError && (
        <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
          <div className="text-center">
            <div className="text-red-500 mb-2">⚠️</div>
            <div className="text-xs text-red-600 dark:text-red-400">
              Failed to load image
            </div>
          </div>
        </div>
      )}

      {/* Progressive enhancement overlay */}
      {isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      )}
    </div>
  );
};

// Optimized image component with srcset support
export const ResponsiveImage: React.FC<LazyImageProps & {
  srcSet?: string;
  webpSrc?: string;
}> = ({ 
  src, 
  srcSet, 
  webpSrc, 
  alt, 
  className = '', 
  priority = false,
  ...props 
}) => {
  return (
    <picture>
      {/* WebP format for supported browsers */}
      {webpSrc && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      
      {/* Fallback with srcSet */}
      <LazyImage
        src={src}
        alt={alt}
        className={className}
        priority={priority}
        {...props}
      />
    </picture>
  );
};

// Hook for image preloading
export function useImagePreloader(urls: string[]) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  const preloadImage = (url: string) => {
    if (loadedImages.has(url) || loadingImages.has(url)) return;

    setLoadingImages(prev => new Set(prev).add(url));

    const img = new Image();
    img.onload = () => {
      setLoadedImages(prev => new Set(prev).add(url));
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    };
    img.onerror = () => {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    };
    img.src = url;
  };

  useEffect(() => {
    urls.forEach(preloadImage);
  }, [urls]);

  return { loadedImages, loadingImages, preloadImage };
}