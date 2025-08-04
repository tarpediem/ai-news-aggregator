/**
 * Safe Store Hooks - Protected Zustand subscriptions with loop prevention
 * 
 * Features:
 * - Automatic subscription cleanup
 * - Rate limiting and debouncing
 * - Error boundaries for store operations
 * - Performance monitoring
 * - Selective re-rendering optimization
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { StoreApi, UseBoundStore } from 'zustand';
import { StoreCircuitBreaker } from '../utils/storeCircuitBreaker';

export interface SafeStoreOptions {
  debounceMs?: number;
  maxUpdatesPerSecond?: number;
  enableErrorBoundary?: boolean;
  subscriptionId?: string;
  equalityFn?: (a: any, b: any) => boolean;
}

export interface SafeStoreHookResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  stats: {
    subscriptionCount: number;
    lastUpdate: number;
    errorCount: number;
  };
}

/**
 * Safe store subscription hook with built-in loop prevention
 */
export function useSafeStore<T, U>(
  store: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => U,
  circuitBreaker: StoreCircuitBreaker<T>,
  options: SafeStoreOptions = {}
): SafeStoreHookResult<U> {
  const {
    debounceMs = 0,
    maxUpdatesPerSecond = 30,
    enableErrorBoundary = true,
    subscriptionId = 'unknown',
    equalityFn = Object.is
  } = options;

  const [data, setData] = useState<U>(() => {
    try {
      return selector(store.getState());
    } catch (error) {
      console.error(`Error in initial selector for ${subscriptionId}:`, error);
      throw error;
    }
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState({
    subscriptionCount: 0,
    lastUpdate: Date.now(),
    errorCount: 0
  });

  // Refs for tracking and cleanup
  const lastValueRef = useRef<U>(data);
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);
  const selectorRef = useRef(selector);
  const rateLimitRef = useRef<number[]>([]);

  // Update selector ref when it changes
  useEffect(() => {
    selectorRef.current = selector;
  }, [selector]);

  // Rate limiting function
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    rateLimitRef.current = rateLimitRef.current.filter(time => now - time < 1000);
    
    if (rateLimitRef.current.length >= maxUpdatesPerSecond) {
      console.warn(`🚫 Rate limit exceeded for ${subscriptionId}`);
      return false;
    }
    
    rateLimitRef.current.push(now);
    return true;
  }, [maxUpdatesPerSecond, subscriptionId]);

  // Safe update function with debouncing and rate limiting
  const safeUpdate = useCallback((newValue: U) => {
    if (!mountedRef.current) return;

    // Check rate limit
    if (!checkRateLimit()) {
      return;
    }

    // Debounce if configured
    if (debounceMs > 0) {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && !equalityFn(lastValueRef.current, newValue)) {
          setData(newValue);
          lastValueRef.current = newValue;
          updateCountRef.current++;
          lastUpdateTimeRef.current = Date.now();
          
          setStats(prev => ({
            ...prev,
            subscriptionCount: updateCountRef.current,
            lastUpdate: Date.now()
          }));
        }
      }, debounceMs);
    } else {
      // Immediate update with equality check
      if (!equalityFn(lastValueRef.current, newValue)) {
        setData(newValue);
        lastValueRef.current = newValue;
        updateCountRef.current++;
        lastUpdateTimeRef.current = Date.now();
        
        setStats(prev => ({
          ...prev,
          subscriptionCount: updateCountRef.current,
          lastUpdate: Date.now()
        }));
      }
    }
  }, [debounceMs, equalityFn, checkRateLimit]);

  // Error handling function
  const handleError = useCallback((err: Error) => {
    if (!mountedRef.current) return;
    
    console.error(`Store subscription error in ${subscriptionId}:`, err);
    
    if (enableErrorBoundary) {
      setError(err);
      setStats(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }));
    } else {
      throw err;
    }
  }, [subscriptionId, enableErrorBoundary]);

  // Retry function
  const retry = useCallback(() => {
    try {
      setError(null);
      setIsLoading(true);
      
      const currentState = store.getState();
      const newValue = selectorRef.current(currentState);
      safeUpdate(newValue);
      
    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [store, safeUpdate, handleError]);

  // Main subscription effect
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    try {
      // Create safe subscription through circuit breaker
      unsubscribe = circuitBreaker.createSafeSubscription(
        store,
        selectorRef.current,
        (newValue, previousValue) => {
          try {
            safeUpdate(newValue);
          } catch (err) {
            handleError(err as Error);
          }
        },
        subscriptionId
      );
      
      console.log(`🔗 Safe subscription created: ${subscriptionId}`);
      
    } catch (err) {
      handleError(err as Error);
    }

    // Cleanup function
    return () => {
      mountedRef.current = false;
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      if (unsubscribe) {
        try {
          unsubscribe();
          console.log(`🧹 Safe subscription cleaned up: ${subscriptionId}`);
        } catch (err) {
          console.error(`Error cleaning up subscription ${subscriptionId}:`, err);
        }
      }
    };
  }, [store, circuitBreaker, subscriptionId, safeUpdate, handleError]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    retry,
    stats
  };
}

/**
 * Safe store mutation hook with automatic error handling
 */
export function useSafeStoreMutation<T, Args extends any[]>(
  store: UseBoundStore<StoreApi<T>>,
  mutationFn: (state: T, ...args: Args) => Partial<T> | void,
  circuitBreaker: StoreCircuitBreaker<T>,
  options: { mutationId?: string } = {}
): {
  mutate: (...args: Args) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
} {
  const { mutationId = 'unknown-mutation' } = options;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const mutate = useCallback(async (...args: Args) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const currentState = store.getState();
      
      // Check circuit breaker before mutation
      if (!circuitBreaker.shouldAllowUpdate(currentState, mutationId)) {
        throw new Error(`Mutation blocked by circuit breaker: ${mutationId}`);
      }
      
      const result = mutationFn(currentState, ...args);
      
      if (result) {
        // Apply the update through the store's setState
        (store as any).setState(result);
      }
      
    } catch (err) {
      const error = err as Error;
      console.error(`Mutation error in ${mutationId}:`, error);
      setError(error);
      throw error;
      
    } finally {
      setIsLoading(false);
    }
  }, [store, mutationFn, circuitBreaker, mutationId]);
  
  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);
  
  return {
    mutate,
    isLoading,
    error,
    reset
  };
}

/**
 * Optimized selector hook that prevents unnecessary re-renders
 */
export function useSafeSelector<T, U>(
  store: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => U,
  circuitBreaker: StoreCircuitBreaker<T>,
  deps: React.DependencyList = []
): U {
  // Memoize the selector to prevent recreating on every render
  const memoizedSelector = useMemo(() => selector, deps);
  
  // Use the safe store hook with minimal options for maximum performance
  const { data } = useSafeStore(
    store,
    memoizedSelector,
    circuitBreaker,
    {
      subscriptionId: `selector-${Math.random().toString(36).substr(2, 9)}`,
      debounceMs: 0, // No debounce for selectors
      maxUpdatesPerSecond: 60, // Higher limit for selectors
      enableErrorBoundary: false // Let errors bubble up
    }
  );
  
  return data;
}

/**
 * Batch multiple store operations to prevent cascading updates
 */
export function useSafeBatchOperations<T>(
  store: UseBoundStore<StoreApi<T>>,
  circuitBreaker: StoreCircuitBreaker<T>
): (operations: Array<(state: T) => Partial<T>>) => Promise<void> {
  return useCallback(async (operations: Array<(state: T) => Partial<T>>) => {
    const currentState = store.getState();
    
    // Check circuit breaker
    if (!circuitBreaker.shouldAllowUpdate(currentState, 'batch-operations')) {
      throw new Error('Batch operations blocked by circuit breaker');
    }
    
    try {
      // Apply all operations to a single state object
      let newState = { ...currentState };
      
      for (const operation of operations) {
        const partial = operation(newState);
        if (partial) {
          newState = { ...newState, ...partial };
        }
      }
      
      // Single state update
      (store as any).setState(newState);
      
    } catch (error) {
      console.error('Batch operations error:', error);
      throw error;
    }
  }, [store, circuitBreaker]);
}

/**
 * Hook for monitoring store performance and circuit breaker stats
 */
export function useStoreMonitoring<T>(
  circuitBreaker: StoreCircuitBreaker<T>
): {
  stats: any;
  isHealthy: boolean;
  performanceScore: number;
  reset: () => void;
} {
  const [stats, setStats] = useState(circuitBreaker.getDetailedStats());
  
  useEffect(() => {
    const unsubscribe = circuitBreaker.onStatsUpdate((newStats) => {
      setStats(circuitBreaker.getDetailedStats());
    });
    
    return unsubscribe;
  }, [circuitBreaker]);
  
  const isHealthy = useMemo(() => {
    return !stats.isTripped && stats.performanceScore > 0.7;
  }, [stats]);
  
  const reset = useCallback(() => {
    circuitBreaker.forceReset();
  }, [circuitBreaker]);
  
  return {
    stats,
    isHealthy,
    performanceScore: stats.performanceScore || 1.0,
    reset
  };
}

// Default equality functions for common use cases
export const shallowEqual = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a as any);
  const keysB = Object.keys(b as any);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || 
        !Object.is((a as any)[key], (b as any)[key])) {
      return false;
    }
  }
  
  return true;
};

export const deepEqual = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  const keysA = Object.keys(a as any);
  const keysB = Object.keys(b as any);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || 
        !deepEqual((a as any)[key], (b as any)[key])) {
      return false;
    }
  }
  
  return true;
};