/**
 * Service Worker registration and management utilities
 * Provides offline capabilities and performance improvements
 */

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: Error) => void;
}

export type CacheStats = Record<string, number>;

export interface ServiceWorkerAPI {
  register: (config?: ServiceWorkerConfig) => Promise<ServiceWorkerRegistration | undefined>;
  unregister: () => Promise<boolean>;
  update: () => Promise<void>;
  getCacheStats: () => Promise<CacheStats>;
  clearCache: (cacheName?: string) => Promise<void>;
  isSupported: boolean;
  isRegistered: boolean;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};

  public readonly isSupported = 'serviceWorker' in navigator;
  
  public get isRegistered(): boolean {
    return !!this.registration;
  }

  /**
   * Register the service worker
   */
  async register(config: ServiceWorkerConfig = {}): Promise<ServiceWorkerRegistration | undefined> {
    this.config = config;

    if (!this.isSupported) {
      console.warn('[SW] Service workers not supported in this browser');
      return undefined;
    }

    // Only register in production or when explicitly enabled
    if (process.env.NODE_ENV !== 'production' && !localStorage.getItem('sw-dev-mode')) {
      console.log('[SW] Service worker disabled in development mode');
      return undefined;
    }

    try {
      console.log('[SW] Registering service worker...');
      
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service worker registered successfully');

      // Handle different states
      if (this.registration.installing) {
        console.log('[SW] Service worker installing...');
        this.handleInstalling(this.registration.installing);
      } else if (this.registration.waiting) {
        console.log('[SW] Service worker waiting...');
        this.handleWaiting(this.registration.waiting);
      } else if (this.registration.active) {
        console.log('[SW] Service worker active');
        this.handleActive(this.registration.active);
      }

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        console.log('[SW] Service worker update found');
        this.handleUpdateFound();
      });

      // Check for updates periodically
      this.startUpdateCheck();

      return this.registration;

    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
      this.config.onRegisterError?.(error as Error);
      return undefined;
    }
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.isSupported || !this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      console.log('[SW] Service worker unregistered');
      this.registration = null;
      return result;
    } catch (error) {
      console.error('[SW] Service worker unregistration failed:', error);
      return false;
    }
  }

  /**
   * Update the service worker
   */
  async update(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      await this.registration.update();
      console.log('[SW] Service worker update check completed');
    } catch (error) {
      console.error('[SW] Service worker update failed:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    if (!this.isSupported) {
      return {};
    }

    try {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };

        setTimeout(() => {
          reject(new Error('Timeout waiting for cache stats'));
        }, 5000);

        navigator.serviceWorker.controller?.postMessage(
          { type: 'CACHE_STATS' },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      console.error('[SW] Failed to get cache stats:', error);
      return {};
    }
  }

  /**
   * Clear specific cache or all caches
   */
  async clearCache(cacheName?: string): Promise<void> {
    if (!this.isSupported) {
      return;
    }

    try {
      if (cacheName) {
        await caches.delete(cacheName);
        console.log(`[SW] Cache '${cacheName}' cleared`);
      } else {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[SW] All caches cleared');
      }
    } catch (error) {
      console.error('[SW] Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Force skip waiting and activate new service worker
   */
  skipWaiting(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Handle installing state
   */
  private handleInstalling(worker: ServiceWorker): void {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // Update available
          console.log('[SW] New content available');
          this.config.onUpdate?.(this.registration!);
        } else {
          // First install
          console.log('[SW] Content cached for offline use');
          this.config.onOfflineReady?.();
        }
      }
    });
  }

  /**
   * Handle waiting state
   */
  private handleWaiting(_worker: ServiceWorker): void {
    console.log('[SW] Service worker waiting');
    this.config.onUpdate?.(this.registration!);
  }

  /**
   * Handle active state
   */
  private handleActive(_worker: ServiceWorker): void {
    console.log('[SW] Service worker active');
    this.config.onSuccess?.(this.registration!);
  }

  /**
   * Handle update found
   */
  private handleUpdateFound(): void {
    if (!this.registration) return;

    const newWorker = this.registration.installing;
    if (!newWorker) return;

    this.handleInstalling(newWorker);
  }

  /**
   * Start periodic update checks
   */
  private startUpdateCheck(): void {
    // Check for updates every 30 minutes
    setInterval(() => {
      if (this.registration) {
        this.registration.update().catch(error => {
          console.log('[SW] Update check failed:', error.message);
        });
      }
    }, 30 * 60 * 1000);

    // Check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.registration) {
        this.registration.update().catch(error => {
          console.log('[SW] Update check failed:', error.message);
        });
      }
    });
  }
}

// Create singleton instance
const serviceWorkerManager = new ServiceWorkerManager();

// Export the API
export const serviceWorker: ServiceWorkerAPI = {
  register: serviceWorkerManager.register.bind(serviceWorkerManager),
  unregister: serviceWorkerManager.unregister.bind(serviceWorkerManager),
  update: serviceWorkerManager.update.bind(serviceWorkerManager),
  getCacheStats: serviceWorkerManager.getCacheStats.bind(serviceWorkerManager),
  clearCache: serviceWorkerManager.clearCache.bind(serviceWorkerManager),
  get isSupported() { return serviceWorkerManager.isSupported; },
  get isRegistered() { return serviceWorkerManager.isRegistered; },
};

// Development utilities
export const swDev = {
  enable: () => localStorage.setItem('sw-dev-mode', 'true'),
  disable: () => localStorage.removeItem('sw-dev-mode'),
  skipWaiting: () => serviceWorkerManager.skipWaiting(),
  isEnabled: () => !!localStorage.getItem('sw-dev-mode'),
};

// React hook for service worker
export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = React.useState(serviceWorker.isRegistered);
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [cacheStats, setCacheStats] = React.useState<CacheStats>({});

  React.useEffect(() => {
    if (serviceWorker.isSupported) {
      serviceWorker.register({
        onSuccess: () => {
          setIsRegistered(true);
          console.log('[App] Service worker registered successfully');
        },
        onUpdate: () => {
          setUpdateAvailable(true);
          console.log('[App] Service worker update available');
        },
        onOfflineReady: () => {
          console.log('[App] App is ready for offline use');
        },
        onRegisterError: (error) => {
          console.error('[App] Service worker registration failed:', error);
        },
      });

      // Load cache stats
      serviceWorker.getCacheStats().then(setCacheStats);
    }
  }, []);

  const applyUpdate = React.useCallback(() => {
    if (updateAvailable) {
      swDev.skipWaiting();
      window.location.reload();
    }
  }, [updateAvailable]);

  const refreshCacheStats = React.useCallback(async () => {
    const stats = await serviceWorker.getCacheStats();
    setCacheStats(stats);
  }, []);

  return {
    isSupported: serviceWorker.isSupported,
    isRegistered,
    updateAvailable,
    cacheStats,
    applyUpdate,
    refreshCacheStats,
    clearCache: serviceWorker.clearCache,
  };
}

// TypeScript fix for React import
import React from 'react';