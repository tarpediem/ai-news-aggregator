/**
 * Component Circuit Breaker - Prevents component-level infinite loops and render cycles
 * 
 * Features:
 * - Render loop detection and prevention
 * - Component lifecycle monitoring
 * - State update tracking
 * - Performance impact analysis
 * - Recovery mechanisms
 * - Integration with React DevTools
 */

import { Component } from 'react';

export interface ComponentCircuitBreakerConfig {
  componentId: string;
  maxRerenders: number;
  maxRerendersPerSecond: number;
  resetTimeoutMs: number;
  warningThreshold: number;
  trackStateUpdates: boolean;
  trackEffects: boolean;
  enableDevTools: boolean;
}

export interface ComponentStats {
  componentId: string;
  renderCount: number;
  stateUpdateCount: number;
  effectExecutionCount: number;
  errorCount: number;
  lastRender: number;
  averageRenderTime: number;
  isBlocked: boolean;
  blockReason?: string;
  performance: {
    score: number;
    renderTimeP95: number;
    memoryUsage: number;
  };
}

export interface RenderInfo {
  timestamp: number;
  renderTime: number;
  props?: Record<string, any>;
  state?: Record<string, any>;
  reason?: string;
  stackTrace?: string[];
}

export class ComponentCircuitBreaker {
  private config: ComponentCircuitBreakerConfig;
  private stats: ComponentStats;
  private renderHistory: RenderInfo[] = [];
  private stateUpdateHistory: number[] = [];
  private effectExecutionHistory: number[] = [];
  private errorHistory: Array<{ timestamp: number; error: Error; context: string }> = [];
  private isBlocked = false;
  private blockTime = 0;
  private blockReason = '';
  private renderStartTime = 0;
  private memoryBaseline = 0;

  // Performance tracking
  private renderTimes: number[] = [];
  private stateUpdateCallbacks = new Set<() => void>();
  
  // DevTools integration
  private devToolsHook: any = null;

  constructor(config: Partial<ComponentCircuitBreakerConfig> & { componentId: string }) {
    this.config = {
      maxRerenders: 50,
      maxRerendersPerSecond: 20,
      resetTimeoutMs: 5000,
      warningThreshold: 30,
      trackStateUpdates: true,
      trackEffects: true,
      enableDevTools: process.env.NODE_ENV === 'development',
      ...config
    };

    this.stats = {
      componentId: config.componentId,
      renderCount: 0,
      stateUpdateCount: 0,
      effectExecutionCount: 0,
      errorCount: 0,
      lastRender: 0,
      averageRenderTime: 0,
      isBlocked: false,
      performance: {
        score: 1.0,
        renderTimeP95: 0,
        memoryUsage: 0
      }
    };

    this.initializeDevTools();
    this.initializeMemoryBaseline();
  }

  /**
   * Check if an operation should be allowed
   */
  shouldAllow(operation: 'render' | 'state-update' | 'effect-execution'): boolean {
    const now = Date.now();

    // Check if circuit is tripped
    if (this.isBlocked) {
      if (now - this.blockTime > this.config.resetTimeoutMs) {
        this.reset();
      } else {
        this.logBlockedOperation(operation);
        return false;
      }
    }

    // Check rate limits based on operation type
    switch (operation) {
      case 'render':
        return this.checkRenderRateLimit(now);
      case 'state-update':
        return this.checkStateUpdateRateLimit(now);
      case 'effect-execution':
        return this.checkEffectRateLimit(now);
      default:
        return true;
    }
  }

  /**
   * Record the start of a render cycle
   */
  startRender(props?: Record<string, any>, state?: Record<string, any>, reason?: string): void {
    if (!this.shouldAllow('render')) {
      return;
    }

    this.renderStartTime = performance.now();
    
    if (this.config.enableDevTools) {
      this.notifyDevTools('render-start', {
        componentId: this.config.componentId,
        props,
        state,
        reason
      });
    }
  }

  /**
   * Record the end of a render cycle
   */
  endRender(success = true): void {
    if (this.renderStartTime === 0) return;

    const renderTime = performance.now() - this.renderStartTime;
    const now = Date.now();

    // Record render info
    const renderInfo: RenderInfo = {
      timestamp: now,
      renderTime,
      stackTrace: this.config.enableDevTools ? this.getStackTrace() : undefined
    };

    this.renderHistory.push(renderInfo);
    this.renderTimes.push(renderTime);

    // Keep history manageable
    if (this.renderHistory.length > 1000) {
      this.renderHistory = this.renderHistory.slice(-500);
    }
    if (this.renderTimes.length > 200) {
      this.renderTimes = this.renderTimes.slice(-100);
    }

    // Update stats
    this.stats.renderCount++;
    this.stats.lastRender = now;
    this.stats.averageRenderTime = this.calculateAverageRenderTime();
    this.updatePerformanceScore();

    // Check for render loop patterns
    this.detectRenderLoop();

    // Reset render start time
    this.renderStartTime = 0;

    // DevTools notification
    if (this.config.enableDevTools) {
      this.notifyDevTools('render-end', {
        componentId: this.config.componentId,
        renderTime,
        success,
        stats: this.getStats()
      });
    }

    // Warning for slow renders
    if (renderTime > 16.67 && this.config.enableDevTools) {
      console.warn(
        `🐌 Slow render in ${this.config.componentId}: ${renderTime.toFixed(2)}ms`
      );
    }
  }

  /**
   * Record a state update
   */
  recordStateUpdate(updateReason?: string): void {
    if (!this.config.trackStateUpdates) return;

    const now = Date.now();
    this.stateUpdateHistory.push(now);
    this.stats.stateUpdateCount++;

    // Clean old history
    this.stateUpdateHistory = this.stateUpdateHistory.filter(
      time => now - time < 10000
    );

    // Check for excessive state updates
    if (this.stateUpdateHistory.length > this.config.maxRerenders) {
      this.trip('Too many state updates', {
        updateCount: this.stateUpdateHistory.length,
        reason: updateReason
      });
    }

    // Notify callbacks
    this.stateUpdateCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('State update callback error:', error);
      }
    });
  }

  /**
   * Record an effect execution
   */
  recordEffectExecution(effectId?: string): void {
    if (!this.config.trackEffects) return;

    const now = Date.now();
    this.effectExecutionHistory.push(now);
    this.stats.effectExecutionCount++;

    // Clean old history
    this.effectExecutionHistory = this.effectExecutionHistory.filter(
      time => now - time < 5000
    );

    if (this.config.enableDevTools) {
      this.notifyDevTools('effect-execution', {
        componentId: this.config.componentId,
        effectId,
        timestamp: now
      });
    }
  }

  /**
   * Record an error
   */
  recordError(context: string, error: Error): void {
    const now = Date.now();
    this.errorHistory.push({ timestamp: now, error, context });
    this.stats.errorCount++;

    // Keep error history manageable
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-50);
    }

    // Check for error patterns that might indicate loops
    const recentErrors = this.errorHistory.filter(
      e => now - e.timestamp < 1000
    );

    if (recentErrors.length > 5) {
      this.trip('Too many errors', {
        errorCount: recentErrors.length,
        context,
        error: error.message
      });
    }

    if (this.config.enableDevTools) {
      console.error(
        `💥 Component error in ${this.config.componentId} (${context}):`,
        error
      );
    }
  }

  /**
   * Get current component statistics
   */
  getStats(): ComponentStats {
    return {
      ...this.stats,
      isBlocked: this.isBlocked,
      blockReason: this.blockReason,
      performance: {
        ...this.stats.performance,
        renderTimeP95: this.calculateRenderTimeP95(),
        memoryUsage: this.estimateMemoryUsage()
      }
    };
  }

  /**
   * Get detailed diagnostics
   */
  getDiagnostics() {
    return {
      config: this.config,
      stats: this.getStats(),
      recentRenders: this.renderHistory.slice(-10),
      recentErrors: this.errorHistory.slice(-5),
      performance: {
        renderTimeDistribution: this.calculateRenderTimeDistribution(),
        memoryTrend: this.calculateMemoryTrend(),
        suspiciousPatterns: this.detectSuspiciousPatterns()
      }
    };
  }

  /**
   * Subscribe to state update events
   */
  onStateUpdate(callback: () => void): () => void {
    this.stateUpdateCallbacks.add(callback);
    return () => this.stateUpdateCallbacks.delete(callback);
  }

  /**
   * Check if component is currently blocked
   */
  isComponentBlocked(): boolean {
    return this.isBlocked;
  }

  /**
   * Force reset the circuit breaker
   */
  forceReset(): void {
    this.reset();
    console.log(`🔧 Component circuit breaker force reset: ${this.config.componentId}`);
  }

  /**
   * Destroy the circuit breaker and clean up
   */
  destroy(): void {
    this.stateUpdateCallbacks.clear();
    this.renderHistory = [];
    this.stateUpdateHistory = [];
    this.effectExecutionHistory = [];
    this.errorHistory = [];
    this.renderTimes = [];
    
    if (this.config.enableDevTools) {
      this.notifyDevTools('component-destroyed', {
        componentId: this.config.componentId
      });
    }
  }

  // Private methods

  private checkRenderRateLimit(now: number): boolean {
    // Clean old render history
    this.renderHistory = this.renderHistory.filter(
      render => now - render.timestamp < 1000
    );

    if (this.renderHistory.length >= this.config.maxRerendersPerSecond) {
      this.trip('Render rate limit exceeded', {
        renderCount: this.renderHistory.length,
        timeWindow: '1 second'
      });
      return false;
    }

    return true;
  }

  private checkStateUpdateRateLimit(now: number): boolean {
    const recentUpdates = this.stateUpdateHistory.filter(
      time => now - time < 1000
    );

    if (recentUpdates.length > this.config.maxRerendersPerSecond) {
      this.trip('State update rate limit exceeded', {
        updateCount: recentUpdates.length
      });
      return false;
    }

    return true;
  }

  private checkEffectRateLimit(now: number): boolean {
    const recentEffects = this.effectExecutionHistory.filter(
      time => now - time < 1000
    );

    if (recentEffects.length > this.config.maxRerendersPerSecond * 2) {
      this.trip('Effect execution rate limit exceeded', {
        effectCount: recentEffects.length
      });
      return false;
    }

    return true;
  }

  private detectRenderLoop(): void {
    if (this.renderHistory.length < 10) return;

    const recentRenders = this.renderHistory.slice(-10);
    const renderInterval = recentRenders[recentRenders.length - 1].timestamp - 
                          recentRenders[0].timestamp;

    // If 10 renders happened in less than 100ms, likely a loop
    if (renderInterval < 100) {
      this.trip('Render loop detected', {
        renderCount: 10,
        timeInterval: renderInterval
      });
    }

    // Check for consistent rapid renders
    const avgRenderInterval = renderInterval / (recentRenders.length - 1);
    if (avgRenderInterval < 10) {
      console.warn(
        `⚠️ Rapid renders detected in ${this.config.componentId}: ${avgRenderInterval.toFixed(2)}ms average interval`
      );
    }
  }

  private trip(reason: string, details?: any): void {
    this.isBlocked = true;
    this.blockTime = Date.now();
    this.blockReason = reason;
    this.stats.isBlocked = true;

    console.error(
      `🚨 COMPONENT CIRCUIT BREAKER TRIPPED: ${this.config.componentId}`,
      `\nReason: ${reason}`,
      details ? `\nDetails:` : '',
      details || ''
    );

    if (this.config.enableDevTools) {
      this.notifyDevTools('circuit-breaker-tripped', {
        componentId: this.config.componentId,
        reason,
        details,
        stats: this.getStats()
      });
    }

    // Show user notification in development
    if (this.config.enableDevTools) {
      this.showDeveloperNotification(reason, details);
    }
  }

  private reset(): void {
    this.isBlocked = false;
    this.blockTime = 0;
    this.blockReason = '';
    this.stats.isBlocked = false;

    // Partially clear history to prevent immediate re-triggering
    this.renderHistory = this.renderHistory.slice(-5);
    this.stateUpdateHistory = this.stateUpdateHistory.slice(-5);
    this.effectExecutionHistory = this.effectExecutionHistory.slice(-5);

    console.log(`🔧 Component circuit breaker reset: ${this.config.componentId}`);

    if (this.config.enableDevTools) {
      this.notifyDevTools('circuit-breaker-reset', {
        componentId: this.config.componentId
      });
    }
  }

  private logBlockedOperation(operation: string): void {
    if (this.config.enableDevTools) {
      console.warn(
        `🚫 ${operation} blocked in ${this.config.componentId}: ${this.blockReason}`
      );
    }
  }

  private calculateAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
  }

  private calculateRenderTimeP95(): number {
    if (this.renderTimes.length === 0) return 0;
    const sorted = [...this.renderTimes].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }

  private calculateRenderTimeDistribution() {
    const buckets = { '<1ms': 0, '1-5ms': 0, '5-16ms': 0, '16-50ms': 0, '>50ms': 0 };
    
    this.renderTimes.forEach(time => {
      if (time < 1) buckets['<1ms']++;
      else if (time < 5) buckets['1-5ms']++;
      else if (time < 16) buckets['5-16ms']++;
      else if (time < 50) buckets['16-50ms']++;
      else buckets['>50ms']++;
    });

    return buckets;
  }

  private updatePerformanceScore(): void {
    let score = 1.0;

    // Penalty for slow renders
    const avgRenderTime = this.calculateAverageRenderTime();
    if (avgRenderTime > 16) score -= 0.3;
    else if (avgRenderTime > 8) score -= 0.1;

    // Penalty for frequent errors
    const errorRate = this.stats.errorCount / Math.max(this.stats.renderCount, 1);
    score -= errorRate * 0.5;

    // Penalty for excessive renders
    const renderRate = this.renderHistory.length;
    if (renderRate > this.config.warningThreshold) {
      score -= 0.2;
    }

    this.stats.performance.score = Math.max(score, 0.1);
  }

  private estimateMemoryUsage(): number {
    try {
      if ((performance as any).memory) {
        const current = (performance as any).memory.usedJSHeapSize;
        return current - this.memoryBaseline;
      }
    } catch (error) {
      // Ignore memory API errors
    }
    return 0;
  }

  private calculateMemoryTrend(): string {
    const currentUsage = this.estimateMemoryUsage();
    if (currentUsage > this.memoryBaseline + 10 * 1024 * 1024) { // 10MB increase
      return 'increasing';
    } else if (currentUsage < this.memoryBaseline - 5 * 1024 * 1024) { // 5MB decrease
      return 'decreasing';
    }
    return 'stable';
  }

  private detectSuspiciousPatterns(): string[] {
    const patterns: string[] = [];

    // Check for render timing patterns
    if (this.renderTimes.length > 5) {
      const variance = this.calculateVariance(this.renderTimes);
      if (variance < 1) {
        patterns.push('consistent-render-times');
      }
    }

    // Check for error clustering
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp < 5000
    );
    if (recentErrors.length > 3) {
      patterns.push('error-clustering');
    }

    // Check for state update patterns
    if (this.stateUpdateHistory.length > 10) {
      const intervals = [];
      for (let i = 1; i < this.stateUpdateHistory.length; i++) {
        intervals.push(this.stateUpdateHistory[i] - this.stateUpdateHistory[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 50) {
        patterns.push('rapid-state-updates');
      }
    }

    return patterns;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private initializeDevTools(): void {
    if (!this.config.enableDevTools) return;

    try {
      // Try to access React DevTools
      this.devToolsHook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    } catch (error) {
      // DevTools not available
    }
  }

  private initializeMemoryBaseline(): void {
    try {
      if ((performance as any).memory) {
        this.memoryBaseline = (performance as any).memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory API not available
    }
  }

  private notifyDevTools(event: string, data: any): void {
    if (!this.devToolsHook) return;

    try {
      this.devToolsHook.emit('component-circuit-breaker', {
        event,
        timestamp: Date.now(),
        ...data
      });
    } catch (error) {
      // DevTools notification failed
    }
  }

  private getStackTrace(): string[] {
    try {
      throw new Error();
    } catch (e: any) {
      return e.stack?.split('\n').slice(3, 8) || [];
    }
  }

  private showDeveloperNotification(reason: string, details?: any): void {
    if (typeof window === 'undefined') return;

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: linear-gradient(135deg, #fee, #fef3cd);
      border: 2px solid #f59e0b;
      color: #92400e;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      z-index: 10000;
      max-width: 400px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    `;

    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">
        ⚡ Component Protection: ${this.config.componentId}
      </div>
      <div style="margin-bottom: 8px; font-size: 13px;">
        ${reason}
      </div>
      ${details ? `<pre style="font-size: 11px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; overflow: auto; max-height: 100px;">${JSON.stringify(details, null, 2)}</pre>` : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
}

/**
 * Factory function for creating component circuit breakers
 */
export function createComponentCircuitBreaker(
  config: Partial<ComponentCircuitBreakerConfig> & { componentId: string }
): ComponentCircuitBreaker {
  return new ComponentCircuitBreaker(config);
}

/**
 * Global registry for component circuit breakers
 */
export const componentCircuitBreakerRegistry = new Map<string, ComponentCircuitBreaker>();

export function registerComponentCircuitBreaker(
  componentId: string,
  breaker: ComponentCircuitBreaker
): void {
  componentCircuitBreakerRegistry.set(componentId, breaker);
}

export function getComponentCircuitBreakerStats(): Record<string, ComponentStats> {
  const stats: Record<string, ComponentStats> = {};
  componentCircuitBreakerRegistry.forEach((breaker, id) => {
    stats[id] = breaker.getStats();
  });
  return stats;
}

/**
 * Development helper to get all component diagnostics
 */
export function getAllComponentDiagnostics() {
  const diagnostics: Record<string, any> = {};
  componentCircuitBreakerRegistry.forEach((breaker, id) => {
    diagnostics[id] = breaker.getDiagnostics();
  });
  return diagnostics;
}