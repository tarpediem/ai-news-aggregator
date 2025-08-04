/**
 * Circuit breaker utility to detect and prevent infinite render loops
 * This is an emergency measure to prevent the "Maximum update depth exceeded" error
 */

import React from 'react';

interface CircuitBreakerConfig {
  maxRenders: number;
  timeWindow: number; // milliseconds
  resetTime: number; // milliseconds
}

class RenderCircuitBreaker {
  private renderCounts: Map<string, { count: number; firstRender: number; lastReset: number }> = new Map();
  private config: CircuitBreakerConfig;
  private isTripped = false;

  constructor(config: CircuitBreakerConfig = {
    maxRenders: 50, // Allow max 50 renders per component in time window
    timeWindow: 1000, // 1 second window
    resetTime: 5000, // Reset after 5 seconds of no issues
  }) {
    this.config = config;
  }

  /**
   * Check if a component should be allowed to render
   * @param componentName - Name of the component for tracking
   * @returns true if render is allowed, false if circuit is tripped
   */
  shouldRender(componentName: string): boolean {
    if (this.isTripped) {
      // Check if we should reset the circuit breaker
      const now = Date.now();
      const anyRecent = Array.from(this.renderCounts.values())
        .some(entry => now - entry.lastReset < this.config.resetTime);
      
      if (!anyRecent) {
        console.log(`🔧 Circuit breaker reset for infinite loop protection`);
        this.reset();
        return true;
      }
      return false;
    }

    const now = Date.now();
    const entry = this.renderCounts.get(componentName);

    if (!entry) {
      // First render for this component
      this.renderCounts.set(componentName, {
        count: 1,
        firstRender: now,
        lastReset: now
      });
      return true;
    }

    // Check if we're outside the time window - reset if so
    if (now - entry.firstRender > this.config.timeWindow) {
      this.renderCounts.set(componentName, {
        count: 1,
        firstRender: now,
        lastReset: now
      });
      return true;
    }

    // Increment render count
    entry.count++;
    entry.lastReset = now;

    // Check if we've exceeded the threshold
    if (entry.count > this.config.maxRenders) {
      console.error(`🚨 INFINITE LOOP DETECTED: ${componentName} rendered ${entry.count} times in ${now - entry.firstRender}ms`);
      console.error(`🛑 Circuit breaker tripped to prevent "Maximum update depth exceeded"`);
      console.error(`📊 Render counts:`, Array.from(this.renderCounts.entries()));
      
      this.isTripped = true;
      
      // Show user-friendly error message
      if (typeof window !== 'undefined') {
        const errorDiv = document.getElementById('circuit-breaker-error');
        if (!errorDiv) {
          const div = document.createElement('div');
          div.id = 'circuit-breaker-error';
          div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fee;
            border: 2px solid #f87171;
            color: #dc2626;
            padding: 16px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          `;
          div.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">⚠️ Infinite Loop Detected</div>
            <div style="margin-bottom: 8px;">Component: ${componentName}</div>
            <div style="margin-bottom: 8px;">Renders: ${entry.count}</div>
            <div style="font-size: 12px; opacity: 0.8;">Reloading page in 5 seconds...</div>
          `;
          document.body.appendChild(div);
          
          // Auto-reload after 5 seconds
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        }
      }
      
      return false;
    }

    return true;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.renderCounts.clear();
    this.isTripped = false;
  }

  /**
   * Get current render statistics
   */
  getStats(): Record<string, any> {
    return {
      isTripped: this.isTripped,
      componentCounts: Object.fromEntries(this.renderCounts.entries()),
      config: this.config
    };
  }

  /**
   * Manually trip the circuit breaker (for testing)
   */
  trip(): void {
    this.isTripped = true;
  }
}

// Global circuit breaker instance
export const renderCircuitBreaker = new RenderCircuitBreaker();

/**
 * React hook to use circuit breaker protection
 * @param componentName - Name of the component for tracking
 * @returns true if component should render normally, false if should return null
 */
export function useCircuitBreaker(componentName: string): boolean {
  const shouldRender = renderCircuitBreaker.shouldRender(componentName);
  
  if (!shouldRender) {
    console.warn(`🛑 ${componentName} render blocked by circuit breaker`);
  }
  
  return shouldRender;
}

/**
 * HOC to wrap components with circuit breaker protection
 */
export function withCircuitBreaker<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    const shouldRender = useCircuitBreaker(name);
    
    if (!shouldRender) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-yellow-800">
            ⚠️ Component temporarily disabled due to infinite loop protection
          </div>
          <div className="text-yellow-600 text-sm mt-1">
            This will automatically resolve in a few seconds.
          </div>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
  
  WrappedComponent.displayName = `withCircuitBreaker(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default renderCircuitBreaker;