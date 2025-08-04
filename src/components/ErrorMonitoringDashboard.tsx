/**
 * Error Monitoring Dashboard component
 * Provides real-time error tracking and health metrics
 */

import React, { useState, useEffect, useMemo } from 'react';

import { useGlobalErrorHandler } from '../services/GlobalErrorHandler';
import type { ErrorMetrics } from '../services/GlobalErrorHandler';

interface ErrorMonitoringDashboardProps {
  className?: string;
  refreshInterval?: number;
  showDetails?: boolean;
}

const ErrorMonitoringDashboard: React.FC<ErrorMonitoringDashboardProps> = ({
  className = '',
  refreshInterval = 5000,
  showDetails = false,
}) => {
  const { getMetrics, getHealthReport, isHealthy } = useGlobalErrorHandler();
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
  const [isExpanded, setIsExpanded] = useState(showDetails);

  // Refresh metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getMetrics());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [getMetrics, refreshInterval]);

  const healthReport = useMemo(() => getHealthReport(), [getHealthReport]);

  const getHealthStatusColor = (healthy: boolean) => {
    return healthy ? 'text-green-600' : 'text-red-600';
  };

  const getHealthStatusIcon = (healthy: boolean) => {
    return healthy ? '✅' : '❌';
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  if (!metrics) {
    return (
      <div className={`error-dashboard loading ${className}`}>
        <div className="animate-pulse">Loading error metrics...</div>
      </div>
    );
  }

  return (
    <div className={`error-dashboard bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-lg">
              {getHealthStatusIcon(isHealthy)}
            </span>
            <div>
              <h3 className="font-medium text-gray-900">Error Monitoring</h3>
              <p className={`text-sm ${getHealthStatusColor(isHealthy)}`}>
                {isHealthy ? 'System Healthy' : 'Issues Detected'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalErrors}</div>
            <div className="text-sm text-gray-500">Total Errors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.errorRate}/min</div>
            <div className="text-sm text-gray-500">Error Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.sessionErrors}</div>
            <div className="text-sm text-gray-500">Session Errors</div>
          </div>
        </div>
      </div>

      {/* Detailed View */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Error Types */}
          <div className="px-4 py-3">
            <h4 className="font-medium text-gray-900 mb-3">Error Types</h4>
            <div className="space-y-2">
              {Object.entries(metrics.errorsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(metrics.errorsByType).length === 0 && (
                <div className="text-sm text-gray-500">No errors recorded</div>
              )}
            </div>
          </div>

          {/* Error Sources */}
          <div className="px-4 py-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Error Sources</h4>
            <div className="space-y-2">
              {Object.entries(metrics.errorsBySource).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">{source}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(metrics.errorsBySource).length === 0 && (
                <div className="text-sm text-gray-500">No errors recorded</div>
              )}
            </div>
          </div>

          {/* Recent Errors */}
          <div className="px-4 py-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Recent Errors</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {metrics.recentErrors.map((error, index) => (
                <div key={index} className="text-sm border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{error.error.name}</span>
                    <span className="text-gray-500">{formatTime(error.timestamp)}</span>
                  </div>
                  <div className="text-gray-600 mb-1">{error.error.message}</div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Source: {error.source}</span>
                    <span>Level: {error.level}</span>
                  </div>
                </div>
              ))}
              {metrics.recentErrors.length === 0 && (
                <div className="text-sm text-gray-500">No recent errors</div>
              )}
            </div>
          </div>

          {/* Health Report */}
          <div className="px-4 py-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Health Report</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>System Status:</span>
                <span className={getHealthStatusColor(healthReport.healthy)}>
                  {healthReport.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Errors:</span>
                <span>{healthReport.totalErrors}</span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate:</span>
                <span>{healthReport.errorRate}/min</span>
              </div>
              <div className="flex justify-between">
                <span>Session Errors:</span>
                <span>{healthReport.sessionErrors}</span>
              </div>
            </div>
          </div>

          {/* Top Errors */}
          {healthReport.topErrors.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Top Errors</h4>
              <div className="space-y-2">
                {healthReport.topErrors.map((error, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{error.type}</span>
                    <span className="font-medium">{error.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  if (confirm('Clear all error data?')) {
                    // globalErrorHandler.clearErrors();
                    setMetrics(getMetrics());
                  }
                }}
                className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              >
                Clear Errors
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact error indicator for use in headers/footers
 */
export const ErrorIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isHealthy, getHealthReport } = useGlobalErrorHandler();
  const [showTooltip, setShowTooltip] = useState(false);

  if (isHealthy) {
    return null;
  }

  const healthReport = getHealthReport();

  return (
    <div className={`relative ${className}`}>
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center space-x-1 text-red-600 hover:text-red-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="text-sm font-medium">{healthReport.totalErrors}</span>
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded shadow-lg whitespace-nowrap z-50">
          {healthReport.totalErrors} errors, {healthReport.errorRate}/min rate
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Error monitoring hook for custom components
 */
export const useErrorMonitoring = () => {
  const { getMetrics, getHealthReport, isHealthy } = useGlobalErrorHandler();
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getMetrics());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  return {
    metrics,
    healthReport: getHealthReport(),
    isHealthy,
  };
};

export default ErrorMonitoringDashboard;