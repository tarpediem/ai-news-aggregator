/**
 * Safe useMemo Hook - Prevents infinite loops from unstable memo dependencies
 * 
 * Features:
 * - Dependency validation and stability checking
 * - Computation tracking and performance monitoring
 * - Memory leak prevention with automatic cleanup
 * - Circuit breaker integration for computation limits
 * - Stale computation detection and recovery
 * - Development warnings for optimization opportunities
 */

import { useMemo, useRef, useCallback } from 'react';
import { ComponentCircuitBreaker } from '../utils/componentCircuitBreaker';

export interface SafeMemoOptions {
  /**
   * Maximum computations per second
   */
  maxComputationsPerSecond?: number;
  
  /**
   * Enable dependency stability validation
   */
  validateDependencies?: boolean;
  
  /**
   * Memo identifier for debugging
   */
  memoId?: string;
  
  /**
   * Enable circuit breaker protection
   */
  enableCircuitBreaker?: boolean;
  
  /**
   * Skip computation if dependencies are unstable
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
   * Maximum computation time before warning (ms)
   */
  maxComputationTimeMs?: number;
  
  /**
   * Cache computation results
   */
  enableCaching?: boolean;
  
  /**
   * Maximum cache size
   */
  maxCacheSize?: number;
}

export interface MemoComputationStats {
  computationCount: number;
  cacheHits: number;
  cacheMisses: number;
  lastComputation: number;
  averageComputationTime: number;
  isBlocked: boolean;
  dependencyChanges: number;
  totalRecreations: number;
  cacheSize: number;
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
 * Create a cache key from dependencies
 */
function createCacheKey(deps: React.DependencyList): string {
  try {
    return JSON.stringify(deps);
  } catch (error) {
    // Fallback for non-serializable deps
    return deps.map((dep, i) => `${i}:${typeof dep}:${String(dep).slice(0, 50)}`).join('|');
  }
}

/**
 * Safe useMemo hook with loop prevention and enhanced validation
 */
export function useSafeMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: SafeMemoOptions = {}
): [T, MemoComputationStats] {
  const {
    maxComputationsPerSecond = 30,
    validateDependencies = true,
    memoId = `memo-${Math.random().toString(36).substr(2, 9)}`,
    enableCircuitBreaker = true,
    skipOnUnstableDeps = true,
    enableWarnings = process.env.NODE_ENV === 'development',
    equalityFn = deepEqual,
    maxComputationTimeMs = 100,
    enableCaching = true,
    maxCacheSize = 10
  } = options;

  // Computation tracking
  const computationHistoryRef = useRef<number[]>([]);
  const computationCountRef = useRef(0);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);
  const lastComputationRef = useRef(0);
  const computationTimesRef = useRef<number[]>([]);
  const dependencyChangesRef = useRef(0);
  const lastDepsRef = useRef<React.DependencyList>(deps);
  const totalRecreationsRef = useRef(0);
  const mountedRef = useRef(true);
  const circuitBreakerRef = useRef<ComponentCircuitBreaker | null>(null);
  
  // Caching
  const cacheRef = useRef<Map<string, { value: T; timestamp: number }>>(new Map());

  // Initialize circuit breaker if enabled
  if (enableCircuitBreaker && !circuitBreakerRef.current) {
    circuitBreakerRef.current = new ComponentCircuitBreaker({
      componentId: memoId,
      maxRerenders: maxComputationsPerSecond,
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
          `🚨 Memo ${memoId} dependencies changed ${dependencyChangesRef.current} times. Check for unstable dependencies.`
        );
      }
    }
    return changed;
  }, [deps, equalityFn, memoId, enableWarnings]);

  // Check for unstable dependencies
  const checkDependencyStability = useMemo(() => {
    if (!validateDependencies) return true;
    
    let hasUnstableDeps = false;
    
    deps.forEach((dep, index) => {
      // Check for inline object/array creation
      if (typeof dep === 'object' && dep !== null && !Array.isArray(dep)) {
        if (enableWarnings) {
          console.warn(
            `🚨 Potentially unstable object dependency at index ${index} in memo ${memoId}:`,
            dep
          );
        }
        hasUnstableDeps = true;
      }
      
      // Check for inline function creation
      if (typeof dep === 'function') {
        if (enableWarnings) {
          console.warn(
            `🚨 Function dependency at index ${index} in memo ${memoId}. Consider using useCallback.`
          );
        }
        hasUnstableDeps = true;
      }
      
      // Check for frequently changing values
      if (typeof dep === 'number' && dep === Date.now()) {
        if (enableWarnings) {
          console.warn(
            `🚨 Timestamp dependency detected in memo ${memoId}. This will cause frequent recomputations.`
          );
        }
        hasUnstableDeps = true;
      }
    });
    
    return !hasUnstableDeps;
  }, [deps, validateDependencies, memoId, enableWarnings]);

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    
    // Clean old computations (keep only last second)
    computationHistoryRef.current = computationHistoryRef.current.filter(
      time => now - time < 1000
    );
    
    if (computationHistoryRef.current.length >= maxComputationsPerSecond) {
      if (enableWarnings) {
        console.warn(
          `🚫 Memo ${memoId} rate limited: ${computationHistoryRef.current.length} computations/second`
        );
      }
      return false;
    }
    
    return true;
  }, [maxComputationsPerSecond, memoId, enableWarnings]);

  // Cache management
  const manageCacheSize = useCallback(() => {
    if (!enableCaching || cacheRef.current.size <= maxCacheSize) return;
    
    // Remove oldest entries
    const entries = Array.from(cacheRef.current.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    const entriesToRemove = entries.slice(0, entries.length - maxCacheSize);
    entriesToRemove.forEach(([key]) => {
      cacheRef.current.delete(key);
    });
    
    if (enableWarnings) {
      console.log(`🧹 Cleaned memo cache for ${memoId}, removed ${entriesToRemove.length} entries`);
    }
  }, [enableCaching, maxCacheSize, memoId, enableWarnings]);

  // Safe computation wrapper
  const safeComputation = useCallback((): T => {
    if (!mountedRef.current) {
      if (enableWarnings) {
        console.warn(`🚨 Memo ${memoId} computed after component unmount`);
      }
      throw new Error(`Memo computation after unmount: ${memoId}`);
    }

    // Check circuit breaker
    if (enableCircuitBreaker && circuitBreakerRef.current) {
      if (!circuitBreakerRef.current.shouldAllow('effect-execution')) {
        if (enableWarnings) {
          console.warn(`🚫 Memo ${memoId} blocked by circuit breaker`);
        }
        throw new Error(`Memo computation blocked by circuit breaker: ${memoId}`);
      }
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error(`Memo computation rate limited: ${memoId}`);
    }

    // Check cache first
    if (enableCaching) {
      const cacheKey = createCacheKey(deps);
      const cached = cacheRef.current.get(cacheKey);
      
      if (cached) {
        cacheHitsRef.current++;
        if (enableWarnings) {
          console.log(`💾 Cache hit for memo ${memoId}`);
        }
        return cached.value;
      }
      
      cacheMissesRef.current++;
    }

    const startTime = performance.now();
    
    try {
      const result = factory();
      
      // Track computation
      const computationTime = performance.now() - startTime;
      const now = Date.now();
      
      computationHistoryRef.current.push(now);
      computationCountRef.current++;
      lastComputationRef.current = now;
      computationTimesRef.current.push(computationTime);
      
      // Keep only recent computation times
      if (computationTimesRef.current.length > 100) {
        computationTimesRef.current = computationTimesRef.current.slice(-50);
      }

      // Cache the result
      if (enableCaching) {
        const cacheKey = createCacheKey(deps);
        cacheRef.current.set(cacheKey, {
          value: result,
          timestamp: now
        });
        manageCacheSize();
      }

      // Record with circuit breaker
      if (enableCircuitBreaker && circuitBreakerRef.current) {
        circuitBreakerRef.current.recordEffectExecution(memoId);
      }

      // Warning for slow computations
      if (enableWarnings && computationTime > maxComputationTimeMs) {
        console.warn(
          `⚠️ Slow memo computation in ${memoId}: ${computationTime.toFixed(2)}ms`
        );
      }

      return result;
      
    } catch (error) {
      console.error(`💥 Memo computation error in ${memoId}:`, error);
      
      // Record error with circuit breaker
      if (enableCircuitBreaker && circuitBreakerRef.current) {
        circuitBreakerRef.current.recordError('memo-computation', error as Error);
      }
      
      throw error;
    }
  }, [
    factory,
    deps,
    memoId,
    enableCircuitBreaker,
    enableWarnings,
    checkRateLimit,
    enableCaching,
    maxComputationTimeMs,
    manageCacheSize
  ]);

  // Create memoized value based on dependency stability
  const memoizedValue = useMemo(() => {
    totalRecreationsRef.current++;
    
    // Skip computation if dependencies are unstable
    if (skipOnUnstableDeps && !checkDependencyStability) {
      if (enableWarnings) {
        console.warn(`⚠️ Skipping memo computation for ${memoId} due to unstable dependencies`);
      }
      
      // Return cached value if available, otherwise compute once with warning
      if (enableCaching && cacheRef.current.size > 0) {
        const lastCached = Array.from(cacheRef.current.values()).pop();
        if (lastCached) {
          return lastCached.value;
        }
      }
      
      // Must compute despite unstable deps
      console.warn(`⚠️ Computing memo ${memoId} despite unstable dependencies (no cached value available)`);
    }

    if (enableWarnings && totalRecreationsRef.current > 50) {
      console.warn(
        `🚨 Memo ${memoId} recreated ${totalRecreationsRef.current} times. Check dependencies.`
      );
    }

    return safeComputation();
  }, [
    safeComputation,
    checkDependencyStability,
    skipOnUnstableDeps,
    memoId,
    enableWarnings,
    enableCaching,
    ...deps
  ]);

  // Cleanup on unmount
  useMemo(() => {
    return () => {
      mountedRef.current = false;
      
      if (cacheRef.current) {
        cacheRef.current.clear();
      }
      
      if (circuitBreakerRef.current) {
        circuitBreakerRef.current.destroy();
      }
    };
  }, []);

  // Calculate computation stats
  const computationStats: MemoComputationStats = useMemo(() => ({
    computationCount: computationCountRef.current,
    cacheHits: cacheHitsRef.current,
    cacheMisses: cacheMissesRef.current,
    lastComputation: lastComputationRef.current,
    averageComputationTime: computationTimesRef.current.length > 0 
      ? computationTimesRef.current.reduce((a, b) => a + b, 0) / computationTimesRef.current.length 
      : 0,
    isBlocked: enableCircuitBreaker 
      ? circuitBreakerRef.current?.isComponentBlocked() ?? false 
      : false,
    dependencyChanges: dependencyChangesRef.current,
    totalRecreations: totalRecreationsRef.current,
    cacheSize: enableCaching ? cacheRef.current.size : 0
  }), [enableCircuitBreaker, enableCaching]);

  return [memoizedValue, computationStats];
}

/**
 * Hook for creating expensive computations with automatic optimization
 */
export function useSafeExpensiveMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: Omit<SafeMemoOptions, 'maxComputationTimeMs'> = {}
): T {
  const [value] = useSafeMemo(factory, deps, {
    ...options,
    maxComputationTimeMs: 500, // Higher threshold for expensive computations
    memoId: options.memoId || 'expensive-memo',
    enableCaching: true,
    maxCacheSize: 5 // Smaller cache for expensive computations
  });

  return value;
}

/**
 * Hook for creating lightweight memos with strict performance requirements
 */
export function useSafeLightweightMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: Omit<SafeMemoOptions, 'maxComputationTimeMs' | 'enableCaching'> = {}
): T {
  const [value] = useSafeMemo(factory, deps, {
    ...options,
    maxComputationTimeMs: 5, // Very strict threshold
    memoId: options.memoId || 'lightweight-memo',
    enableCaching: false, // No caching for lightweight computations
    maxComputationsPerSecond: 60 // Higher rate limit
  });

  return value;
}

/**
 * Hook for monitoring memo performance across a component
 */
export function useMemoMonitor() {
  const memosRef = useRef<Map<string, MemoComputationStats>>(new Map());
  
  const registerMemo = useCallback((memoId: string, stats: MemoComputationStats) => {
    memosRef.current.set(memoId, stats);
  }, []);
  
  const getStats = useCallback(() => {
    return Array.from(memosRef.current.entries()).map(([id, stats]) => ({
      memoId: id,
      ...stats
    }));
  }, []);
  
  const getTotalComputations = useCallback(() => {
    return Array.from(memosRef.current.values())
      .reduce((total, stats) => total + stats.computationCount, 0);
  }, []);
  
  const getTotalCacheHits = useCallback(() => {
    return Array.from(memosRef.current.values())
      .reduce((total, stats) => total + stats.cacheHits, 0);
  }, []);
  
  const getCacheEfficiency = useCallback(() => {
    const totalHits = getTotalCacheHits();
    const totalComputations = getTotalComputations();
    return totalComputations > 0 ? totalHits / totalComputations : 0;
  }, [getTotalCacheHits, getTotalComputations]);
  
  return {
    registerMemo,
    getStats,
    getTotalComputations,
    getTotalCacheHits,
    getCacheEfficiency,
    memoCount: memosRef.current.size
  };
}

/**
 * Development helper for tracking memo dependency changes
 */
export function useMemoDependencyTracker<T>(
  factory: () => T,
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
      console.log('🔍 Memo dependencies changed:', changedDeps);
    }
    
    oldDepsRef.current = deps;
  }

  const [trackedValue] = useSafeMemo(factory, deps, {
    memoId: 'tracked-memo',
    enableWarnings: true
  });

  return trackedValue;
}

/**
 * Hook for creating memos with automatic dependency stabilization
 */
export function useStabilizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  stabilizationWindow = 100
): T {
  const stableDepsRef = useRef<{ deps: React.DependencyList; timestamp: number } | null>(null);
  
  const stabilizedDeps = useMemo(() => {
    const now = Date.now();
    
    // If we have stable deps and they haven't expired
    if (stableDepsRef.current && 
        now - stableDepsRef.current.timestamp < stabilizationWindow) {
      
      // Check if current deps are deeply equal to stable deps
      let areEqual = true;
      if (deps.length !== stableDepsRef.current.deps.length) {
        areEqual = false;
      } else {
        for (let i = 0; i < deps.length; i++) {
          if (!Object.is(deps[i], stableDepsRef.current.deps[i])) {
            areEqual = false;
            break;
          }
        }
      }
      
      if (areEqual) {
        return stableDepsRef.current.deps;
      }
    }
    
    // Update stable deps
    stableDepsRef.current = {
      deps: [...deps],
      timestamp: now
    };
    
    return stableDepsRef.current.deps;
  }, deps);

  const [stabilizedValue] = useSafeMemo(factory, stabilizedDeps, {
    memoId: 'stabilized-memo',
    enableWarnings: true
  });

  return stabilizedValue;
}