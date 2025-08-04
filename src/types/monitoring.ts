/**
 * Type definitions for monitoring dashboard components
 * Based on the monitoring API specification
 */

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime?: number;
  checks?: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms?: number;
  error?: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  system?: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    load_average: number[];
  };
  dependencies?: Dependency[];
}

export interface Dependency {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms?: number;
  last_checked: string;
  error?: string;
}

// Performance Metrics Types
export interface Metric {
  name: string;
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricsResponse {
  metrics: Metric[];
  aggregation: string;
  time_range: {
    start: string;
    end: string;
  };
}

export interface MetricSubmission {
  metrics: {
    name: string;
    value: number;
    timestamp: string;
    labels?: Record<string, string>;
    unit?: 'count' | 'gauge' | 'histogram' | 'summary';
  }[];
}

// Alert Types
export interface Alert {
  id: string;
  rule_id: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  title: string;
  description: string;
  service: string;
  metric: string;
  threshold: number;
  current_value: number;
  created_at: string;
  updated_at: string;
  acknowledged_by?: string;
  resolved_by?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  evaluation_window: string;
  cooldown_period: string;
  enabled: boolean;
  notification_channels: string[];
  created_at: string;
  updated_at: string;
}

export interface AlertRuleCreate {
  name: string;
  description?: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  evaluation_window: string;
  cooldown_period: string;
  notification_channels: string[];
}

// Error Tracking Types
export interface ErrorLog {
  id: string;
  timestamp: string;
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
  count?: number;
  first_seen?: string;
  last_seen?: string;
}

export interface ErrorAggregation {
  group: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Configuration Types
export interface ApplicationConfig {
  id: string;
  application_id: string;
  environment: string;
  version: string;
  config: Record<string, any>;
  schema_version: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  status: 'active' | 'inactive' | 'rollback';
}

export interface ConfigurationHistoryItem {
  version_id: string;
  version: string;
  changes: {
    field: string;
    old_value: string;
    new_value: string;
  }[];
  reason: string;
  created_at: string;
  created_by: string;
  status: string;
}

// System Information Types
export interface SystemInfo {
  application: {
    name: string;
    version: string;
    build: string;
    environment: string;
  };
  runtime: {
    platform: string;
    version: string;
    uptime: number;
  };
  timestamps: {
    started_at: string;
    current_time: string;
  };
}

// Common Types
export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    correlation_id: string;
    timestamp: string;
  };
}

// Dashboard State Types
export interface DashboardFilters {
  timeRange: {
    start: string;
    end: string;
  };
  services?: string[];
  severity?: string[];
  environment?: string;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'health_update' | 'metric_update' | 'alert_update' | 'error_update';
  data: any;
  timestamp: string;
}

// Theme Types
export type ThemeMode = 'light' | 'dark';

// User Role Types
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserPermissions {
  canViewDashboard: boolean;
  canViewLogs: boolean;
  canManageAlerts: boolean;
  canManageConfiguration: boolean;
  canAcknowledgeAlerts: boolean;
}