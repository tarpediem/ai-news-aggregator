/**
 * Safe useCallback Hook - Prevents infinite loops from unstable callback dependencies
 * 
 * Features:
 * - Dependency validation and stability checking
 * - Callback execution tracking and rate limiting
 * - Memory leak prevention
 * - Performance monitoring
 * - Integration with component circuit breaker
 * - Automatic cleanup and unmount protection
 */

import { useCallback, useRef, useMemo } from 'react';
import { ComponentCircuitBreaker } from '../utils/componentCircuitBreaker';

export interface SafeCallbackOptions {
  /**
   * Maximum executions per second
   */
  maxExecutionsPerSecond?: number;
  
  /**
   * Enable dependency stability validation
   */
  validateDependencies?: boolean;
  
  /**
   * Callback identifier for debugging
   */
  callbackId?: string;
  
  /**
   * Enable circuit breaker protection
   */
  enableCircuitBreaker?: boolean;
  
  /**
   * Skip callback if dependencies are unstable
   */
  skipOnUnstableDeps?: boolean;
  
  /**
   * Enable development warnings
   */
  enableWarnings?: boolean;
  
  /**
   * Custom equality function for dependency comparison
   */
  equalityFn?: (a: any, b: any) => boolean;
  
  /**
   * Debounce callback executions (ms)
   */
  debounceMs?: number;
}

export interface CallbackExecutionStats {
  executionCount: number;
  lastExecution: number;
  averageExecutionTime: number;
  isBlocked: boolean;
  dependencyChanges: number;
  totalCreations: number;
}

/**
 * Deep equality comparison for dependencies
 */
function deepEqual(a: any, b: any, depth = 0): boolean {
  if (depth > 3) return true; // Prevent infinite recursion
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key], depth + 1)) return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Safe useCallback hook with loop prevention and enhanced validation
 */
export function useSafeCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  options: SafeCallbackOptions = {}
): [T, CallbackExecutionStats] {
  const {
    maxExecutionsPerSecond = 60,
    validateDependencies = true,
    callbackId = `callback-${Math.random().toString(36).substr(2, 9)}`,
    enableCircuitBreaker = true,
    skipOnUnstableDeps = true,
    enableWarnings = process.env.NODE_ENV === 'development',
    equalityFn = deepEqual,
    debounceMs = 0
  } = options;

  // Execution tracking
  const executionHistoryRef = useRef<number[]>([]);
  const executionCountRef = useRef(0);
  const lastExecutionRef = useRef(0);
  const executionTimesRef = useRef<number[]>([]);
  const dependencyChangesRef = useRef(0);
  const lastDepsRef = useRef<React.DependencyList>(deps);
  const totalCreationsRef = useRef(0);
  const mountedRef = useRef(true);
  const circuitBreakerRef = useRef<ComponentCircuitBreaker | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize circuit breaker if enabled
  if (enableCircuitBreaker && !circuitBreakerRef.current) {
    circuitBreakerRef.current = new ComponentCircuitBreaker({
      componentId: callbackId,
      maxRerenders: maxExecutionsPerSecond,
      resetTimeoutMs: 10000
    });
  }

  // Dependency validation
  const validateDepsChange = useMemo(() => {
    const changed = !equalityFn(deps, lastDepsRef.current);
    if (changed) {
      dependencyChangesRef.current++;
      lastDepsRef.current = [...deps];
      
      if (enableWarnings && dependencyChangesRef.current > 100) {
        console.warn(
          `🚨 Callback ${callbackId} dependencies changed ${dependencyChangesRef.current} times. Check for unstable dependencies.`
        );
      }
    }
    return changed;
  }, [deps, equalityFn, callbackId, enableWarnings]);

  // Check for unstable dependencies
  const checkDependencyStability = useMemo(() => {
    if (!validateDependencies) return true;
    
    let hasUnstableDeps = false;
    
    deps.forEach((dep, index) => {
      // Check for inline object/array creation
      if (typeof dep === 'object' && dep !== null && !Array.isArray(dep)) {
        if (enableWarnings) {
          console.warn(
            `🚨 Potentially unstable object dependency at index ${index} in callback ${callbackId}:`,
            dep
          );
        }
        hasUnstableDeps = true;
      }
      
      // Check for inline function creation
      if (typeof dep === 'function') {
        if (enableWarnings) {
          console.warn(
            `🚨 Function dependency at index ${index} in callback ${callbackId}. Consider using useCallback.`
          );
        }
        hasUnstableDeps = true;
      }
      
      // Check for frequently changing values
      if (typeof dep === 'number' && dep === Date.now()) {
        if (enableWarnings) {
          console.warn(
            `🚨 Timestamp dependency detected in callback ${callbackId}. This will cause frequent recreations.`
          );
        }
        hasUnstableDeps = true;
      }
    });
    
    return !hasUnstableDeps;
  }, [deps, validateDependencies, callbackId, enableWarnings]);

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    
    // Clean old executions (keep only last second)
    executionHistoryRef.current = executionHistoryRef.current.filter(
      time => now - time < 1000
    );
    
    if (executionHistoryRef.current.length >= maxExecutionsPerSecond) {
      if (enableWarnings) {
        console.warn(
          `🚫 Callback ${callbackId} rate limited: ${executionHistoryRef.current.length} executions/second`
        );
      }
      return false;
    }
    
    return true;
  }, [maxExecutionsPerSecond, callbackId, enableWarnings]);

  // Create the safe callback wrapper
  const safeCallback = useCallback((...args: Parameters<T>) => {
    if (!mountedRef.current) {
      if (enableWarnings) {
        console.warn(`🚨 Callback ${callbackId} called after component unmount`);
      }
      return;
    }

    // Check circuit breaker
    if (enableCircuitBreaker && circuitBreakerRef.current) {
      if (!circuitBreakerRef.current.shouldAllow('effect-execution')) {
        if (enableWarnings) {
          console.warn(`🚫 Callback ${callbackId} blocked by circuit breaker`);
        }
        return;
      }
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return;
    }

    // Handle debouncing
    if (debounceMs > 0) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        executeCallback(args);
      }, debounceMs);
      
      return;
    }

    return executeCallback(args);
  }, [callback, checkRateLimit, enableCircuitBreaker, enableWarnings, callbackId, debounceMs]);

  // Execute callback with tracking
  const executeCallback = useCallback((args: Parameters<T>) => {
    const startTime = performance.now();
    
    try {
      const result = callback(...args);
      
      // Track execution
      const executionTime = performance.now() - startTime;
      const now = Date.now();
      
      executionHistoryRef.current.push(now);
      executionCountRef.current++;
      lastExecutionRef.current = now;
      executionTimesRef.current.push(executionTime);
      
      // Keep only recent execution times
      if (executionTimesRef.current.length > 100) {
        executionTimesRef.current = executionTimesRef.current.slice(-50);
      }

      // Record with circuit breaker
      if (enableCircuitBreaker && circuitBreakerRef.current) {
        circuitBreakerRef.current.recordEffectExecution(callbackId);
      }

      // Warning for slow callbacks
      if (enableWarnings && executionTime > 10) {
        console.warn(
          `⚠️ Slow callback execution in ${callbackId}: ${executionTime.toFixed(2)}ms`
        );
      }

      return result;
      
    } catch (error) {
      console.error(`💥 Callback execution error in ${callbackId}:`, error);
      
      // Record error with circuit breaker
      if (enableCircuitBreaker && circuitBreakerRef.current) {
        circuitBreakerRef.current.recordError('callback-execution', error as Error);
      }
      
      throw error;
    }
  }, [callback, callbackId, enableCircuitBreaker, enableWarnings]);

  // Create memoized callback based on dependency stability
  const memoizedCallback = useMemo(() => {
    totalCreationsRef.current++;
    
    // Skip creation if dependencies are unstable
    if (skipOnUnstableDeps && !checkDependencyStability) {
      if (enableWarnings) {
        console.warn(`⚠️ Skipping callback creation for ${callbackId} due to unstable dependencies`);
      }
      // Return a no-op function instead
      return ((...args: any[]) => {
        if (enableWarnings) {
          console.warn(`🚫 Callback ${callbackId} execution skipped due to unstable dependencies`);
        }
      }) as T;
    }

    if (enableWarnings && totalCreationsRef.current > 50) {
      console.warn(
        `🚨 Callback ${callbackId} recreated ${totalCreationsRef.current} times. Check dependencies.`
      );
    }

    return safeCallback;
  }, [
    safeCallback,
    checkDependencyStability,
    skipOnUnstableDeps,
    callbackId,
    enableWarnings,
    ...deps
  ]) as T;

  // Cleanup on unmount
  useMemo(() => {
    return () => {
      mountedRef.current = false;
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      if (circuitBreakerRef.current) {
        circuitBreakerRef.current.destroy();
      }
    };
  }, []);

  // Calculate execution stats
  const executionStats: CallbackExecutionStats = useMemo(() => ({
    executionCount: executionCountRef.current,
    lastExecution: lastExecutionRef.current,
    averageExecutionTime: executionTimesRef.current.length > 0 
      ? executionTimesRef.current.reduce((a, b) => a + b, 0) / executionTimesRef.current.length 
      : 0,
    isBlocked: enableCircuitBreaker 
      ? circuitBreakerRef.current?.isComponentBlocked() ?? false 
      : false,
    dependencyChanges: dependencyChangesRef.current,
    totalCreations: totalCreationsRef.current
  }), [enableCircuitBreaker]);

  return [memoizedCallback, executionStats];
}

/**
 * Hook for creating stable event handlers
 */
export function useSafeEventHandler<T extends (...args: any[]) => any>(
  handler: T,
  deps: React.DependencyList = []
): T {
  const [safeHandler] = useSafeCallback(handler, deps, {
    callbackId: 'event-handler',
    maxExecutionsPerSecond: 100, // Higher limit for event handlers
    debounceMs: 0,
    skipOnUnstableDeps: false // Event handlers can have dynamic deps
  });

  return safeHandler;
}

/**
 * Hook for creating debounced callbacks
 */
export function useSafeDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  delayMs: number,
  options: Omit<SafeCallbackOptions, 'debounceMs'> = {}
): T {
  const [debouncedCallback] = useSafeCallback(callback, deps, {
    ...options,
    debounceMs: delayMs,
    callbackId: options.callbackId || 'debounced-callback'
  });

  return debouncedCallback;
}

/**
 * Hook for creating throttled callbacks
 */
export function useSafeThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  intervalMs: number,
  options: SafeCallbackOptions = {}
): T {
  const lastExecutionRef = useRef(0);
  
  const throttledHandler = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastExecutionRef.current >= intervalMs) {
      lastExecutionRef.current = now;
      return callback(...args);
    }
  }, [callback, intervalMs, ...deps]);

  const [safeThrottledCallback] = useSafeCallback(throttledHandler, deps, {
    ...options,
    callbackId: options.callbackId || 'throttled-callback'
  });

  return safeThrottledCallback;
}

/**
 * Hook for monitoring callback performance across a component
 */
export function useCallbackMonitor() {
  const callbacksRef = useRef<Map<string, CallbackExecutionStats>>(new Map());
  
  const registerCallback = useCallback((callbackId: string, stats: CallbackExecutionStats) => {
    callbacksRef.current.set(callbackId, stats);
  }, []);
  
  const getStats = useCallback(() => {
    return Array.from(callbacksRef.current.entries()).map(([id, stats]) => ({
      callbackId: id,
      ...stats
    }));
  }, []);
  
  const getTotalExecutions = useCallback(() => {
    return Array.from(callbacksRef.current.values())
      .reduce((total, stats) => total + stats.executionCount, 0);
  }, []);
  
  const getTotalCreations = useCallback(() => {
    return Array.from(callbacksRef.current.values())
      .reduce((total, stats) => total + stats.totalCreations, 0);
  }, []);
  
  return {
    registerCallback,
    getStats,
    getTotalExecutions,
    getTotalCreations,
    callbackCount: callbacksRef.current.size
  };
}

/**
 * Development helper for tracking callback dependency changes
 */
export function useCallbackDependencyTracker<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  dependencyNames: string[] = []
): T {
  const oldDepsRef = useRef<React.DependencyList>(deps);
  
  if (process.env.NODE_ENV === 'development') {
    const changedDeps: string[] = [];
    
    deps.forEach((dep, i) => {
      if (!Object.is(dep, oldDepsRef.current[i])) {
        const depName = dependencyNames[i] || `dep[${i}]`;
        changedDeps.push(depName);
      }
    });

    if (changedDeps.length > 0) {
      console.log('🔍 Callback dependencies changed:', changedDeps);
    }
    
    oldDepsRef.current = deps;
  }

  const [trackedCallback] = useSafeCallback(callback, deps, {
    callbackId: 'tracked-callback',
    enableWarnings: true
  });

  return trackedCallback;
}