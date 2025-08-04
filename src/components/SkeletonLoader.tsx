/**
 * Optimized skeleton loading components for better UX during loading states
 * Provides visual feedback while content is loading
 */

import React from 'react';

import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  'data-testid'?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  'data-testid': testId,
  ...props 
}) => (
  <div
    data-testid={testId}
    className={cn(
      "animate-pulse rounded-md bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700",
      "bg-[length:200%_100%] animate-shimmer",
      className
    )}
    {...props}
  />
);

interface NewsCardSkeletonProps {
  className?: string;
}

export const NewsCardSkeleton: React.FC<NewsCardSkeletonProps> = ({ 
  className 
}) => (
  <div className={cn(
    "group backdrop-blur-xl bg-white/20 dark:bg-slate-900/20 border border-white/20 dark:border-slate-700/20 rounded-2xl p-6 shadow-xl",
    className
  )}>
    <div className="space-y-4">
      {/* Title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      
      {/* Image skeleton */}
      <Skeleton className="h-32 w-full rounded-xl" />
      
      {/* Description skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      
      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  </div>
);

interface ArxivCardSkeletonProps {
  className?: string;
}

export const ArxivCardSkeleton: React.FC<ArxivCardSkeletonProps> = ({ 
  className 
}) => (
  <div className={cn(
    "bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-200 dark:border-slate-700",
    className
  )}>
    <div className="space-y-4">
      {/* Title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      
      {/* Authors skeleton */}
      <div className="flex space-x-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
      
      {/* Abstract skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      
      {/* Categories skeleton */}
      <div className="flex space-x-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  </div>
);

interface SkeletonGridProps {
  count?: number;
  columns?: 1 | 2 | 3;
  type?: 'news' | 'arxiv';
  className?: string;
}

export const SkeletonGrid: React.FC<SkeletonGridProps> = ({
  count = 6,
  columns = 3,
  type = 'news',
  className
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  };

  const SkeletonComponent = type === 'news' ? NewsCardSkeleton : ArxivCardSkeleton;

  return (
    <div className={cn(
      "grid gap-8",
      gridCols[columns],
      className
    )}>
      {Array.from({ length: count }, (_, i) => (
        <div 
          key={i} 
          className="animate-fade-in"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <SkeletonComponent />
        </div>
      ))}
    </div>
  );
};

interface ProgressiveSkeletonProps {
  loadedCount: number;
  totalCount: number;
  columns?: 1 | 2 | 3;
  type?: 'news' | 'arxiv';
  className?: string;
  children: React.ReactNode;
}

export const ProgressiveSkeleton: React.FC<ProgressiveSkeletonProps> = ({
  loadedCount,
  totalCount,
  columns = 3,
  type = 'news',
  className,
  children
}) => {
  const remainingCount = Math.max(0, totalCount - loadedCount);
  
  if (remainingCount === 0) {
    return <>{children}</>;
  }

  return (
    <div className={className}>
      {children}
      {remainingCount > 0 && (
        <SkeletonGrid 
          count={remainingCount}
          columns={columns}
          type={type}
          className="mt-8"
        />
      )}
    </div>
  );
};

interface LoadingStateProps {
  isLoading: boolean;
  hasContent: boolean;
  error?: string | null;
  skeletonCount?: number;
  skeletonColumns?: 1 | 2 | 3;
  skeletonType?: 'news' | 'arxiv';
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  hasContent,
  error,
  skeletonCount = 6,
  skeletonColumns = 3,
  skeletonType = 'news',
  emptyMessage = 'No content available',
  emptyIcon = '📰',
  children,
  className
}) => {
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-red-600 dark:text-red-400 text-lg font-medium">Error Loading Content</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && !hasContent) {
    return (
      <SkeletonGrid 
        count={skeletonCount}
        columns={skeletonColumns}
        type={skeletonType}
        className={className}
      />
    );
  }

  if (!hasContent && !isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">{emptyIcon}</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-lg">{emptyMessage}</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Try adjusting your filters or check back later
          </p>
        </div>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};

// CSS-in-JS styles for shimmer animation
export const shimmerStyles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  .animate-shimmer {
    animation: shimmer 1.5s ease-in-out infinite;
  }
  
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;