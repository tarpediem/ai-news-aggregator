/**
 * Monitoring API service for interacting with the monitoring backend
 * Provides methods for health checks, metrics, alerts, errors, and configuration
 */

import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

import type {
  HealthStatus,
  DetailedHealthStatus,
  MetricsResponse,
  MetricSubmission,
  Alert,
  AlertRule,
  AlertRuleCreate,
  ErrorLog,
  ErrorAggregation,
  ApplicationConfig,
  ConfigurationHistoryItem,
  SystemInfo,
  Pagination,
  ApiResponse,
} from '../types/monitoring';

export class MonitoringApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL = '/api/monitoring/v1', timeout = 10000) {
    this.baseURL = baseURL;
    this.api = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const apiKey = localStorage.getItem('api_key');
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }
      return config;
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Health Check Methods
  async getHealthStatus(): Promise<HealthStatus> {
    const response = await this.api.get<HealthStatus>('/health');
    return response.data;
  }

  async getDetailedHealthStatus(): Promise<DetailedHealthStatus> {
    const response = await this.api.get<DetailedHealthStatus>('/health/detailed');
    return response.data;
  }

  async getReadinessStatus(): Promise<void> {
    await this.api.get('/health/readiness');
  }

  async getLivenessStatus(): Promise<void> {
    await this.api.get('/health/liveness');
  }

  async getHealthHistory(params: {
    start_time?: string;
    end_time?: string;
    service?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<HealthStatus[]>> {
    const response = await this.api.get('/health/history', { params });
    return response.data;
  }

  // Performance Monitoring Methods
  async getMetrics(params: {
    start_time?: string;
    end_time?: string;
    metric_types?: string;
    aggregation?: '1m' | '5m' | '15m' | '1h' | '6h' | '1d';
  }): Promise<MetricsResponse> {
    const response = await this.api.get<MetricsResponse>('/monitoring/metrics', { params });
    return response.data;
  }

  async submitMetrics(metrics: MetricSubmission): Promise<void> {
    await this.api.post('/monitoring/metrics', metrics);
  }

  async submitCustomMetrics(customMetric: {
    metric_name: string;
    value: number;
    timestamp?: string;
    dimensions?: Record<string, string>;
    unit?: string;
  }): Promise<void> {
    await this.api.post('/monitoring/metrics/custom', customMetric);
  }

  // Alert Methods
  async getActiveAlerts(params: {
    severity?: 'critical' | 'warning' | 'info';
    service?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Alert[]>> {
    const response = await this.api.get('/monitoring/alerts', { params });
    return response.data;
  }

  async createAlertRule(rule: AlertRuleCreate): Promise<AlertRule> {
    const response = await this.api.post<AlertRule>('/monitoring/alerts', rule);
    return response.data;
  }

  async getAlert(alertId: string): Promise<Alert> {
    const response = await this.api.get<Alert>(`/monitoring/alerts/${alertId}`);
    return response.data;
  }

  async updateAlertStatus(
    alertId: string,
    update: { status: 'acknowledged' | 'resolved'; comment?: string }
  ): Promise<void> {
    await this.api.patch(`/monitoring/alerts/${alertId}`, update);
  }

  // Error Tracking Methods
  async getErrorLogs(params: {
    start_time?: string;
    end_time?: string;
    severity?: 'error' | 'warning' | 'info' | 'debug';
    service?: string;
    search?: string;
    correlation_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ErrorLog[]>> {
    const response = await this.api.get('/logs/errors', { params });
    return response.data;
  }

  async submitErrorLog(error: {
    severity: 'error' | 'warning' | 'info' | 'debug';
    service: string;
    message: string;
    stack_trace?: string;
    correlation_id?: string;
    user_id?: string;
    session_id?: string;
    request_id?: string;
    context?: Record<string, any>;
    tags?: string[];
  }): Promise<{ id: string; correlation_id: string }> {
    const response = await this.api.post('/logs/errors', error);
    return response.data;
  }

  async getErrorAggregations(params: {
    start_time?: string;
    end_time?: string;
    group_by?: 'service' | 'severity' | 'error_type' | 'hour' | 'day';
  }): Promise<{ aggregations: ErrorAggregation[]; time_range: { start: string; end: string } }> {
    const response = await this.api.get('/logs/errors/aggregate', { params });
    return response.data;
  }

  // Configuration Management Methods
  async getApplicationConfig(
    applicationId: string,
    environment: 'development' | 'staging' | 'production' = 'production'
  ): Promise<ApplicationConfig> {
    const response = await this.api.get<ApplicationConfig>(
      `/config/applications/${applicationId}`,
      { params: { environment } }
    );
    return response.data;
  }

  async updateApplicationConfig(
    applicationId: string,
    update: {
      config: Record<string, any>;
      reason: string;
      rollout_strategy?: 'immediate' | 'gradual' | 'canary';
      rollout_percentage?: number;
    }
  ): Promise<ApplicationConfig> {
    const response = await this.api.put<ApplicationConfig>(
      `/config/applications/${applicationId}`,
      update
    );
    return response.data;
  }

  async getConfigurationHistory(
    applicationId: string,
    params: { limit?: number; offset?: number }
  ): Promise<ApiResponse<ConfigurationHistoryItem[]>> {
    const response = await this.api.get(`/config/applications/${applicationId}/history`, {
      params,
    });
    return response.data;
  }

  async rollbackConfiguration(
    applicationId: string,
    rollback: { version_id: string; reason: string }
  ): Promise<void> {
    await this.api.post(`/config/applications/${applicationId}/rollback`, rollback);
  }

  // System Information Methods
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await this.api.get<SystemInfo>('/system/info');
    return response.data;
  }

  async getSystemDependencies(): Promise<{
    dependencies: {
      name: string;
      type: 'database' | 'cache' | 'api' | 'queue' | 'storage';
      status: 'healthy' | 'degraded' | 'unhealthy';
      version?: string;
      endpoint?: string;
      response_time_ms?: number;
      last_checked: string;
      error?: string;
    }[];
  }> {
    const response = await this.api.get('/system/dependencies');
    return response.data;
  }

  // Utility Methods
  async ping(): Promise<boolean> {
    try {
      await this.getHealthStatus();
      return true;
    } catch {
      return false;
    }
  }

  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  setApiKey(apiKey: string): void {
    localStorage.setItem('api_key', apiKey);
  }

  clearAuth(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('api_key');
  }
}

// Default instance
export const monitoringApi = new MonitoringApiService();

// Helper function to create time range parameters
export const createTimeRange = (
  duration: '1h' | '6h' | '24h' | '7d' | '30d' = '24h'
): { start_time: string; end_time: string } => {
  const end = new Date();
  const start = new Date();

  switch (duration) {
    case '1h':
      start.setHours(start.getHours() - 1);
      break;
    case '6h':
      start.setHours(start.getHours() - 6);
      break;
    case '24h':
      start.setDate(start.getDate() - 1);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
  }

  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
};

// Helper function to format API errors
export const formatApiError = (error: any): string => {
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};