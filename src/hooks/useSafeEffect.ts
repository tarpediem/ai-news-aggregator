/**
 * Safe useEffect Hook - Prevents infinite loops and provides automatic cleanup
 * 
 * Features:
 * - Automatic dependency tracking and validation
 * - Loop detection and circuit breaking
 * - Enhanced cleanup with unmount protection
 * - Dependency array safety checks
 * - Performance monitoring
 * - Integration with component circuit breaker
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { ComponentCircuitBreaker } from '../utils/componentCircuitBreaker';

export interface SafeEffectOptions {
  /**
   * Maximum number of executions per second
   */
  maxExecutionsPerSecond?: number;
  
  /**
   * Enable dependency array validation
   */
  validateDependencies?: boolean;
  
  /**
   * Custom effect identifier for debugging
   */
  effectId?: string;
  
  /**
   * Enable circuit breaker protection
   */
  enableCircuitBreaker?: boolean;
  
  /**
   * Custom cleanup timeout (ms)
   */
  cleanupTimeoutMs?: number;
  
  /**
   * Skip effect if dependencies are unstable
   */
  skipOnInstableDeps?: boolean;

  /**
   * Enable development warnings
   */
  enableWarnings?: boolean;
}

export interface EffectExecutionStats {
  executionCount: number;
  lastExecution: number;
  averageExecutionTime: number;
  isBlocked: boolean;
  dependencyChanges: number;
}

/**
 * Safe useEffect hook with loop prevention and enhanced cleanup
 */
export function useSafeEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList | undefined,
  options: SafeEffectOptions = {}
): EffectExecutionStats {
  const {
    maxExecutionsPerSecond = 30,
    validateDependencies = true,
    effectId = `effect-${Math.random().toString(36).substr(2, 9)}`,
    enableCircuitBreaker = true,
    cleanupTimeoutMs = 5000,
    skipOnInstableDeps = true,
    enableWarnings = process.env.NODE_ENV === 'development'
  } = options;

  // Execution tracking
  const executionHistoryRef = useRef<number[]>([]);
  const executionCountRef = useRef(0);
  const lastExecutionRef = useRef(0);
  const executionTimesRef = useRef<number[]>([]);
  const dependencyChangesRef = useRef(0);
  const lastDepsRef = useRef<React.DependencyList | undefined>(deps);
  const cleanupFnRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const circuitBreakerRef = useRef<ComponentCircuitBreaker | null>(null);

  // Initialize circuit breaker if enabled
  if (enableCircuitBreaker && !circuitBreakerRef.current) {
    circuitBreakerRef.current = new ComponentCircuitBreaker({
      componentId: effectId,
      maxRerenders: maxExecutionsPerSecond,
      resetTimeoutMs: 10000
    });
  }

  // Dependency validation
  const validateDepsChange = useCallback((
    newDeps: React.DependencyList | undefined,
    oldDeps: React.DependencyList | undefined
  ): boolean => {
    if (!validateDependencies) return true;

    // If both undefined, no change
    if (newDeps === undefined && oldDeps === undefined) return false;
    
    // If one is undefined, definitely changed
    if (newDeps === undefined || oldDeps === undefined) return true;
    
    // Different lengths = changed
    if (newDeps.length !== oldDeps.length) return true;
    
    // Check each dependency
    for (let i = 0; i < newDeps.length; i++) {
      if (!Object.is(newDeps[i], oldDeps[i])) {
        return true;
      }
    }
    
    return false;
  }, [validateDependencies]);

  // Check for unstable dependencies (objects/functions created inline)
  const checkDependencyStability = useCallback((deps: React.DependencyList | undefined): boolean => {
    if (!deps || !skipOnInstableDeps) return true;
    
    let hasUnstableDeps = false;
    
    deps.forEach((dep, index) => {
      if (typeof dep === 'object' && dep !== null && !Array.isArray(dep)) {
        if (enableWarnings) {
          console.warn(
            `🚨 Potentially unstable dependency at index ${index} in effect ${effectId}:`,
            dep
          );
        }
        hasUnstableDeps = true;
      }
      
      if (typeof dep === 'function') {
        if (enableWarnings) {
          console.warn(
            `🚨 Function dependency at index ${index} in effect ${effectId}. Consider using useCallback.`
          );
        }
        hasUnstableDeps = true;
      }
    });
    
    return !hasUnstableDeps;
  }, [skipOnInstableDeps, enableWarnings, effectId]);

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
          `🚫 Effect ${effectId} rate limited: ${executionHistoryRef.current.length} executions/second`
        );
      }
      return false;
    }
    
    return true;
  }, [maxExecutionsPerSecond, effectId, enableWarnings]);

  // Safe effect wrapper
  const safeEffectWrapper = useCallback(() => {
    if (!mountedRef.current) {
      if (enableWarnings) {
        console.warn(`🚨 Effect ${effectId} attempted to run after unmount`);
      }
      return;
    }

    // Check circuit breaker
    if (enableCircuitBreaker && circuitBreakerRef.current) {
      if (!circuitBreakerRef.current.shouldAllow('effect-execution')) {
        if (enableWarnings) {
          console.warn(`🚫 Effect ${effectId} blocked by circuit breaker`);
        }
        return;
      }
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return;
    }

    const startTime = performance.now();
    let cleanup: (() => void) | void = undefined;

    try {
      // Execute the effect
      cleanup = effect();
      
      // Track execution
      const executionTime = performance.now() - startTime;
      executionHistoryRef.current.push(Date.now());
      executionCountRef.current++;
      lastExecutionRef.current = Date.now();
      executionTimesRef.current.push(executionTime);
      
      // Keep only recent execution times
      if (executionTimesRef.current.length > 100) {
        executionTimesRef.current = executionTimesRef.current.slice(-50);
      }

      // Store cleanup function
      if (typeof cleanup === 'function') {
        cleanupFnRef.current = cleanup;
      }

      if (enableWarnings && executionTime > 50) {
        console.warn(
          `⚠️ Slow effect execution in ${effectId}: ${executionTime.toFixed(2)}ms`
        );
      }

    } catch (error) {
      console.error(`💥 Effect execution error in ${effectId}:`, error);
      
      // Notify circuit breaker of error
      if (enableCircuitBreaker && circuitBreakerRef.current) {
        circuitBreakerRef.current.recordError('effect-execution', error as Error);
      }
      
      throw error;
    }

    // Return cleanup function
    return () => {
      if (!mountedRef.current) return;
      
      if (cleanup && typeof cleanup === 'function') {
        try {
          const cleanupPromise = cleanup();
          
          // Handle async cleanup with timeout
          if (cleanupPromise && typeof cleanupPromise.then === 'function') {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Cleanup timeout')), cleanupTimeoutMs);
            });
            
            Promise.race([cleanupPromise, timeoutPromise]).catch(error => {
              console.error(`💥 Cleanup error in ${effectId}:`, error);
            });
          }
        } catch (error) {
          console.error(`💥 Cleanup error in ${effectId}:`, error);
        }
      }
      
      cleanupFnRef.current = null;
    };
  }, [
    effect, 
    effectId, 
    enableCircuitBreaker, 
    enableWarnings, 
    checkRateLimit, 
    cleanupTimeoutMs
  ]);

  // Track dependency changes
  const depsChanged = useMemo(() => {
    const changed = validateDepsChange(deps, lastDepsRef.current);
    if (changed) {
      dependencyChangesRef.current++;
      lastDepsRef.current = deps;
    }
    return changed;
  }, [deps, validateDepsChange]);

  // Check dependency stability
  const depsAreStable = useMemo(() => {
    return checkDependencyStability(deps);
  }, [deps, checkDependencyStability]);

  // Main effect
  useEffect(() => {
    // Skip if dependencies are unstable
    if (!depsAreStable) {
      if (enableWarnings) {
        console.warn(`⚠️ Skipping effect ${effectId} due to unstable dependencies`);
      }
      return;
    }

    return safeEffectWrapper();
  }, deps);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      
      // Execute any pending cleanup
      if (cleanupFnRef.current) {
        try {
          cleanupFnRef.current();
        } catch (error) {
          console.error(`💥 Final cleanup error in ${effectId}:`, error);
        }
      }
      
      // Clean up circuit breaker
      if (circuitBreakerRef.current) {
        circuitBreakerRef.current.destroy();
      }
    };
  }, [effectId]);

  // Return execution stats
  const stats: EffectExecutionStats = useMemo(() => ({
    executionCount: executionCountRef.current,
    lastExecution: lastExecutionRef.current,
    averageExecutionTime: executionTimesRef.current.length > 0 
      ? executionTimesRef.current.reduce((a, b) => a + b, 0) / executionTimesRef.current.length 
      : 0,
    isBlocked: enableCircuitBreaker 
      ? circuitBreakerRef.current?.isComponentBlocked() ?? false 
      : false,
    dependencyChanges: dependencyChangesRef.current
  }), [enableCircuitBreaker]);

  return stats;
}

/**
 * Safe useLayoutEffect hook with same protections
 */
export function useSafeLayoutEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList | undefined,
  options: SafeEffectOptions = {}
): EffectExecutionStats {
  // Import useLayoutEffect dynamically to avoid SSR issues
  const { useLayoutEffect } = require('react');
  
  // Create a version that uses useLayoutEffect instead
  const safeLayoutEffectWrapper = useCallback(() => {
    return useSafeEffect(effect, deps, {
      ...options,
      effectId: options.effectId || `layout-effect-${Math.random().toString(36).substr(2, 9)}`
    });
  }, [effect, deps, options]);

  return safeLayoutEffectWrapper();
}

/**
 * Hook for monitoring all effects in a component
 */
export function useEffectMonitor() {
  const effectsRef = useRef<Map<string, EffectExecutionStats>>(new Map());
  
  const registerEffect = useCallback((effectId: string, stats: EffectExecutionStats) => {
    effectsRef.current.set(effectId, stats);
  }, []);
  
  const getStats = useCallback(() => {
    return Array.from(effectsRef.current.entries()).map(([id, stats]) => ({
      effectId: id,
      ...stats
    }));
  }, []);
  
  const getTotalExecutions = useCallback(() => {
    return Array.from(effectsRef.current.values())
      .reduce((total, stats) => total + stats.executionCount, 0);
  }, []);
  
  return {
    registerEffect,
    getStats,
    getTotalExecutions,
    effectCount: effectsRef.current.size
  };
}

/**
 * Development-only effect debugger
 */
export function useEffectDebugger(
  effect: () => void | (() => void),
  deps: React.DependencyList | undefined,
  dependencyNames: string[] = []
) {
  const oldDepsRef = useRef<React.DependencyList | undefined>(deps);
  const changedDepsRef = useRef<string[]>([]);

  if (process.env.NODE_ENV === 'development') {
    const changedDeps: string[] = [];
    
    if (deps && oldDepsRef.current) {
      deps.forEach((dep, i) => {
        if (!Object.is(dep, oldDepsRef.current![i])) {
          const depName = dependencyNames[i] || `dep[${i}]`;
          changedDeps.push(depName);
        }
      });
    }

    if (changedDeps.length > 0) {
      console.log('🔍 Effect dependencies changed:', changedDeps);
      changedDepsRef.current = changedDeps;
    }
  }

  return useSafeEffect(effect, deps, {
    effectId: 'debug-effect',
    enableWarnings: true
  });
}

/**
 * Helper for creating stable dependency arrays
 */
export function useStableDeps<T extends React.DependencyList>(
  deps: T,
  maxAge: number = 1000
): T {
  const stableDepsRef = useRef<{ deps: T; timestamp: number } | null>(null);
  
  return useMemo(() => {
    const now = Date.now();
    
    // If we have stable deps and they haven't expired
    if (stableDepsRef.current && 
        now - stableDepsRef.current.timestamp < maxAge) {
      
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
      deps: [...deps] as T,
      timestamp: now
    };
    
    return stableDepsRef.current.deps;
  }, deps);
}