/**
 * Enhanced error handling utility with retry logic and standardized error patterns
 */

import { RETRY_CONFIG, ERROR_MESSAGES } from '../config/constants';

export const ErrorType = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_RATE_LIMIT: 'API_RATE_LIMIT', 
  PARSING_ERROR: 'PARSING_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export interface ErrorDetail {
  type: ErrorType;
  message: string;
  userMessage?: string;
  originalError?: Error;
  retryable: boolean;
  statusCode?: number;
  context: Record<string, any>;
}

export class NewsError extends Error {
  public readonly type: ErrorType;
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;
  public readonly userMessage?: string;

  constructor(detail: ErrorDetail) {
    super(detail.message);
    this.name = 'NewsError';
    this.type = detail.type;
    this.retryable = detail.retryable;
    this.statusCode = detail.statusCode;
    this.context = detail.context;
    this.originalError = detail.originalError;
    this.userMessage = detail.userMessage;
  }
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

class ErrorHandler {
  /**
   * Standardize error classification and create NewsError instances
   */
  classifyError(error: any, context: Record<string, any> = {}): NewsError {
    // Handle axios errors
    if (error.response) {
      const statusCode = error.response.status;
      
      if (statusCode === 429) {
        return new NewsError({
          type: ErrorType.API_RATE_LIMIT,
          message: ERROR_MESSAGES.API_RATE_LIMIT,
          originalError: error,
          retryable: true,
          statusCode,
          context,
        });
      }
      
      if (statusCode >= 500) {
        return new NewsError({
          type: ErrorType.SERVER_ERROR,
          message: error.response.data?.message || ERROR_MESSAGES.GENERIC_ERROR,
          originalError: error,
          retryable: true,
          statusCode,
          context,
        });
      }
      
      if (statusCode >= 400) {
        return new NewsError({
          type: ErrorType.CLIENT_ERROR,
          message: error.response.data?.message || ERROR_MESSAGES.GENERIC_ERROR,
          originalError: error,
          retryable: false,
          statusCode,
          context,
        });
      }
    }

    // Handle network errors
    if (error.request || error.code === 'NETWORK_ERROR') {
      return new NewsError({
        type: ErrorType.NETWORK_ERROR,
        message: ERROR_MESSAGES.NETWORK_ERROR,
        originalError: error,
        retryable: true,
        context,
      });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new NewsError({
        type: ErrorType.TIMEOUT_ERROR,
        message: ERROR_MESSAGES.TIMEOUT_ERROR,
        originalError: error,
        retryable: true,
        context,
      });
    }

    // Handle parsing errors
    if (error instanceof SyntaxError || error.message?.includes('parse')) {
      return new NewsError({
        type: ErrorType.PARSING_ERROR,
        message: ERROR_MESSAGES.PARSING_ERROR,
        originalError: error,
        retryable: false,
        context,
      });
    }

    // Handle authentication errors
    if (error.message?.includes('auth') || error.message?.includes('unauthorized')) {
      return new NewsError({
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Authentication failed. Please check your API credentials.',
        originalError: error,
        retryable: false,
        context,
      });
    }

    // Default unknown error
    return new NewsError({
      type: ErrorType.UNKNOWN_ERROR,
      message: error.message || ERROR_MESSAGES.GENERIC_ERROR,
      originalError: error,
      retryable: false,
      context,
    });
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = RETRY_CONFIG.MAX_RETRIES,
      initialDelay = RETRY_CONFIG.INITIAL_DELAY,
      maxDelay = RETRY_CONFIG.MAX_DELAY,
      backoffFactor = RETRY_CONFIG.BACKOFF_FACTOR,
      shouldRetry = this.defaultShouldRetry,
    } = options;

    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!shouldRetry(error as Error, attempt)) {
          throw this.classifyError(error as Error, { attempt });
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );

        console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, (error as Error).message);
        
        await this.sleep(delay);
      }
    }

    throw this.classifyError(lastError!, { finalAttempt: true });
  }

  /**
   * Execute operation with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = RETRY_CONFIG.TIMEOUT
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Handle errors gracefully with fallback values
   */
  async withFallback<T>(
    operation: () => Promise<T>,
    fallback: T,
    logError = true
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (logError) {
        console.error('Operation failed, using fallback:', error);
      }
      return fallback;
    }
  }

  /**
   * Batch operations with individual error handling
   */
  async batchWithErrorHandling<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency = 3
  ): Promise<{ result?: T; error?: NewsError; index: number }[]> {
    const results: { result?: T; error?: NewsError; index: number }[] = [];
    
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async (operation, batchIndex) => {
        const index = i + batchIndex;
        try {
          const result = await operation();
          return { result, index };
        } catch (error) {
          return { error: this.classifyError(error as Error, { operationIndex: index }), index };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results.sort((a, b) => a.index - b.index);
  }

  /**
   * Log errors with structured context
   */
  logError(error: NewsError | Error, context: Record<string, any> = {}): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof NewsError && {
          type: error.type,
          retryable: error.retryable,
          statusCode: error.statusCode,
          context: error.context,
        }),
      },
      context,
    };

    if (error instanceof NewsError && error.type === ErrorType.API_RATE_LIMIT) {
      console.warn('API Rate Limit Hit:', logData);
    } else if (error instanceof NewsError && error.retryable) {
      console.warn('Retryable Error:', logData);
    } else {
      console.error('Error:', logData);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: NewsError | Error): string {
    if (error instanceof NewsError) {
      return error.message;
    }
    
    // Fallback for non-NewsError instances
    return ERROR_MESSAGES.GENERIC_ERROR;
  }

  private defaultShouldRetry = (error: Error, attempt: number): boolean => {
    const newsError = error instanceof NewsError ? error : this.classifyError(error);
    return newsError.retryable && attempt < RETRY_CONFIG.MAX_RETRIES;
  };

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions for common patterns
export const withRetry = errorHandler.withRetry.bind(errorHandler);
export const withTimeout = errorHandler.withTimeout.bind(errorHandler);
export const withFallback = errorHandler.withFallback.bind(errorHandler);
export const batchWithErrorHandling = errorHandler.batchWithErrorHandling.bind(errorHandler);