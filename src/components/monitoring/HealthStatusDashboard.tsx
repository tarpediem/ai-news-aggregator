/**
 * Health Status Dashboard Component
 * Real-time health monitoring with system dependencies and service status
 */

import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Server,
  Database,
  Wifi,
  HardDrive,
  Cpu,
  MemoryStick,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import React, { useState } from 'react';

import { useHealthStatus, useDetailedHealthStatus } from '../../hooks/useMonitoring';
import type { HealthStatus, DetailedHealthStatus, Dependency } from '../../types/monitoring';

interface HealthStatusDashboardProps {
  className?: string;
  refreshInterval?: number;
  showDetails?: boolean;
}

export const HealthStatusDashboard: React.FC<HealthStatusDashboardProps> = ({
  className = '',
  refreshInterval = 30000,
  showDetails = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useHealthStatus(refreshInterval);

  const {
    data: detailedData,
    isLoading: detailedLoading,
    error: detailedError,
    refetch: refetchDetailed,
  } = useDetailedHealthStatus(isExpanded ? refreshInterval : 999999999);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'unhealthy':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
      case 'degraded':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700';
      case 'unhealthy':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const handleRefresh = () => {
    refetchHealth();
    if (isExpanded) {
      refetchDetailed();
    }
  };

  if (healthLoading && !healthData) {
    return (
      <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (healthError) {
    return (
      <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-6', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Health Check Failed</h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                Unable to fetch health status
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm', className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(healthData?.status || 'unknown')}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">System Health</h3>
              <p className={clsx('text-sm capitalize', getStatusColor(healthData?.status || 'unknown'))}>
                {healthData?.status || 'Unknown'} • v{healthData?.version || 'N/A'}
                {healthData?.uptime && (
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    • Uptime: {formatUptime(healthData.uptime)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Refresh health data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Status Checks */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {healthData?.checks && Object.entries(healthData.checks).map(([checkName, check]) => (
            <motion.div
              key={checkName}
              whileHover={{ scale: 1.02 }}
              className={clsx(
                'p-4 rounded-lg border cursor-pointer transition-colors',
                getStatusBgColor(check.status),
                selectedService === checkName && 'ring-2 ring-blue-500 dark:ring-blue-400'
              )}
              onClick={() => setSelectedService(selectedService === checkName ? null : checkName)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(check.status)}
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {checkName.replace(/[_-]/g, ' ')}
                  </span>
                </div>
                {check.response_time_ms && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {check.response_time_ms}ms
                  </span>
                )}
              </div>
              {check.error && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400 truncate">
                  {check.error}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Detailed View */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-gray-200 dark:border-gray-700"
        >
          {/* System Resources */}
          {detailedData?.system && (
            <div className="px-6 py-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                <Server className="w-4 h-4 mr-2" />
                System Resources
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Cpu className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatPercentage(detailedData.system.cpu_usage)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <MemoryStick className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Memory</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatPercentage(detailedData.system.memory_usage)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <HardDrive className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Disk Usage</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatPercentage(detailedData.system.disk_usage)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Server className="w-5 h-5 text-orange-500" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Load Avg</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {detailedData.system.load_average?.[0]?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dependencies */}
          {detailedData?.dependencies && detailedData.dependencies.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                <Wifi className="w-4 h-4 mr-2" />
                Dependencies
              </h4>
              <div className="space-y-3">
                {detailedData.dependencies.map((dep, index) => (
                  <motion.div
                    key={dep.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(dep.status)}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{dep.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Last checked: {new Date(dep.last_checked).toLocaleString()}
                        </div>
                        {dep.error && (
                          <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {dep.error}
                          </div>
                        )}
                      </div>
                    </div>
                    {dep.response_time_ms && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {dep.response_time_ms}ms
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Response Time</div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Service Details */}
          {selectedService && healthData?.checks?.[selectedService] && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                {selectedService.replace(/[_-]/g, ' ')} Details
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                    <div className={clsx('font-medium capitalize', getStatusColor(healthData.checks[selectedService].status))}>
                      {healthData.checks[selectedService].status}
                    </div>
                  </div>
                  {healthData.checks[selectedService].response_time_ms && (
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Response Time</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {healthData.checks[selectedService].response_time_ms}ms
                      </div>
                    </div>
                  )}
                </div>
                {healthData.checks[selectedService].error && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Error Details</div>
                    <div className="text-sm text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
                      {healthData.checks[selectedService].error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default HealthStatusDashboard;