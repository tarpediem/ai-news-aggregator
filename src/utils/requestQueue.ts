/**
 * Request throttling and batching utility for managing API calls
 * Prevents overwhelming external APIs and improves performance
 */

import { RETRY_CONFIG } from '../config/constants';

import { errorHandler, withRetry } from './errorHandler';

interface QueuedRequest<T> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
  retries: number;
  context: Record<string, any>;
}

interface ThrottleOptions {
  maxConcurrent?: number;
  minDelay?: number;
  maxRetries?: number;
  priorityLevels?: number;
}

interface BatchOptions<T> {
  batchSize?: number;
  maxWaitTime?: number;
  keyExtractor?: (item: T) => string;
}

class RequestQueue {
  private queues = new Map<number, QueuedRequest<any>[]>();
  private activeRequests = new Set<string>();
  private requestTimestamps: number[] = [];
  private isProcessing = false;
  
  private readonly options: Required<ThrottleOptions>;

  constructor(options: ThrottleOptions = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      minDelay: options.minDelay ?? 100,
      maxRetries: options.maxRetries ?? RETRY_CONFIG.MAX_RETRIES,
      priorityLevels: options.priorityLevels ?? 3,
    };

    // Initialize priority queues
    for (let i = 0; i < this.options.priorityLevels; i++) {
      this.queues.set(i, []);
    }
  }

  /**
   * Add a request to the throttled queue
   */
  async enqueue<T>(
    operation: () => Promise<T>,
    priority = 1,
    context: Record<string, any> = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: this.generateRequestId(),
        operation,
        resolve,
        reject,
        priority: Math.max(0, Math.min(priority, this.options.priorityLevels - 1)),
        timestamp: Date.now(),
        retries: 0,
        context,
      };

      const queue = this.queues.get(request.priority) || [];
      queue.push(request);
      this.queues.set(request.priority, queue);

      this.processQueue();
    });
  }

  /**
   * Batch similar requests together
   */
  async batch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: BatchOptions<T> = {}
  ): Promise<R[]> {
    const {
      batchSize = 5,
      keyExtractor = () => 'default',
    } = options;

    // Group items by key
    const groups = new Map<string, T[]>();
    items.forEach(item => {
      const key = keyExtractor(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    // Process each group in batches
    const results: R[] = [];
    for (const [, group] of groups) {
      for (let i = 0; i < group.length; i += batchSize) {
        const batch = group.slice(i, i + batchSize);
        
        const batchOperation = () => processor(batch);
        const batchResults = await this.enqueue(batchOperation, 1, { 
          batchSize: batch.length,
          groupKey: batch[0] ? keyExtractor(batch[0]) : 'unknown',
        });
        
        results.push(...batchResults);
      }
    }

    return results;
  }

  /**
   * Execute multiple requests with smart concurrency control
   */
  async parallel<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency?: number
  ): Promise<T[]> {
    const concurrency = maxConcurrency || this.options.maxConcurrent;
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchPromises = batch.map((operation, index) => 
        this.enqueue(operation, 1, { batchIndex: i + index })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Debounce rapid requests
   */
  debounce<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    delay = 300
  ): (...args: T) => Promise<R> {
    let timeoutId: NodeJS.Timeout | null = null;
    let latestResolve: ((value: R) => void) | null = null;
    let latestReject: ((error: Error) => void) | null = null;

    return (...args: T): Promise<R> => {
      return new Promise<R>((resolve, reject) => {
        // Cancel previous timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Reject previous promise if it exists
        if (latestReject) {
          latestReject(new Error('Debounced: newer request superseded this one'));
        }

        latestResolve = resolve;
        latestReject = reject;

        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            latestResolve?.(result);
          } catch (error) {
            latestReject?.(error as Error);
          } finally {
            latestResolve = null;
            latestReject = null;
            timeoutId = null;
          }
        }, delay);
      });
    };
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const queueSizes = Array.from(this.queues.entries()).map(([priority, queue]) => ({
      priority,
      size: queue.length,
    }));

    return {
      totalQueued: Array.from(this.queues.values()).reduce((sum, queue) => sum + queue.length, 0),
      activeRequests: this.activeRequests.size,
      queueSizes,
      recentRequestRate: this.getRequestRate(),
    };
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.forEach(queue => {
      queue.forEach(request => {
        request.reject(new Error('Queue cleared'));
      });
      queue.length = 0;
    });
    this.activeRequests.clear();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeRequests.size >= this.options.maxConcurrent) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.activeRequests.size < this.options.maxConcurrent) {
        const nextRequest = this.getNextRequest();
        if (!nextRequest) break;

        this.executeRequest(nextRequest);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private getNextRequest(): QueuedRequest<any> | null {
    // Process queues by priority (0 = highest priority)
    for (let priority = 0; priority < this.options.priorityLevels; priority++) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  private async executeRequest(request: QueuedRequest<any>): Promise<void> {
    this.activeRequests.add(request.id);
    this.recordRequestTime();

    // Ensure minimum delay between requests
    await this.enforceMinDelay();

    try {
      const result = await withRetry(
        request.operation,
        {
          maxRetries: this.options.maxRetries,
          shouldRetry: (_, attempt) => {
            request.retries = attempt;
            return attempt < this.options.maxRetries;
          },
        }
      );
      
      request.resolve(result);
    } catch (error) {
      errorHandler.logError(error as Error, {
        requestId: request.id,
        priority: request.priority,
        retries: request.retries,
        context: request.context,
      });
      request.reject(error as Error);
    } finally {
      this.activeRequests.delete(request.id);
      
      // Continue processing queue
      setTimeout(() => this.processQueue(), this.options.minDelay);
    }
  }

  private async enforceMinDelay(): Promise<void> {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.options.minDelay
    );

    if (recentRequests.length > 0) {
      const lastRequest = Math.max(...recentRequests);
      const delay = this.options.minDelay - (now - lastRequest);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private recordRequestTime(): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
    
    // Clean old timestamps (keep last 100)
    if (this.requestTimestamps.length > 100) {
      this.requestTimestamps = this.requestTimestamps.slice(-50);
    }
  }

  private getRequestRate(): number {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000 // Last minute
    );
    return recentRequests.length;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instances for different use cases
export const newsRequestQueue = new RequestQueue({
  maxConcurrent: 3,
  minDelay: 100,
  maxRetries: 3,
  priorityLevels: 3,
});

export const imageRequestQueue = new RequestQueue({
  maxConcurrent: 5,
  minDelay: 50,
  maxRetries: 2,
  priorityLevels: 2,
});

// Export class for custom instances
export { RequestQueue };

// Convenience functions
export const throttledRequest = newsRequestQueue.enqueue.bind(newsRequestQueue);
export const batchRequests = newsRequestQueue.batch.bind(newsRequestQueue);
export const parallelRequests = newsRequestQueue.parallel.bind(newsRequestQueue);
export const debouncedRequest = newsRequestQueue.debounce.bind(newsRequestQueue);