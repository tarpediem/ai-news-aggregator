/**
 * Performance monitoring dashboard component
 * Displays real-time performance metrics and analytics insights
 */

import React, { useState, useEffect, useMemo } from 'react';

import { useAnalytics } from '../services/AnalyticsService';
import { useGlobalErrorHandler } from '../services/GlobalErrorHandler';

interface PerformanceDashboardProps {
  className?: string;
  refreshInterval?: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  description: string;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className = '',
  refreshInterval = 10000,
}) => {
  const { getInsights, getEventCounts } = useAnalytics();
  const { getHealthReport } = useGlobalErrorHandler();
  
  const [insights, setInsights] = useState<any>(null);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [healthReport, setHealthReport] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Refresh data periodically
  useEffect(() => {
    const updateData = () => {
      setInsights(getInsights());
      setEventCounts(getEventCounts('hour'));
      setHealthReport(getHealthReport());
    };

    updateData();
    const interval = setInterval(updateData, refreshInterval);

    return () => clearInterval(interval);
  }, [getInsights, getEventCounts, getHealthReport, refreshInterval]);

  // Calculate performance metrics
  const performanceMetrics = useMemo((): PerformanceMetric[] => {
    if (!insights) return [];

    return [
      {
        name: 'Average Load Time',
        value: insights.averageLoadTime,
        unit: 'ms',
        status: insights.averageLoadTime < 2000 ? 'good' : insights.averageLoadTime < 4000 ? 'warning' : 'critical',
        trend: 'stable',
        description: 'Time taken to load pages',
      },
      {
        name: 'Error Rate',
        value: insights.errorRate * 100,
        unit: '%',
        status: insights.errorRate < 0.01 ? 'good' : insights.errorRate < 0.05 ? 'warning' : 'critical',
        trend: 'stable',
        description: 'Percentage of requests that result in errors',
      },
      {
        name: 'User Engagement',
        value: insights.userEngagement,
        unit: 'interactions/view',
        status: insights.userEngagement > 2 ? 'good' : insights.userEngagement > 1 ? 'warning' : 'critical',
        trend: 'stable',
        description: 'Average interactions per page view',
      },
    ];
  }, [insights]);

  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '⭕';
    }
  };

  const getTrendIcon = (trend: PerformanceMetric['trend']) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'ms' && value > 1000) {
      return `${(value / 1000).toFixed(1)}s`;
    }
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)}${unit}`;
  };

  if (!insights) {
    return (
      <div className={`performance-dashboard loading ${className}`}>
        <div className="animate-pulse">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className={`performance-dashboard bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-lg">📊</span>
            <div>
              <h3 className="font-medium text-gray-900">Performance Dashboard</h3>
              <p className="text-sm text-gray-500">Real-time system metrics</p>
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

      {/* Performance Metrics */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {performanceMetrics.map((metric) => (
            <div key={metric.name} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                <div className="flex items-center space-x-1">
                  <span>{getStatusIcon(metric.status)}</span>
                  <span>{getTrendIcon(metric.trend)}</span>
                </div>
              </div>
              <div className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                {formatValue(metric.value, metric.unit)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{metric.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Event Counts */}
          <div className="px-4 py-3">
            <h4 className="font-medium text-gray-900 mb-3">Event Activity (Last Hour)</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(eventCounts).map(([eventType, count]) => (
                <div key={eventType} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{eventType.replace(':', ' → ')}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(eventCounts).length === 0 && (
                <div className="text-sm text-gray-500">No events recorded</div>
              )}
            </div>
          </div>

          {/* Error Analysis */}
          {insights.topErrors.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Top Errors</h4>
              <div className="space-y-2">
                {insights.topErrors.map((error: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1 mr-2">{error.error}</span>
                    <span className="font-medium text-red-600">{error.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Health */}
          {healthReport && (
            <div className="px-4 py-3 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">System Health</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={healthReport.healthy ? 'text-green-600' : 'text-red-600'}>
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
          )}

          {/* Performance Recommendations */}
          <div className="px-4 py-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
            <div className="space-y-2 text-sm">
              {insights.averageLoadTime > 3000 && (
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600">⚠️</span>
                  <span>Consider optimizing images and reducing bundle size to improve load times</span>
                </div>
              )}
              {insights.errorRate > 0.02 && (
                <div className="flex items-start space-x-2">
                  <span className="text-red-600">❌</span>
                  <span>High error rate detected. Review error logs and implement fixes</span>
                </div>
              )}
              {insights.userEngagement < 1 && (
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600">💡</span>
                  <span>Low user engagement. Consider improving UX and content quality</span>
                </div>
              )}
              {insights.averageLoadTime < 2000 && insights.errorRate < 0.01 && insights.userEngagement > 2 && (
                <div className="flex items-start space-x-2">
                  <span className="text-green-600">✅</span>
                  <span>Excellent performance! All metrics are within optimal ranges</span>
                </div>
              )}
            </div>
          </div>

          {/* Performance Chart Placeholder */}
          <div className="px-4 py-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Performance Trends</h4>
            <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>Performance trends chart would appear here</p>
              <p className="text-xs mt-1">Chart component integration pending</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Performance indicator for use in navigation bars
 */
export const PerformanceIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { getInsights } = useAnalytics();
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    const updateInsights = () => {
      setInsights(getInsights());
    };

    updateInsights();
    const interval = setInterval(updateInsights, 30000);

    return () => clearInterval(interval);
  }, [getInsights]);

  if (!insights) return null;

  const overallStatus = insights.averageLoadTime < 2000 && insights.errorRate < 0.01 ? 'good' : 
                       insights.averageLoadTime < 4000 && insights.errorRate < 0.05 ? 'warning' : 'critical';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return '🟢';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className={`performance-indicator ${className}`}>
      <div className="flex items-center space-x-2">
        <span>{getStatusIcon(overallStatus)}</span>
        <span className={`text-sm font-medium ${getStatusColor(overallStatus)}`}>
          {insights.averageLoadTime < 1000 ? 
            `${Math.round(insights.averageLoadTime)}ms` : 
            `${(insights.averageLoadTime / 1000).toFixed(1)}s`
          }
        </span>
      </div>
    </div>
  );
};

/**
 * Hook for accessing performance metrics
 */
export const usePerformanceMetrics = () => {
  const { getInsights, getEventCounts } = useAnalytics();
  const { getHealthReport } = useGlobalErrorHandler();
  
  return {
    getInsights,
    getEventCounts,
    getHealthReport,
  };
};

export default PerformanceDashboard;