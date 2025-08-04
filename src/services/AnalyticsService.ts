/**
 * Analytics and performance monitoring service
 * Tracks user interactions, performance metrics, and system health
 */

import React from 'react';

import { CACHE_CONFIG } from '../config/constants';

interface AnalyticsEvent {
  eventType: string;
  eventName: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  properties: Record<string, any>;
  metadata: {
    url: string;
    userAgent: string;
    viewport: string;
    referrer: string;
    deviceType: 'desktop' | 'tablet' | 'mobile';
  };
}

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  memoryUsage: number;
  networkLatency: number;
}

interface UserInteraction {
  type: 'click' | 'scroll' | 'search' | 'filter' | 'share' | 'bookmark';
  target: string;
  timestamp: Date;
  duration?: number;
  value?: string;
  metadata: Record<string, any>;
}

interface SystemHealth {
  timestamp: Date;
  errorCount: number;
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  activeUsers: number;
  systemLoad: number;
}

interface AnalyticsConfig {
  trackingId?: string;
  enablePerformanceMonitoring: boolean;
  enableUserTracking: boolean;
  enableErrorTracking: boolean;
  enableSystemHealthTracking: boolean;
  batchSize: number;
  flushInterval: number;
  retentionDays: number;
  endpoint?: string;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private config: AnalyticsConfig;
  private sessionId: string;
  private userId?: string;
  private eventQueue: AnalyticsEvent[] = [];
  private performanceObserver?: PerformanceObserver;
  private isFlushingEvents = false;
  private flushTimer?: number;
  private lastFlushTime = 0;

  private constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      enableUserTracking: true,
      enableErrorTracking: true,
      enableSystemHealthTracking: true,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      retentionDays: 30,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.initializeTracking();
  }

  static getInstance(config?: Partial<AnalyticsConfig>): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService(config);
    }
    return AnalyticsService.instance;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeTracking(): void {
    this.setupPerformanceMonitoring();
    this.setupUserInteractionTracking();
    this.setupPageVisibilityTracking();
    this.setupUnloadTracking();
    this.startFlushTimer();
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Web Vitals monitoring
    this.observeWebVitals();

    // Performance Observer for detailed metrics
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.trackPerformanceEntry(entry);
        });
      });

      this.performanceObserver.observe({ entryTypes: ['navigation', 'measure', 'paint'] });
    }

    // Memory usage monitoring
    this.monitorMemoryUsage();
  }

  private observeWebVitals(): void {
    // First Contentful Paint
    this.observePerformanceMetric('first-contentful-paint', (entry) => {
      this.trackEvent('performance', 'fcp', {
        value: entry.startTime,
        url: window.location.href,
      });
    });

    // Largest Contentful Paint
    this.observePerformanceMetric('largest-contentful-paint', (entry) => {
      this.trackEvent('performance', 'lcp', {
        value: entry.startTime,
        url: window.location.href,
      });
    });

    // Cumulative Layout Shift
    this.observePerformanceMetric('layout-shift', (entry) => {
      if (!(entry as any).hadRecentInput) {
        this.trackEvent('performance', 'cls', {
          value: (entry as any).value,
          url: window.location.href,
        });
      }
    });

    // First Input Delay
    this.observePerformanceMetric('first-input', (entry) => {
      this.trackEvent('performance', 'fid', {
        value: (entry as any).processingStart - entry.startTime,
        url: window.location.href,
      });
    });
  }

  private observePerformanceMetric(type: string, callback: (entry: PerformanceEntry) => void): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(callback);
      });
      
      try {
        observer.observe({ type, buffered: true });
      } catch (e) {
        // Fallback for older browsers
        console.warn(`Performance metric ${type} not supported`);
      }
    }
  }

  private trackPerformanceEntry(entry: PerformanceEntry): void {
    const performanceData = {
      name: entry.name,
      type: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
    };

    this.trackEvent('performance', 'entry', performanceData);
  }

  private monitorMemoryUsage(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.trackEvent('performance', 'memory', {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }, 60000); // Every minute
    }
  }

  private setupUserInteractionTracking(): void {
    if (!this.config.enableUserTracking) return;

    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.trackInteraction('click', {
        target: this.getElementSelector(target),
        text: target.textContent?.slice(0, 100) || '',
        x: event.clientX,
        y: event.clientY,
      });
    });

    // Scroll tracking
    let scrollTimer: number;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        this.trackInteraction('scroll', {
          scrollY: window.scrollY,
          scrollX: window.scrollX,
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
        });
      }, 250);
    });

    // Form interactions
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.type === 'search') {
        this.trackInteraction('search', {
          target: this.getElementSelector(target),
          query: target.value,
        });
      }
    });
  }

  private setupPageVisibilityTracking(): void {
    let visibilityStart = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const sessionDuration = Date.now() - visibilityStart;
        this.trackEvent('session', 'page_hidden', {
          duration: sessionDuration,
        });
      } else {
        visibilityStart = Date.now();
        this.trackEvent('session', 'page_visible', {
          timestamp: visibilityStart,
        });
      }
    });
  }

  private setupUnloadTracking(): void {
    window.addEventListener('beforeunload', () => {
      this.flushEvents(true);
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flushEvents();
    }, this.config.flushInterval);
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  private getMetadata(): AnalyticsEvent['metadata'] {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      referrer: document.referrer,
      deviceType: this.getDeviceType(),
    };
  }

  private getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  // Public API

  public trackEvent(eventType: string, eventName: string, properties: Record<string, any> = {}): void {
    const event: AnalyticsEvent = {
      eventType,
      eventName,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      properties,
      metadata: this.getMetadata(),
    };

    this.eventQueue.push(event);

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }
  }

  public trackInteraction(type: UserInteraction['type'], properties: Record<string, any> = {}): void {
    this.trackEvent('interaction', type, properties);
  }

  public trackPageView(path: string, title?: string): void {
    this.trackEvent('navigation', 'page_view', {
      path,
      title: title || document.title,
      timestamp: Date.now(),
    });
  }

  public trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enableErrorTracking) return;

    this.trackEvent('error', 'javascript_error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context: context || {},
    });
  }

  public trackPerformanceMetrics(metrics: Partial<PerformanceMetrics>): void {
    if (!this.config.enablePerformanceMonitoring) return;

    this.trackEvent('performance', 'metrics', metrics);
  }

  public trackSystemHealth(health: Partial<SystemHealth>): void {
    if (!this.config.enableSystemHealthTracking) return;

    this.trackEvent('system', 'health', health);
  }

  public trackUserAction(action: string, properties: Record<string, any> = {}): void {
    this.trackEvent('user', action, properties);
  }

  public trackBusinessMetric(metric: string, value: number, properties: Record<string, any> = {}): void {
    this.trackEvent('business', metric, {
      value,
      ...properties,
    });
  }

  public setUserId(userId: string): void {
    this.userId = userId;
    this.trackEvent('user', 'identified', { userId });
  }

  public setUserProperties(properties: Record<string, any>): void {
    this.trackEvent('user', 'properties_updated', properties);
  }

  private async flushEvents(isUnloading = false): Promise<void> {
    if (this.isFlushingEvents || this.eventQueue.length === 0) return;

    this.isFlushingEvents = true;
    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(events, isUnloading);
      this.lastFlushTime = Date.now();
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      // Re-queue events if not unloading
      if (!isUnloading) {
        this.eventQueue = [...events, ...this.eventQueue];
      }
    } finally {
      this.isFlushingEvents = false;
    }
  }

  private async sendEvents(events: AnalyticsEvent[], isUnloading = false): Promise<void> {
    if (!this.config.endpoint) {
      // Store locally for development
      this.storeEventsLocally(events);
      return;
    }

    const payload = {
      events,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
    };

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    if (isUnloading) {
      // Use sendBeacon for unload events
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon(this.config.endpoint, JSON.stringify(payload));
        return;
      }
    }

    await fetch(this.config.endpoint, requestOptions);
  }

  private storeEventsLocally(events: AnalyticsEvent[]): void {
    try {
      const storedEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      const allEvents = [...storedEvents, ...events];
      
      // Keep only recent events
      const maxEvents = 1000;
      const recentEvents = allEvents.slice(-maxEvents);
      
      localStorage.setItem('analytics_events', JSON.stringify(recentEvents));
    } catch (error) {
      console.warn('Failed to store analytics events locally:', error);
    }
  }

  // Analytics queries and insights

  public getStoredEvents(): AnalyticsEvent[] {
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]');
    } catch {
      return [];
    }
  }

  public getEventCounts(timeRange: 'hour' | 'day' | 'week' = 'day'): Record<string, number> {
    const events = this.getStoredEvents();
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.getTimeRangeMs(timeRange));

    const counts: Record<string, number> = {};
    events
      .filter(event => new Date(event.timestamp) >= cutoff)
      .forEach(event => {
        const key = `${event.eventType}:${event.eventName}`;
        counts[key] = (counts[key] || 0) + 1;
      });

    return counts;
  }

  public getPerformanceInsights(): {
    averageLoadTime: number;
    errorRate: number;
    topErrors: { error: string; count: number }[];
    userEngagement: number;
  } {
    const events = this.getStoredEvents();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = events.filter(event => new Date(event.timestamp) >= dayAgo);
    
    // Calculate metrics
    const pageViews = recentEvents.filter(e => e.eventType === 'navigation' && e.eventName === 'page_view');
    const errors = recentEvents.filter(e => e.eventType === 'error');
    const interactions = recentEvents.filter(e => e.eventType === 'interaction');

    const averageLoadTime = pageViews.reduce((sum, event) => {
      return sum + (event.properties.loadTime || 0);
    }, 0) / pageViews.length || 0;

    const errorRate = errors.length / Math.max(pageViews.length, 1);

    const errorCounts: Record<string, number> = {};
    errors.forEach(error => {
      const key = error.properties.message || 'Unknown error';
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    const userEngagement = interactions.length / Math.max(pageViews.length, 1);

    return {
      averageLoadTime,
      errorRate,
      topErrors,
      userEngagement,
    };
  }

  private getTimeRangeMs(range: 'hour' | 'day' | 'week'): number {
    switch (range) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  public updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public clearData(): void {
    this.eventQueue = [];
    localStorage.removeItem('analytics_events');
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.flushEvents(true);
  }
}

// Initialize analytics service
export const analyticsService = AnalyticsService.getInstance({
  enablePerformanceMonitoring: true,
  enableUserTracking: true,
  enableErrorTracking: true,
  endpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT,
});

// React hook for analytics
export function useAnalytics() {
  const trackEvent = React.useCallback((eventType: string, eventName: string, properties?: Record<string, any>) => {
    analyticsService.trackEvent(eventType, eventName, properties);
  }, []);

  const trackUserAction = React.useCallback((action: string, properties?: Record<string, any>) => {
    analyticsService.trackUserAction(action, properties);
  }, []);

  const trackPageView = React.useCallback((path: string, title?: string) => {
    analyticsService.trackPageView(path, title);
  }, []);

  return {
    trackEvent,
    trackUserAction,
    trackPageView,
    getInsights: () => analyticsService.getPerformanceInsights(),
    getEventCounts: (timeRange?: 'hour' | 'day' | 'week') => analyticsService.getEventCounts(timeRange),
  };
}

// Export types
export type { AnalyticsEvent, PerformanceMetrics, UserInteraction, SystemHealth, AnalyticsConfig };

export default AnalyticsService;