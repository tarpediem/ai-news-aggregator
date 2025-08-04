/**
 * Store Circuit Breaker - Advanced loop prevention for Zustand stores
 * Prevents infinite update loops while maintaining full functionality
 * 
 * Features:
 * - Rate limiting with adaptive thresholds
 * - Update comparison to prevent unnecessary state changes
 * - Subscription loop detection and circuit breaking
 * - Emergency reset and recovery mechanisms
 * - Performance monitoring and analytics
 */

import { StoreApi } from 'zustand';

export interface CircuitBreakerConfig {
  maxUpdatesPerSecond: number;
  maxUpdatesPerMinute: number;
  comparisonDepth: number;
  resetTimeoutMs: number;
  warningThreshold: number;
  emergencyThreshold: number;
}

export interface CircuitBreakerStats {
  totalUpdates: number;
  blockedUpdates: number;
  lastUpdate: number;
  isTripped: boolean;
  currentRate: number;
  performanceScore: number;
}

export interface StateUpdateInfo {
  path: string;
  timestamp: number;
  callStack?: string;
  stateSize?: number;
}

class StoreCircuitBreaker<T> {
  private config: CircuitBreakerConfig;
  private stats: CircuitBreakerStats;
  private updateHistory: StateUpdateInfo[] = [];
  private lastState: T | null = null;
  private isTripped = false;
  private tripTime = 0;
  private updateCallbacks = new Set<(stats: CircuitBreakerStats) => void>();
  
  // Rate limiting buckets
  private secondBucket: number[] = [];
  private minuteBucket: number[] = [];
  
  // State comparison cache
  private comparisonCache = new Map<string, any>();
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      maxUpdatesPerSecond: 50,
      maxUpdatesPerMinute: 1000,
      comparisonDepth: 3,
      resetTimeoutMs: 5000,
      warningThreshold: 30,
      emergencyThreshold: 100,
      ...config
    };
    
    this.stats = {
      totalUpdates: 0,
      blockedUpdates: 0,
      lastUpdate: 0,
      isTripped: false,
      currentRate: 0,
      performanceScore: 1.0
    };
    
    this.startCleanupInterval();
  }

  /**
   * Check if an update should be allowed
   */
  shouldAllowUpdate(newState: T, updatePath = 'unknown'): boolean {
    const now = Date.now();
    
    // Check if circuit is tripped
    if (this.isTripped) {
      if (now - this.tripTime > this.config.resetTimeoutMs) {
        this.reset();
      } else {
        this.stats.blockedUpdates++;
        this.notifyCallbacks();
        return false;
      }
    }
    
    // Rate limiting check
    if (!this.checkRateLimit(now)) {
      this.stats.blockedUpdates++;
      this.notifyCallbacks();
      return false;
    }
    
    // State comparison to prevent unnecessary updates
    if (this.lastState && this.deepEqual(this.lastState, newState)) {
      // Identical state - block update but don't count as error
      return false;
    }
    
    // Record update
    this.recordUpdate(updatePath, now);
    this.lastState = this.deepClone(newState);
    
    // Check for emergency conditions
    if (this.detectEmergencyConditions()) {
      this.trip('Emergency conditions detected');
      return false;
    }
    
    return true;
  }

  /**
   * Wrap store setter with circuit breaker protection
   */
  protectSetter<Args extends any[]>(
    originalSetter: (...args: Args) => void,
    updatePath: string
  ): (...args: Args) => void {
    return (...args: Args) => {
      try {
        // Pre-flight check with current state
        const currentTime = Date.now();
        
        if (this.isTripped) {
          console.warn(`🚫 Store update blocked by circuit breaker: ${updatePath}`);
          return;
        }
        
        // Execute the original setter
        originalSetter(...args);
        
        // Post-execution verification
        this.recordUpdate(updatePath, currentTime);
        
      } catch (error) {
        console.error(`💥 Store update error in ${updatePath}:`, error);
        this.recordError(updatePath, error);
        throw error;
      }
    };
  }

  /**
   * Create a safe subscription wrapper
   */
  createSafeSubscription<U>(
    store: StoreApi<T>,
    selector: (state: T) => U,
    callback: (value: U, previousValue: U) => void,
    subscriptionId: string
  ): (() => void) {
    let previousValue: U;
    let isInitialized = false;
    let subscriptionCallCount = 0;
    const maxCallsPerSecond = 20;
    const callHistory: number[] = [];
    
    const safeCallback = (state: T) => {
      const now = Date.now();
      
      // Rate limit subscription callbacks
      callHistory.push(now);
      // Keep only calls from last second
      while (callHistory.length > 0 && now - callHistory[0] > 1000) {
        callHistory.shift();
      }
      
      if (callHistory.length > maxCallsPerSecond) {
        console.warn(`🚫 Subscription ${subscriptionId} rate limited`);
        return;
      }
      
      try {
        const currentValue = selector(state);
        
        if (isInitialized) {
          // Only call if value actually changed
          if (!this.deepEqual(currentValue, previousValue)) {
            callback(currentValue, previousValue);
          }
        } else {
          isInitialized = true;
        }
        
        previousValue = currentValue;
        subscriptionCallCount++;
        
      } catch (error) {
        console.error(`💥 Subscription error in ${subscriptionId}:`, error);
        this.recordError(`subscription:${subscriptionId}`, error);
      }
    };
    
    // Create the actual subscription
    const unsubscribe = store.subscribe(safeCallback);
    
    // Enhanced unsubscribe with cleanup
    return () => {
      try {
        unsubscribe();
        console.log(`🧹 Cleaned up subscription ${subscriptionId} (${subscriptionCallCount} calls)`);
      } catch (error) {
        console.error(`💥 Error cleaning up subscription ${subscriptionId}:`, error);
      }
    };
  }

  private checkRateLimit(now: number): boolean {
    // Clean old entries
    this.secondBucket = this.secondBucket.filter(time => now - time < 1000);
    this.minuteBucket = this.minuteBucket.filter(time => now - time < 60000);
    
    // Check limits
    if (this.secondBucket.length >= this.config.maxUpdatesPerSecond) {
      console.warn(`🚫 Rate limit exceeded: ${this.secondBucket.length} updates/second`);
      return false;
    }
    
    if (this.minuteBucket.length >= this.config.maxUpdatesPerMinute) {
      console.warn(`🚫 Rate limit exceeded: ${this.minuteBucket.length} updates/minute`);
      return false;
    }
    
    // Add to buckets
    this.secondBucket.push(now);
    this.minuteBucket.push(now);
    
    return true;
  }

  private recordUpdate(path: string, timestamp: number): void {
    this.updateHistory.push({
      path,
      timestamp,
      callStack: this.getCallStack(),
      stateSize: this.estimateStateSize()
    });
    
    // Keep only recent history
    if (this.updateHistory.length > 1000) {
      this.updateHistory = this.updateHistory.slice(-500);
    }
    
    this.stats.totalUpdates++;
    this.stats.lastUpdate = timestamp;
    this.stats.currentRate = this.secondBucket.length;
    this.updatePerformanceScore();
    this.notifyCallbacks();
  }

  private recordError(path: string, error: any): void {
    console.error(`🚨 Circuit breaker error in ${path}:`, error);
    
    // Check if this might be causing a loop
    const recentErrors = this.updateHistory
      .filter(update => 
        Date.now() - update.timestamp < 1000 && 
        update.path === path
      );
    
    if (recentErrors.length > 5) {
      this.trip(`Too many errors in ${path}`);
    }
  }

  private detectEmergencyConditions(): boolean {
    const now = Date.now();
    const recentUpdates = this.updateHistory.filter(
      update => now - update.timestamp < 1000
    );
    
    // Check for rapid repeated updates
    if (recentUpdates.length > this.config.emergencyThreshold) {
      return true;
    }
    
    // Check for suspicious patterns
    const pathCounts: Record<string, number> = {};
    recentUpdates.forEach(update => {
      pathCounts[update.path] = (pathCounts[update.path] || 0) + 1;
    });
    
    // Any single path updating too frequently?
    return Object.values(pathCounts).some(count => count > 20);
  }

  private trip(reason: string): void {
    this.isTripped = true;
    this.tripTime = Date.now();
    this.stats.isTripped = true;
    
    console.error(`🚨 CIRCUIT BREAKER TRIPPED: ${reason}`);
    console.error('📊 Current stats:', this.getDetailedStats());
    
    // Show user notification
    this.showUserNotification(reason);
    this.notifyCallbacks();
  }

  private reset(): void {
    this.isTripped = false;
    this.tripTime = 0;
    this.stats.isTripped = false;
    this.secondBucket = [];
    this.minuteBucket = [];
    this.updateHistory = [];
    this.comparisonCache.clear();
    
    console.log('🔧 Circuit breaker reset - normal operation resumed');
    this.notifyCallbacks();
  }

  private deepEqual(a: any, b: any, depth = 0): boolean {
    if (depth > this.config.comparisonDepth) return true;
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key], depth + 1)) return false;
      }
      
      return true;
    }
    
    return false;
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  private getCallStack(): string {
    try {
      throw new Error();
    } catch (e: any) {
      return e.stack?.split('\n').slice(3, 8).join(' → ') || 'unknown';
    }
  }

  private estimateStateSize(): number {
    try {
      return JSON.stringify(this.lastState).length;
    } catch {
      return 0;
    }
  }

  private updatePerformanceScore(): void {
    const recentUpdates = this.updateHistory.filter(
      update => Date.now() - update.timestamp < 10000
    ).length;
    
    const baseScore = 1.0;
    const penalty = Math.min(recentUpdates / 100, 0.8);
    this.stats.performanceScore = Math.max(baseScore - penalty, 0.1);
  }

  private showUserNotification(reason: string): void {
    if (typeof window === 'undefined') return;
    
    const existingNotification = document.getElementById('store-circuit-breaker-notification');
    if (existingNotification) return;
    
    const notification = document.createElement('div');
    notification.id = 'store-circuit-breaker-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
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
      backdrop-filter: blur(10px);
    `;
    
    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">⚡</span>
        Store Protection Activated
      </div>
      <div style="margin-bottom: 12px; font-size: 13px; opacity: 0.9;">
        ${reason}
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="store-reset-btn" style="
          background: #f59e0b; 
          color: white; 
          border: none; 
          padding: 6px 12px; 
          border-radius: 6px; 
          font-size: 12px; 
          cursor: pointer;
          font-weight: 500;
        ">Reset Now</button>
        <button id="store-dismiss-btn" style="
          background: transparent; 
          color: #92400e; 
          border: 1px solid #f59e0b; 
          padding: 6px 12px; 
          border-radius: 6px; 
          font-size: 12px; 
          cursor: pointer;
        ">Dismiss</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add event listeners
    document.getElementById('store-reset-btn')?.addEventListener('click', () => {
      this.forceReset();
      notification.remove();
    });
    
    document.getElementById('store-dismiss-btn')?.addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-remove after timeout
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean old history
      this.updateHistory = this.updateHistory.filter(
        update => now - update.timestamp < 60000
      );
      
      // Clean comparison cache
      if (this.comparisonCache.size > 100) {
        this.comparisonCache.clear();
      }
      
    }, 30000); // Clean every 30 seconds
  }

  private notifyCallbacks(): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(this.stats);
      } catch (error) {
        console.error('Error in circuit breaker callback:', error);
      }
    });
  }

  // Public methods
  public forceReset(): void {
    console.log('🔧 Force resetting circuit breaker...');
    this.reset();
  }

  public getStats(): CircuitBreakerStats {
    return { ...this.stats };
  }

  public getDetailedStats(): any {
    return {
      ...this.stats,
      config: this.config,
      updateHistoryLength: this.updateHistory.length,
      recentUpdates: this.updateHistory.slice(-10),
      rateLimits: {
        secondBucket: this.secondBucket.length,
        minuteBucket: this.minuteBucket.length,
      }
    };
  }

  public onStatsUpdate(callback: (stats: CircuitBreakerStats) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public destroy(): void {
    this.updateCallbacks.clear();
    this.updateHistory = [];
    this.comparisonCache.clear();
  }
}

// Factory function for creating circuit breakers
export function createStoreCircuitBreaker<T>(
  config?: Partial<CircuitBreakerConfig>
): StoreCircuitBreaker<T> {
  return new StoreCircuitBreaker<T>(config);
}

// Global circuit breaker registry for monitoring
export const circuitBreakerRegistry = new Map<string, StoreCircuitBreaker<any>>();

export function registerCircuitBreaker<T>(
  name: string, 
  breaker: StoreCircuitBreaker<T>
): void {
  circuitBreakerRegistry.set(name, breaker);
}

export function getCircuitBreakerStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  circuitBreakerRegistry.forEach((breaker, name) => {
    stats[name] = breaker.getDetailedStats();
  });
  return stats;
}

export { StoreCircuitBreaker };