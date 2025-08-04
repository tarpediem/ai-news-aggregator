/**
 * Advanced Error Boundary with comprehensive error handling and recovery
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { errorHandler } from '../utils/errorHandler';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  resetKeys?: (string | number)[];
  level?: 'page' | 'component' | 'feature';
}

interface ErrorDisplayProps {
  error: Error;
  errorInfo: ErrorInfo;
  onRetry: () => void;
  retryCount: number;
  maxRetries: number;
  level: string;
}

/**
 * Default error display component
 */
const DefaultErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  onRetry,
  retryCount,
  maxRetries,
  level,
}) => {
  const canRetry = retryCount < maxRetries;
  const errorType = errorHandler.classifyError(error);
  
  return (
    <div className="error-boundary-container p-6 border border-red-300 rounded-lg bg-red-50 text-red-800">
      <div className="flex items-center space-x-2 mb-4">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <span className="text-sm bg-red-200 px-2 py-1 rounded">{level}</span>
      </div>
      
      <div className="space-y-3">
        <div>
          <h3 className="font-medium mb-1">Error Type:</h3>
          <p className="text-sm font-mono bg-red-100 p-2 rounded">{errorType.type}</p>
        </div>
        
        <div>
          <h3 className="font-medium mb-1">Message:</h3>
          <p className="text-sm font-mono bg-red-100 p-2 rounded">{errorType.message}</p>
        </div>
        
        {errorType.userMessage && (
          <div>
            <h3 className="font-medium mb-1">What you can do:</h3>
            <p className="text-sm">{errorType.userMessage}</p>
          </div>
        )}
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium mb-2">Technical Details</summary>
            <div className="text-xs font-mono bg-red-100 p-3 rounded overflow-auto max-h-40">
              <div className="mb-2">
                <strong>Stack Trace:</strong>
                <pre className="whitespace-pre-wrap">{error.stack}</pre>
              </div>
              <div>
                <strong>Component Stack:</strong>
                <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
              </div>
            </div>
          </details>
        )}
        
        <div className="flex items-center space-x-3 pt-4">
          {canRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again ({retryCount + 1}/{maxRetries})
            </button>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Reload Page
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50 transition-colors"
          >
            Go Back
          </button>
        </div>
        
        {!canRetry && (
          <div className="text-sm text-red-600 mt-2">
            Maximum retry attempts reached. Please refresh the page or contact support.
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Advanced Error Boundary with retry logic and detailed error reporting
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    
    // Log error to our error handling system
    errorHandler.logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      retryCount: this.state.retryCount,
      level: this.props.level || 'component',
    });

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    onError?.(error, errorInfo);

    // Report to external services in production
    if (process.env.NODE_ENV === 'production') {
      this.reportToExternalService(error, errorInfo);
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && resetOnPropsChange) {
      // Reset on any prop change
      this.resetErrorBoundary();
    } else if (hasError && resetKeys) {
      // Reset on specific key changes
      const hasResetKeyChanged = resetKeys.some(
        (key, idx) => key !== prevProps.resetKeys?.[idx]
      );
      
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private reportToExternalService(error: Error, errorInfo: ErrorInfo) {
    // In a real app, you would send to services like Sentry, LogRocket, etc.
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
      level: this.props.level,
    };

    // Example: Send to error tracking service
    // fetch('/api/errors', {
    //   method: 'POST',
    //   body: JSON.stringify(errorReport),
    //   headers: { 'Content-Type': 'application/json' }
    // });

    console.error('Error reported to external service:', errorReport);
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    });
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: retryCount + 1,
      });

      // Auto-reset after successful retry
      this.resetTimeoutId = window.setTimeout(() => {
        this.setState({ retryCount: 0 });
      }, 30000); // Reset retry count after 30 seconds
    }
  };

  override render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { children, fallback, maxRetries = 3, level = 'component' } = this.props;

    if (hasError && error && errorInfo) {
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry);
      }

      return (
        <DefaultErrorDisplay
          error={error}
          errorInfo={errorInfo}
          onRetry={this.handleRetry}
          retryCount={retryCount}
          maxRetries={maxRetries}
          level={level}
        />
      );
    }

    return children;
  }
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for manually triggering error boundaries
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    // Log the error
    errorHandler.logError(error, errorInfo);
    
    // Throw the error to be caught by the nearest error boundary
    throw error;
  }, []);

  return handleError;
}

/**
 * Hook for creating error boundaries with specific configurations
 */
export function useErrorBoundary(
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const ErrorBoundaryComponent = React.useMemo(
    () => ({ children }: { children: ReactNode }) => (
      <ErrorBoundary {...errorBoundaryProps}>
        {children}
      </ErrorBoundary>
    ),
    [errorBoundaryProps]
  );

  return ErrorBoundaryComponent;
}

/**
 * Specialized error boundaries for different contexts
 */
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="page"
    maxRetries={1}
    fallback={(error, errorInfo, retry) => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full">
          <DefaultErrorDisplay
            error={error}
            errorInfo={errorInfo}
            onRetry={retry}
            retryCount={0}
            maxRetries={1}
            level="page"
          />
        </div>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    level="component"
    maxRetries={3}
    resetOnPropsChange={true}
  >
    {children}
  </ErrorBoundary>
);

export const FeatureErrorBoundary: React.FC<{ children: ReactNode; feature: string }> = ({ 
  children, 
  feature 
}) => (
  <ErrorBoundary
    level="feature"
    maxRetries={2}
    onError={(error, errorInfo) => {
      console.error(`Feature error in ${feature}:`, error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;