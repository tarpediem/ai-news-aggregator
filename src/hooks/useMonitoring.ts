/**
 * Custom hooks for monitoring dashboard functionality
 * Provides real-time data fetching, WebSocket connections, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';

import { monitoringApi, createTimeRange, formatApiError } from '../services/monitoringApi';
import type {
  HealthStatus,
  DetailedHealthStatus,
  MetricsResponse,
  Alert,
  ErrorLog,
  ApplicationConfig,
  DashboardFilters,
  WebSocketMessage,
  ThemeMode,
} from '../types/monitoring';

// Health Status Hook
export const useHealthStatus = (refreshInterval = 30000) => {
  return useQuery({
    queryKey: ['health-status'],
    queryFn: () => monitoringApi.getHealthStatus(),
    refetchInterval: refreshInterval,
    staleTime: 15000,
    retry: 3,
  });
};

export const useDetailedHealthStatus = (refreshInterval = 60000) => {
  return useQuery({
    queryKey: ['detailed-health-status'],
    queryFn: () => monitoringApi.getDetailedHealthStatus(),
    refetchInterval: refreshInterval,
    staleTime: 30000,
    retry: 2,
  });
};

// Metrics Hook
export const useMetrics = (
  filters: DashboardFilters,
  refreshInterval = 60000
) => {
  return useQuery({
    queryKey: ['metrics', filters],
    queryFn: () =>
      monitoringApi.getMetrics({
        start_time: filters.timeRange.start,
        end_time: filters.timeRange.end,
        aggregation: '5m',
      }),
    refetchInterval: refreshInterval,
    staleTime: 30000,
    enabled: !!(filters.timeRange.start && filters.timeRange.end),
  });
};

// Alerts Hook
export const useAlerts = (
  filters: { severity?: string; service?: string } = {},
  refreshInterval = 30000
) => {
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ['alerts', filters],
    queryFn: () =>
      monitoringApi.getActiveAlerts({
        severity: filters.severity as any,
        service: filters.service,
        limit: 50,
      }),
    refetchInterval: refreshInterval,
    staleTime: 15000,
  });

  const acknowledgeAlert = useMutation({
    mutationFn: ({ alertId, comment }: { alertId: string; comment?: string }) =>
      monitoringApi.updateAlertStatus(alertId, { status: 'acknowledged', comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const resolveAlert = useMutation({
    mutationFn: ({ alertId, comment }: { alertId: string; comment?: string }) =>
      monitoringApi.updateAlertStatus(alertId, { status: 'resolved', comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  return {
    ...alertsQuery,
    acknowledgeAlert,
    resolveAlert,
  };
};

// Error Logs Hook
export const useErrorLogs = (
  filters: {
    severity?: string;
    service?: string;
    search?: string;
    timeRange?: { start: string; end: string };
  } = {},
  refreshInterval = 60000
) => {
  return useQuery({
    queryKey: ['error-logs', filters],
    queryFn: () =>
      monitoringApi.getErrorLogs({
        start_time: filters.timeRange?.start,
        end_time: filters.timeRange?.end,
        severity: filters.severity as any,
        service: filters.service,
        search: filters.search,
        limit: 100,
      }),
    refetchInterval: refreshInterval,
    staleTime: 30000,
  });
};

// Configuration Hook
export const useApplicationConfig = (applicationId: string, environment?: string) => {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ['config', applicationId, environment],
    queryFn: () => monitoringApi.getApplicationConfig(applicationId, environment as any),
    enabled: !!applicationId,
  });

  const updateConfig = useMutation({
    mutationFn: (update: {
      config: Record<string, any>;
      reason: string;
      rollout_strategy?: 'immediate' | 'gradual' | 'canary';
    }) => monitoringApi.updateApplicationConfig(applicationId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', applicationId] });
    },
  });

  const rollbackConfig = useMutation({
    mutationFn: (rollback: { version_id: string; reason: string }) =>
      monitoringApi.rollbackConfiguration(applicationId, rollback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', applicationId] });
    },
  });

  return {
    ...configQuery,
    updateConfig,
    rollbackConfig,
  };
};

// WebSocket Hook for Real-time Updates
export const useWebSocket = (url: string, enabled = true) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Invalidate relevant queries based on message type
          switch (message.type) {
            case 'health_update':
              queryClient.invalidateQueries({ queryKey: ['health-status'] });
              break;
            case 'metric_update':
              queryClient.invalidateQueries({ queryKey: ['metrics'] });
              break;
            case 'alert_update':
              queryClient.invalidateQueries({ queryKey: ['alerts'] });
              break;
            case 'error_update':
              queryClient.invalidateQueries({ queryKey: ['error-logs'] });
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after delay
        if (enabled) {
          setTimeout(connect, 5000);
        }
      };

      wsRef.current.onerror = (err) => {
        setError('WebSocket connection error');
        console.error('WebSocket error:', err);
      };
    } catch (err) {
      setError('Failed to create WebSocket connection');
      console.error('WebSocket creation error:', err);
    }
  }, [url, enabled, queryClient]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    error,
    connect,
    disconnect,
  };
};

// Dashboard Filters Hook
export const useDashboardFilters = () => {
  const [filters, setFilters] = useState<DashboardFilters>({
    timeRange: createTimeRange('24h'),
    services: [],
    severity: [],
    environment: 'production',
  });

  const updateTimeRange = useCallback((duration: '1h' | '6h' | '24h' | '7d' | '30d') => {
    setFilters((prev) => ({
      ...prev,
      timeRange: createTimeRange(duration),
    }));
  }, []);

  const updateServices = useCallback((services: string[]) => {
    setFilters((prev) => ({
      ...prev,
      services,
    }));
  }, []);

  const updateSeverity = useCallback((severity: string[]) => {
    setFilters((prev) => ({
      ...prev,
      severity,
    }));
  }, []);

  const updateEnvironment = useCallback((environment: string) => {
    setFilters((prev) => ({
      ...prev,
      environment,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      timeRange: createTimeRange('24h'),
      services: [],
      severity: [],
      environment: 'production',
    });
  }, []);

  return {
    filters,
    updateTimeRange,
    updateServices,
    updateSeverity,
    updateEnvironment,
    resetFilters,
  };
};

// Theme Hook
export const useTheme = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('monitoring-theme');
    return (saved as ThemeMode) || 'light';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('monitoring-theme', newTheme);
      return newTheme;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  };
};

// System Performance Hook
export const useSystemPerformance = () => {
  const [performanceData, setPerformanceData] = useState({
    responseTime: 0,
    networkType: 'unknown',
    effectiveType: 'unknown',
  });

  useEffect(() => {
    // Monitor navigation timing
    const updatePerformance = () => {
      if ('performance' in window && 'timing' in performance) {
        const timing = performance.timing;
        const responseTime = timing.responseEnd - timing.requestStart;
        setPerformanceData((prev) => ({
          ...prev,
          responseTime,
        }));
      }

      // Monitor network information if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        setPerformanceData((prev) => ({
          ...prev,
          networkType: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
        }));
      }
    };

    updatePerformance();
    const interval = setInterval(updatePerformance, 10000);

    return () => clearInterval(interval);
  }, []);

  return performanceData;
};

// Error Boundary Hook
export const useErrorBoundary = () => {
  const [error, setError] = useState<Error | null>(null);

  const captureError = useCallback((error: Error, errorInfo?: any) => {
    setError(error);
    
    // Submit error to monitoring API
    monitoringApi.submitErrorLog({
      severity: 'error',
      service: 'monitoring-dashboard',
      message: error.message,
      stack_trace: error.stack,
      context: errorInfo,
      tags: ['frontend', 'react'],
    }).catch(console.error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    captureError,
    clearError,
    hasError: !!error,
  };
};