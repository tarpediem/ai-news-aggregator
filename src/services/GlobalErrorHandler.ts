/**
 * Global error handling service for the application
 * Provides centralized error monitoring, reporting, and recovery
 */

import { errorHandler, ErrorType } from '../utils/errorHandler';

interface ErrorEvent {
  error: Error;
  timestamp: Date;
  context?: Record<string, any>;
  userId?: string;
  sessionId: string;
  url: string;
  userAgent: string;
  level: 'error' | 'warning' | 'info';
  source: 'javascript' | 'promise' | 'resource' | 'network' | 'custom';
  fingerprint?: string;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySource: Record<string, number>;
  recentErrors: ErrorEvent[];
  lastErrorTime: Date | null;
  sessionErrors: number;
  errorRate: number;
}

interface ErrorConfig {
  maxErrors: number;
  maxRecentErrors: number;
  reportingUrl?: string;
  enableConsoleLogging: boolean;
  enableRemoteReporting: boolean;
  enableUserFeedback: boolean;
  rateLimitMs: number;
  enableMetrics: boolean;
}

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private config: ErrorConfig;
  private metrics: ErrorMetrics;
  private sessionId: string;
  private errorQueue: ErrorEvent[] = [];
  private isProcessing = false;
  private lastReportTime = 0;
  private listeners: ((event: ErrorEvent) => void)[] = [];

  private constructor(config: Partial<ErrorConfig> = {}) {
    this.config = {
      maxErrors: 100,
      maxRecentErrors: 20,
      enableConsoleLogging: true,
      enableRemoteReporting: process.env.NODE_ENV === 'production',
      enableUserFeedback: true,
      rateLimitMs: 1000,
      enableMetrics: true,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.metrics = this.initializeMetrics();
    this.setupGlobalHandlers();
  }

  static getInstance(config?: Partial<ErrorConfig>): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler(config);
    }
    return GlobalErrorHandler.instance;
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByType: {},
      errorsBySource: {},
      recentErrors: [],
      lastErrorTime: null,
      sessionErrors: 0,
      errorRate: 0,
    };
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalHandlers(): void {
    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        source: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.handleError(error, {
        source: 'promise',
        rejectionHandled: false,
      });
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        this.handleError(new Error(`Resource failed to load: ${target.tagName}`), {
          source: 'resource',
          resourceType: target.tagName,
          resourceSrc: (target as any).src || (target as any).href,
        });
      }
    }, true);

    // Handle network errors (fetch failures)
    this.interceptFetch();
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          this.handleError(new Error(`HTTP ${response.status}: ${response.statusText}`), {
            source: 'network',
            url: args[0] as string,
            status: response.status,
            statusText: response.statusText,
          });
        }
        
        return response;
      } catch (error) {
        this.handleError(error as Error, {
          source: 'network',
          url: args[0] as string,
          networkError: true,
        });
        throw error;
      }
    };
  }

  public handleError(error: Error, context: Record<string, any> = {}): void {
    // Rate limiting
    const now = Date.now();
    if (now - this.lastReportTime < this.config.rateLimitMs) {
      return;
    }
    this.lastReportTime = now;

    // Create error event
    const errorEvent: ErrorEvent = {
      error,
      timestamp: new Date(),
      context,
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      level: this.determineErrorLevel(error, context),
      source: (context.source as ErrorEvent['source']) || 'custom',
      fingerprint: this.generateFingerprint(error, context),
    };

    // Update metrics
    if (this.config.enableMetrics) {
      this.updateMetrics(errorEvent);
    }

    // Queue for processing
    this.errorQueue.push(errorEvent);
    this.processErrorQueue();

    // Notify listeners
    this.notifyListeners(errorEvent);
  }

  private determineErrorLevel(error: Error, context: Record<string, any>): ErrorEvent['level'] {
    if (error.name === 'ChunkLoadError' || context.source === 'resource') {
      return 'warning';
    }
    if (error.message.includes('Network Error') || context.source === 'network') {
      return 'error';
    }
    return 'error';
  }

  private generateFingerprint(error: Error, context: Record<string, any>): string {
    const key = `${error.name}:${error.message}:${context.source || 'unknown'}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  private updateMetrics(errorEvent: ErrorEvent): void {
    const { error, source } = errorEvent;
    const errorType = errorHandler.classifyError(error).type;

    this.metrics.totalErrors++;
    this.metrics.sessionErrors++;
    this.metrics.lastErrorTime = errorEvent.timestamp;

    // Update error counts by type
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    this.metrics.errorsBySource[source] = (this.metrics.errorsBySource[source] || 0) + 1;

    // Update recent errors
    this.metrics.recentErrors.unshift(errorEvent);
    if (this.metrics.recentErrors.length > this.config.maxRecentErrors) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(0, this.config.maxRecentErrors);
    }

    // Calculate error rate (errors per minute)
    const recentErrorsInLastMinute = this.metrics.recentErrors.filter(
      e => Date.now() - e.timestamp.getTime() < 60000
    );
    this.metrics.errorRate = recentErrorsInLastMinute.length;
  }

  private async processErrorQueue(): Promise<void> {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.errorQueue.length > 0) {
        const errorEvent = this.errorQueue.shift()!;
        await this.processError(errorEvent);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processError(errorEvent: ErrorEvent): Promise<void> {
    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(errorEvent);
    }

    // Remote reporting
    if (this.config.enableRemoteReporting && this.config.reportingUrl) {
      await this.reportToRemoteService(errorEvent);
    }

    // User feedback (for critical errors)
    if (this.config.enableUserFeedback && errorEvent.level === 'error') {
      this.showUserFeedback(errorEvent);
    }

    // Store in local storage for debugging
    this.storeErrorLocally(errorEvent);
  }

  private logToConsole(errorEvent: ErrorEvent): void {
    const { error, timestamp, context, source, level } = errorEvent;
    
    const logMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
    
    console.groupCollapsed(`[${level.toUpperCase()}] ${error.name}: ${error.message}`);
    console.log('Timestamp:', timestamp.toISOString());
    console.log('Source:', source);
    console.log('Context:', context);
    console.log('Stack:', error.stack);
    console.log('Session:', this.sessionId);
    console.groupEnd();
  }

  private async reportToRemoteService(errorEvent: ErrorEvent): Promise<void> {
    if (!this.config.reportingUrl) return;

    try {
      const payload = {
        ...errorEvent,
        error: {
          name: errorEvent.error.name,
          message: errorEvent.error.message,
          stack: errorEvent.error.stack,
        },
        metrics: this.metrics,
      };

      await fetch(this.config.reportingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to report error to remote service:', error);
    }
  }

  private showUserFeedback(errorEvent: ErrorEvent): void {
    // Show user-friendly error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 4px;
        padding: 16px;
        max-width: 400px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      ">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: #d32f2f; margin-right: 8px;">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          <strong>Something went wrong</strong>
        </div>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #666;">
          We've encountered an error and our team has been notified. Please try refreshing the page.
        </p>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: #d32f2f;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">
          Dismiss
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.parentElement.removeChild(notification);
      }
    }, 10000);
  }

  private storeErrorLocally(errorEvent: ErrorEvent): void {
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.unshift({
        ...errorEvent,
        error: {
          name: errorEvent.error.name,
          message: errorEvent.error.message,
          stack: errorEvent.error.stack,
        },
      });

      // Keep only recent errors
      if (errors.length > this.config.maxErrors) {
        errors.splice(this.config.maxErrors);
      }

      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (error) {
      console.warn('Failed to store error locally:', error);
    }
  }

  // Public API methods

  public addEventListener(listener: (event: ErrorEvent) => void): void {
    this.listeners.push(listener);
  }

  public removeEventListener(listener: (event: ErrorEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(errorEvent: ErrorEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(errorEvent);
      } catch (error) {
        console.error('Error in error event listener:', error);
      }
    });
  }

  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  public getStoredErrors(): ErrorEvent[] {
    try {
      return JSON.parse(localStorage.getItem('app_errors') || '[]');
    } catch {
      return [];
    }
  }

  public clearErrors(): void {
    this.metrics = this.initializeMetrics();
    this.errorQueue = [];
    localStorage.removeItem('app_errors');
  }

  public isHealthy(): boolean {
    return this.metrics.errorRate < 5 && this.metrics.sessionErrors < 10;
  }

  public updateConfig(config: Partial<ErrorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getHealthReport(): {
    healthy: boolean;
    totalErrors: number;
    errorRate: number;
    sessionErrors: number;
    topErrors: { type: string; count: number }[];
  } {
    const topErrors = Object.entries(this.metrics.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      healthy: this.isHealthy(),
      totalErrors: this.metrics.totalErrors,
      errorRate: this.metrics.errorRate,
      sessionErrors: this.metrics.sessionErrors,
      topErrors,
    };
  }
}

// Initialize global error handler
export const globalErrorHandler = GlobalErrorHandler.getInstance({
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableRemoteReporting: process.env.NODE_ENV === 'production',
  reportingUrl: process.env.REACT_APP_ERROR_REPORTING_URL,
});

// Export types
export type { ErrorEvent, ErrorMetrics, ErrorConfig };

// React hook for using the global error handler
import React from 'react';

export function useGlobalErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: Record<string, any>) => {
    globalErrorHandler.handleError(error, context);
  }, []);

  const getMetrics = React.useCallback(() => {
    return globalErrorHandler.getMetrics();
  }, []);

  const getHealthReport = React.useCallback(() => {
    return globalErrorHandler.getHealthReport();
  }, []);

  return {
    handleError,
    getMetrics,
    getHealthReport,
    isHealthy: globalErrorHandler.isHealthy(),
  };
}

export default GlobalErrorHandler;