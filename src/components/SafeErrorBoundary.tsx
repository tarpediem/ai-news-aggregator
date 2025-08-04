/**
 * Safe Error Boundary - Enhanced error boundary with loop detection and recovery
 * Specifically designed to handle component-level infinite loops and render cycles
 * 
 * Features:
 * - Component loop detection and prevention
 * - Render cycle monitoring and circuit breaking
 * - Automatic recovery mechanisms
 * - Performance impact analysis
 * - Development diagnostics and warnings
 * - Integration with component circuit breaker system
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { ComponentCircuitBreaker, createComponentCircuitBreaker } from '../utils/componentCircuitBreaker';
import { errorHandler } from '../utils/errorHandler';

export interface SafeErrorBoundaryProps {
  children: ReactNode;
  componentId?: string;
  maxRenderErrors?: number;
  maxRenderTime?: number;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void, stats?: any) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, componentStats?: any) => void;
  onRecovery?: (componentStats?: any) => void;
  enableCircuitBreaker?: boolean;
  enableDiagnostics?: boolean;
  autoRecovery?: boolean;
  recoveryDelayMs?: number;
  level?: 'page' | 'component' | 'feature';
}

interface SafeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  renderErrorCount: number;
  isRecovering: boolean;
  recoveryTimeout: number | null;
  suspiciousActivity: {
    rapidRenders: boolean;
    memoryLeak: boolean;
    infiniteLoop: boolean;
  };
}

interface ErrorDisplayProps {
  error: Error;
  errorInfo: ErrorInfo;
  componentId: string;
  onRetry: () => void;
  onForceRecovery: () => void;
  retryCount: number;
  maxRetries: number;
  level: string;
  componentStats?: any;
  suspiciousActivity: {
    rapidRenders: boolean;
    memoryLeak: boolean;
    infiniteLoop: boolean;
  };
}

/**
 * Enhanced error display with component diagnostics
 */
const SafeErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  componentId,
  onRetry,
  onForceRecovery,
  retryCount,
  maxRetries,
  level,
  componentStats,
  suspiciousActivity
}) => {
  const canRetry = retryCount < maxRetries;
  const errorType = errorHandler.classifyError(error);
  const hasLoopSuspicion = suspiciousActivity.rapidRenders || 
                         suspiciousActivity.infiniteLoop;

  return (
    <div className="safe-error-boundary-container p-6 border-2 border-red-400 rounded-lg bg-gradient-to-br from-red-50 to-orange-50 text-red-900 shadow-lg">
      <div className="flex items-center space-x-3 mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h2 className="text-xl font-bold">Component Protection Activated</h2>
          <div className="flex items-center space-x-2 text-sm">
            <span className="bg-red-200 px-2 py-1 rounded font-mono">{componentId}</span>
            <span className="bg-orange-200 px-2 py-1 rounded">{level}</span>
            {hasLoopSuspicion && (
              <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded font-semibold animate-pulse">
                ⚡ Loop Detected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Suspicious Activity Warning */}
      {hasLoopSuspicion && (
        <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 rounded">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Performance Issue Detected</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {suspiciousActivity.rapidRenders && (
              <li>• Rapid component re-renders detected</li>
            )}
            {suspiciousActivity.infiniteLoop && (
              <li>• Potential infinite render loop identified</li>
            )}
            {suspiciousActivity.memoryLeak && (
              <li>• Memory usage increasing abnormally</li>
            )}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <h3 className="font-semibold mb-1">Error Type:</h3>
            <p className="text-sm font-mono bg-red-100 p-2 rounded border">{errorType.type}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Component:</h3>
            <p className="text-sm font-mono bg-red-100 p-2 rounded border">{componentId}</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-1">Error Message:</h3>
          <p className="text-sm font-mono bg-red-100 p-2 rounded border break-words">{errorType.message}</p>
        </div>

        {errorType.userMessage && (
          <div className="bg-blue-50 border border-blue-300 p-3 rounded">
            <h3 className="font-semibold text-blue-800 mb-1">💡 What you can do:</h3>
            <p className="text-sm text-blue-700">{errorType.userMessage}</p>
          </div>
        )}

        {/* Component Statistics */}
        {componentStats && (
          <details className="bg-gray-50 border border-gray-300 rounded">
            <summary className="cursor-pointer font-semibold p-3 hover:bg-gray-100">
              📊 Component Statistics
            </summary>
            <div className="p-3 text-xs font-mono space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Render Count:</strong> {componentStats.renderCount}
                </div>
                <div>
                  <strong>Avg Render Time:</strong> {componentStats.averageRenderTime?.toFixed(2)}ms
                </div>
                <div>
                  <strong>State Updates:</strong> {componentStats.stateUpdateCount}
                </div>
                <div>
                  <strong>Error Count:</strong> {componentStats.errorCount}
                </div>
              </div>
              <div>
                <strong>Performance Score:</strong> 
                <span className={`ml-2 px-2 py-1 rounded ${
                  componentStats.performance?.score > 0.8 ? 'bg-green-200' :
                  componentStats.performance?.score > 0.5 ? 'bg-yellow-200' : 'bg-red-200'
                }`}>
                  {(componentStats.performance?.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </details>
        )}

        {/* Development Details */}
        {process.env.NODE_ENV === 'development' && (
          <details className="bg-gray-50 border border-gray-300 rounded">
            <summary className="cursor-pointer font-semibold p-3 hover:bg-gray-100">
              🔧 Technical Details (Development)
            </summary>
            <div className="p-3 text-xs font-mono bg-gray-100 rounded overflow-auto max-h-60">
              <div className="mb-3">
                <strong>Stack Trace:</strong>
                <pre className="whitespace-pre-wrap mt-1 text-xs">{error.stack}</pre>
              </div>
              <div className="mb-3">
                <strong>Component Stack:</strong>
                <pre className="whitespace-pre-wrap mt-1 text-xs">{errorInfo.componentStack}</pre>
              </div>
              {componentStats && (
                <div>
                  <strong>Full Component Stats:</strong>
                  <pre className="whitespace-pre-wrap mt-1 text-xs">
                    {JSON.stringify(componentStats, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-red-200">
          {canRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-sm"
            >
              🔄 Retry ({retryCount + 1}/{maxRetries})
            </button>
          )}
          
          <button
            onClick={onForceRecovery}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold shadow-sm"
          >
            ⚡ Force Recovery
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-sm"
          >
            🔄 Reload Page
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-semibold"
          >
            ← Go Back
          </button>
        </div>

        {!canRetry && (
          <div className="text-sm text-red-700 bg-red-100 p-3 rounded border-l-4 border-red-500">
            <strong>Maximum retry attempts reached.</strong> This component may have a persistent issue.
            Consider using Force Recovery or refreshing the page.
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Safe Error Boundary with component loop detection and recovery
 */
export class SafeErrorBoundary extends Component<SafeErrorBoundaryProps, SafeErrorBoundaryState> {
  private circuitBreaker: ComponentCircuitBreaker | null = null;
  private renderStartTime = 0;
  private renderCount = 0;
  private lastRenderTimes: number[] = [];
  private recoveryTimeoutId: number | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor(props: SafeErrorBoundaryProps) {
    super(props);
    
    const componentId = props.componentId || `safe-boundary-${Math.random().toString(36).substr(2, 9)}`;
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      renderErrorCount: 0,
      isRecovering: false,
      recoveryTimeout: null,
      suspiciousActivity: {
        rapidRenders: false,
        memoryLeak: false,
        infiniteLoop: false
      }
    };

    // Initialize circuit breaker if enabled
    if (props.enableCircuitBreaker !== false) {
      this.circuitBreaker = createComponentCircuitBreaker({
        componentId,
        maxRerenders: props.maxRenderErrors || 10,
        maxRerendersPerSecond: 5,
        resetTimeoutMs: 10000,
        enableDevTools: props.enableDiagnostics !== false
      });
    }

    this.initializePerformanceMonitoring();
  }

  static getDerivedStateFromError(error: Error): Partial<SafeErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentId = 'unknown' } = this.props;
    
    // Record error with circuit breaker
    if (this.circuitBreaker) {
      this.circuitBreaker.recordError('component-error', error);
    }

    // Enhanced error logging
    errorHandler.logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'SafeErrorBoundary',
      componentId,
      retryCount: this.state.retryCount,
      renderCount: this.renderCount,
      level: this.props.level || 'component',
      circuitBreakerStats: this.circuitBreaker?.getStats(),
      suspiciousActivity: this.state.suspiciousActivity
    });

    // Update state with error info and suspicious activity detection
    this.setState({ 
      errorInfo,
      suspiciousActivity: this.detectSuspiciousActivity()
    });

    // Call custom error handler
    onError?.(error, errorInfo, this.circuitBreaker?.getStats());

    // Report to external services in production
    if (process.env.NODE_ENV === 'production') {
      this.reportToExternalService(error, errorInfo);
    }

    // Auto-recovery if enabled
    if (this.props.autoRecovery && this.state.retryCount < (this.props.maxRenderErrors || 3)) {
      this.scheduleAutoRecovery();
    }
  }

  override componentDidMount() {
    this.renderStartTime = performance.now();
    
    if (this.circuitBreaker) {
      this.circuitBreaker.startRender(this.props, this.state, 'mount');
    }
  }

  override componentDidUpdate(prevProps: SafeErrorBoundaryProps, prevState: SafeErrorBoundaryState) {
    // Track render performance
    if (this.renderStartTime > 0) {
      const renderTime = performance.now() - this.renderStartTime;
      this.lastRenderTimes.push(renderTime);
      
      // Keep only recent render times
      if (this.lastRenderTimes.length > 20) {
        this.lastRenderTimes = this.lastRenderTimes.slice(-10);
      }
      
      if (this.circuitBreaker) {
        this.circuitBreaker.endRender(true);
      }
    }

    // Reset error state if props changed significantly
    if (this.state.hasError && this.hasSignificantPropsChange(prevProps)) {
      this.resetErrorBoundary();
    }
  }

  override componentWillUnmount() {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.circuitBreaker) {
      this.circuitBreaker.destroy();
    }
  }

  override render() {
    this.renderCount++;
    this.renderStartTime = performance.now();
    
    if (this.circuitBreaker) {
      this.circuitBreaker.startRender(this.props, this.state, 'render');
    }

    const { hasError, error, errorInfo, retryCount, isRecovering } = this.state;
    const { children, fallback, maxRenderErrors = 3, level = 'component', componentId = 'unknown' } = this.props;

    // Show recovery indicator
    if (isRecovering) {
      return (
        <div className="flex items-center justify-center p-8 bg-blue-50 border border-blue-300 rounded-lg">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-blue-800 font-semibold">Recovering component...</p>
            <p className="text-blue-600 text-sm mt-1">{componentId}</p>
          </div>
        </div>
      );
    }

    if (hasError && error && errorInfo) {
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry, this.circuitBreaker?.getStats());
      }

      return (
        <SafeErrorDisplay
          error={error}
          errorInfo={errorInfo}
          componentId={componentId}
          onRetry={this.handleRetry}
          onForceRecovery={this.handleForceRecovery}
          retryCount={retryCount}
          maxRetries={maxRenderErrors}
          level={level}
          componentStats={this.circuitBreaker?.getStats()}
          suspiciousActivity={this.state.suspiciousActivity}
        />
      );
    }

    return children;
  }

  private initializePerformanceMonitoring() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' && entry.name.includes('React')) {
            // Monitor React performance
            if (entry.duration > 50) {
              console.warn(`Slow React operation detected: ${entry.name} took ${entry.duration}ms`);
            }
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      // Performance Observer not supported
    }
  }

  private detectSuspiciousActivity() {
    const recentRenderTimes = this.lastRenderTimes.slice(-10);
    const avgRenderTime = recentRenderTimes.length > 0 
      ? recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length 
      : 0;

    return {
      rapidRenders: this.renderCount > 50 && avgRenderTime < 1, // Too many fast renders
      memoryLeak: this.estimateMemoryIncrease() > 10 * 1024 * 1024, // 10MB increase
      infiniteLoop: recentRenderTimes.length > 5 && recentRenderTimes.every(time => time < 0.5)
    };
  }

  private estimateMemoryIncrease(): number {
    try {
      if ((performance as any).memory) {
        const current = (performance as any).memory.usedJSHeapSize;
        const baseline = (performance as any).memory.totalJSHeapSize * 0.5; // Rough baseline
        return current - baseline;
      }
    } catch (error) {
      // Memory API not available
    }
    return 0;
  }

  private hasSignificantPropsChange(prevProps: SafeErrorBoundaryProps): boolean {
    // Check for significant prop changes that should reset the error boundary
    return (
      prevProps.componentId !== this.props.componentId ||
      prevProps.children !== this.props.children ||
      prevProps.maxRenderErrors !== this.props.maxRenderErrors
    );
  }

  private reportToExternalService(error: Error, errorInfo: ErrorInfo) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      componentId: this.props.componentId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
      renderCount: this.renderCount,
      level: this.props.level,
      circuitBreakerStats: this.circuitBreaker?.getStats(),
      suspiciousActivity: this.state.suspiciousActivity
    };

    console.error('Enhanced error report for SafeErrorBoundary:', errorReport);
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      renderErrorCount: 0,
      isRecovering: false,
      recoveryTimeout: null,
      suspiciousActivity: {
        rapidRenders: false,
        memoryLeak: false,
        infiniteLoop: false
      }
    });

    // Reset circuit breaker
    if (this.circuitBreaker) {
      this.circuitBreaker.forceReset();
    }

    // Reset tracking
    this.renderCount = 0;
    this.lastRenderTimes = [];

    // Call recovery callback
    this.props.onRecovery?.(this.circuitBreaker?.getStats());
  };

  private handleRetry = () => {
    const { maxRenderErrors = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRenderErrors) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: retryCount + 1,
        suspiciousActivity: {
          rapidRenders: false,
          memoryLeak: false,
          infiniteLoop: false
        }
      });

      // Record retry with circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordEffectExecution('retry');
      }
    }
  };

  private handleForceRecovery = () => {
    console.warn(`Force recovery triggered for component: ${this.props.componentId}`);
    
    this.setState({ isRecovering: true });
    
    // Force a brief delay to break potential loops
    setTimeout(() => {
      this.resetErrorBoundary();
    }, 100);
  };

  private scheduleAutoRecovery() {
    const delayMs = this.props.recoveryDelayMs || 2000;
    
    this.recoveryTimeoutId = window.setTimeout(() => {
      console.log(`Auto-recovery triggered for component: ${this.props.componentId}`);
      this.handleRetry();
    }, delayMs);
  }
}

/**
 * HOC for wrapping components with safe error boundaries
 */
export function withSafeErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps?: Omit<SafeErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <SafeErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </SafeErrorBoundary>
  );

  WrappedComponent.displayName = `withSafeErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for creating safe error boundaries with specific configurations
 */
export function useSafeErrorBoundary(
  boundaryProps?: Omit<SafeErrorBoundaryProps, 'children'>
) {
  const SafeErrorBoundaryComponent = React.useMemo(
    () => ({ children }: { children: ReactNode }) => (
      <SafeErrorBoundary {...boundaryProps}>
        {children}
      </SafeErrorBoundary>
    ),
    [boundaryProps]
  );

  return SafeErrorBoundaryComponent;
}

/**
 * Specialized safe error boundaries for different contexts
 */
export const SafePageErrorBoundary: React.FC<{ children: ReactNode; pageId?: string }> = ({ 
  children, 
  pageId 
}) => (
  <SafeErrorBoundary
    componentId={pageId || 'page'}
    level="page"
    maxRenderErrors={2}
    autoRecovery={false}
    enableCircuitBreaker={true}
    enableDiagnostics={true}
  >
    {children}
  </SafeErrorBoundary>
);

export const SafeComponentErrorBoundary: React.FC<{ 
  children: ReactNode; 
  componentId?: string;
}> = ({ children, componentId }) => (
  <SafeErrorBoundary
    componentId={componentId || 'component'}
    level="component"
    maxRenderErrors={3}
    autoRecovery={true}
    recoveryDelayMs={1000}
    enableCircuitBreaker={true}
    enableDiagnostics={true}
  >
    {children}
  </SafeErrorBoundary>
);

export const SafeFeatureErrorBoundary: React.FC<{ 
  children: ReactNode; 
  feature: string;
}> = ({ children, feature }) => (
  <SafeErrorBoundary
    componentId={`feature-${feature}`}
    level="feature"
    maxRenderErrors={5}
    autoRecovery={true}
    recoveryDelayMs={2000}
    enableCircuitBreaker={true}
    enableDiagnostics={true}
    onError={(error, errorInfo) => {
      console.error(`Feature error in ${feature}:`, error, errorInfo);
    }}
  >
    {children}
  </SafeErrorBoundary>
);

export default SafeErrorBoundary;