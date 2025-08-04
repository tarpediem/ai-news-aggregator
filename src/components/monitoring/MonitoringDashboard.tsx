/**
 * Main monitoring dashboard component
 * Provides a comprehensive view of system health, performance, and alerts
 */

import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  AlertTriangle, 
  Settings, 
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import React, { useState } from 'react';

import { useDashboardFilters, useTheme, useWebSocket } from '../../hooks/useMonitoring';

import { AlertManagement } from './AlertManagement';
import { ConfigurationManager } from './ConfigurationManager';
import { DashboardFilters } from './DashboardFilters';
import { ErrorTracking } from './ErrorTracking';
import { HealthStatusDashboard } from './HealthStatusDashboard';
import { MetricsVisualization } from './MetricsVisualization';



interface MonitoringDashboardProps {
  className?: string;
  websocketUrl?: string;
  applicationId?: string;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  className = '',
  websocketUrl = 'ws://localhost:8080/ws',
  applicationId = 'ai-news-app',
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { filters, ...filterActions } = useDashboardFilters();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isConnected, lastMessage, error: wsError } = useWebSocket(
    websocketUrl,
    true
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'metrics', label: 'Metrics', icon: Activity },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'errors', label: 'Error Logs', icon: AlertTriangle },
    { id: 'config', label: 'Configuration', icon: Settings },
  ];

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={clsx(
      'monitoring-dashboard min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200',
      className
    )}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title and Status */}
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  System Monitoring
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                  <span>Real-time dashboard</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span className={clsx(
                    'flex items-center space-x-1',
                    isConnected ? 'text-green-600' : 'text-red-600'
                  )}>
                    <div className={clsx(
                      'w-2 h-2 rounded-full',
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    )}></div>
                    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                  </span>
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={clsx(
                  'p-2 rounded-lg border transition-colors',
                  isFiltersOpen
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
                title="Toggle filters"
              >
                <Filter className="w-4 h-4" />
              </button>

              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={handleFullscreen}
                className="p-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-4 flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 dark:border-gray-700"
            >
              <DashboardFilters
                filters={filters}
                onUpdateTimeRange={filterActions.updateTimeRange}
                onUpdateServices={filterActions.updateServices}
                onUpdateSeverity={filterActions.updateSeverity}
                onUpdateEnvironment={filterActions.updateEnvironment}
                onReset={filterActions.resetFilters}
                className="p-6"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Overview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <HealthStatusDashboard
                    refreshInterval={30000}
                    className="h-auto"
                    key={refreshKey}
                  />
                </div>
                <div>
                  <AlertManagement
                    filters={{ severity: filters.severity?.[0] }}
                    refreshInterval={30000}
                    maxItems={5}
                    className="h-96"
                    key={refreshKey}
                  />
                </div>
                <div>
                  <ErrorTracking
                    filters={{
                      timeRange: filters.timeRange,
                      severity: filters.severity?.[0],
                    }}
                    refreshInterval={60000}
                    maxItems={5}
                    className="h-96"
                    key={refreshKey}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <MetricsVisualization
                filters={filters}
                refreshInterval={60000}
                key={refreshKey}
              />
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AlertManagement
                filters={{
                  severity: filters.severity?.[0],
                  service: filters.services?.[0],
                }}
                refreshInterval={30000}
                key={refreshKey}
              />
            </motion.div>
          )}

          {activeTab === 'errors' && (
            <motion.div
              key="errors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ErrorTracking
                filters={{
                  timeRange: filters.timeRange,
                  severity: filters.severity?.[0],
                  service: filters.services?.[0],
                }}
                refreshInterval={60000}
                key={refreshKey}
              />
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ConfigurationManager
                applicationId={applicationId}
                environment={filters.environment}
                key={refreshKey}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* WebSocket Error Toast */}
      <AnimatePresence>
        {wsError && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>WebSocket connection error</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MonitoringDashboard;