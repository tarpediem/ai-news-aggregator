/**
 * Performance Monitor - Real-time performance tracking for the app
 * 
 * Features:
 * - Memory usage monitoring
 * - Render performance tracking
 * - Network request monitoring
 * - Component performance metrics
 * - Safe patterns with circuit breaker protection
 */

import React, { useState } from 'react';
import { Activity, Zap, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

import { SafeComponentErrorBoundary } from './SafeErrorBoundary';
import { useSafeEffect } from '../hooks/useSafeEffect';
import { useSafeMemo } from '../hooks/useSafeMemo';
import { cn } from '../lib/utils';

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  networkRequests: number;
  errorCount: number;
  componentCount: number;
  fps: number;
}

interface PerformanceMonitorProps {
  showDetails?: boolean;
  className?: string;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  showDetails = false,
  className = ''
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    renderTime: 0,
    networkRequests: 0,
    errorCount: 0,
    componentCount: 0,
    fps: 60
  });
  
  const [isVisible, setIsVisible] = useState(process.env.NODE_ENV === 'development');

  // Safe effect for performance monitoring
  useSafeEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      // Memory usage (if available)
      const memory = (performance as any).memory;
      const memoryUsage = memory 
        ? Math.round(memory.usedJSHeapSize / 1024 / 1024)
        : 0;

      // Get performance entries
      const entries = performance.getEntriesByType('navigation');
      const renderTime = entries.length > 0 
        ? Math.round((entries[0] as any).loadEventEnd - (entries[0] as any).fetchStart)
        : 0;

      // Network requests
      const resourceEntries = performance.getEntriesByType('resource');
      const networkRequests = resourceEntries.length;

      // FPS calculation (simplified)
      const now = performance.now();
      const fps = Math.round(1000 / (now - (window as any).lastFrameTime || 16));
      (window as any).lastFrameTime = now;

      setMetrics({
        memoryUsage,
        renderTime,
        networkRequests,
        errorCount: 0, // Would be populated from error boundary
        componentCount: document.querySelectorAll('[data-component-id]').length,
        fps: Math.min(fps, 60)
      });
    };

    const interval = setInterval(updateMetrics, 1000);
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [isVisible], {
    effectId: 'performance-monitor',
    maxExecutionsPerSecond: 1
  });

  // Safe memo for performance status
  const [performanceStatus] = useSafeMemo(() => {
    if (metrics.memoryUsage > 100) return { status: 'warning', color: 'text-yellow-600', icon: AlertTriangle };
    if (metrics.fps < 30) return { status: 'warning', color: 'text-yellow-600', icon: AlertTriangle };
    if (metrics.renderTime > 3000) return { status: 'warning', color: 'text-yellow-600', icon: AlertTriangle };
    
    return { status: 'good', color: 'text-green-600', icon: CheckCircle };
  }, [metrics], {
    memoId: 'performance-status',
    maxComputationsPerSecond: 2
  });

  if (!isVisible) return null;

  return (
    <SafeComponentErrorBoundary componentId="performance-monitor">
      <div className={cn(
        "fixed bottom-4 right-4 z-50",
        className
      )}>
        {showDetails ? (
          <div className="bg-black/80 backdrop-blur-sm text-white rounded-lg p-4 shadow-lg min-w-[280px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">Performance</span>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Memory:</span>
                <span className={cn(
                  metrics.memoryUsage > 100 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {metrics.memoryUsage}MB
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>FPS:</span>
                <span className={cn(
                  metrics.fps < 30 ? 'text-red-400' : 
                  metrics.fps < 50 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {metrics.fps}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Render Time:</span>
                <span className={cn(
                  metrics.renderTime > 3000 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {metrics.renderTime}ms
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Components:</span>
                <span className="text-blue-400">{metrics.componentCount}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Network:</span>
                <span className="text-purple-400">{metrics.networkRequests}</span>
              </div>
            </div>
            
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="flex items-center space-x-2">
                <performanceStatus.icon className={cn("w-3 h-3", performanceStatus.color)} />
                <span className={cn("text-xs font-medium", performanceStatus.color)}>
                  {performanceStatus.status === 'good' ? 'Performance Good' : 'Performance Issues'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsVisible(true)}
            className="bg-black/60 backdrop-blur-sm text-white rounded-full p-3 shadow-lg hover:bg-black/80 transition-all duration-200 hover:scale-110"
            title="Show Performance Monitor"
          >
            <div className="flex items-center space-x-1">
              <Activity className="w-4 h-4" />
              <div className="flex space-x-1">
                <div className={cn(
                  "w-1 h-4 rounded-full",
                  metrics.memoryUsage > 100 ? 'bg-yellow-400' : 'bg-green-400'
                )} />
                <div className={cn(
                  "w-1 h-4 rounded-full",
                  metrics.fps < 30 ? 'bg-red-400' : metrics.fps < 50 ? 'bg-yellow-400' : 'bg-green-400'
                )} />
                <div className={cn(
                  "w-1 h-4 rounded-full",
                  'bg-blue-400'
                )} />
              </div>
            </div>
          </button>
        )}
      </div>
    </SafeComponentErrorBoundary>
  );
};

export default PerformanceMonitor;