/**
 * Accessibility Provider and utilities for enhanced accessibility features
 * Implements ARIA compliance, keyboard navigation, and screen reader support
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

import { useCircuitBreaker } from '../utils/circuitBreaker';

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  focusVisible: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  colorBlindFriendly: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void;
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void;
  skipToContent: () => void;
  focusManager: {
    trapFocus: (element: HTMLElement) => void;
    releaseFocus: () => void;
    focusNext: () => void;
    focusPrevious: () => void;
  };
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  focusVisible: true,
  screenReaderOptimized: false,
  keyboardNavigation: true,
  colorBlindFriendly: false,
};

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Circuit breaker protection
  const shouldRender = useCircuitBreaker('AccessibilityProvider');
  
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    
    // Detect user preferences
    return {
      ...defaultSettings,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    };
  });

  const [focusTrapped, setFocusTrapped] = useState<HTMLElement | null>(null);
  const [announcer, setAnnouncer] = useState<HTMLElement | null>(null);

  // Initialize announcer element
  useEffect(() => {
    const announcerElement = document.createElement('div');
    announcerElement.setAttribute('aria-live', 'polite');
    announcerElement.setAttribute('aria-atomic', 'true');
    announcerElement.setAttribute('aria-relevant', 'all');
    announcerElement.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(announcerElement);
    setAnnouncer(announcerElement);

    return () => {
      if (document.body.contains(announcerElement)) {
        document.body.removeChild(announcerElement);
      }
    };
  }, []);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Large text mode
    if (settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Focus visible
    if (settings.focusVisible) {
      root.classList.add('focus-visible');
    } else {
      root.classList.remove('focus-visible');
    }

    // Screen reader optimized
    if (settings.screenReaderOptimized) {
      root.classList.add('screen-reader-optimized');
    } else {
      root.classList.remove('screen-reader-optimized');
    }

    // Color blind friendly
    if (settings.colorBlindFriendly) {
      root.classList.add('color-blind-friendly');
    } else {
      root.classList.remove('color-blind-friendly');
    }

    // Save settings
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Keyboard navigation
  useEffect(() => {
    if (!settings.keyboardNavigation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Tab navigation enhancement
      if (event.key === 'Tab') {
        document.body.classList.add('user-is-tabbing');
      }

      // Escape key to release focus trap
      if (event.key === 'Escape' && focusTrapped) {
        releaseFocus();
      }

      // Skip to content (Alt + S)
      if (event.altKey && event.key === 's') {
        event.preventDefault();
        skipToContent();
      }

      // Focus navigation within trapped element
      if (focusTrapped && event.key === 'Tab') {
        const focusableElements = getFocusableElements(focusTrapped);
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          const currentElement = document.activeElement;

          if (event.shiftKey && currentElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          } else if (!event.shiftKey && currentElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('user-is-tabbing');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [settings.keyboardNavigation, focusTrapped]);

  const updateSetting = useCallback((key: keyof AccessibilitySettings, value: boolean) => {
    console.log(`♿ Accessibility setting update: ${key} = ${value}`);
    setSettings(prev => {
      // Prevent unnecessary updates
      if (prev[key] === value) {
        console.log(`📋 Accessibility setting ${key} unchanged, skipping update`);
        return prev;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const announceMessage = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcer) return;

    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after a delay
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }, [announcer]);

  const skipToContent = useCallback(() => {
    const mainContent = document.getElementById('main-content') || 
                       document.querySelector('main') ||
                       document.querySelector('[role="main"]');
    
    if (mainContent && mainContent instanceof HTMLElement) {
      mainContent.focus();
      announceMessage('Skipped to main content');
    }
  }, [announceMessage]);

  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
  };

  const trapFocus = useCallback((element: HTMLElement) => {
    setFocusTrapped(element);
    const focusableElements = getFocusableElements(element);
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
    }
  }, []);

  const releaseFocus = useCallback(() => {
    setFocusTrapped(null);
  }, []);

  const focusNext = useCallback(() => {
    if (!focusTrapped) return;
    
    const focusableElements = getFocusableElements(focusTrapped);
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    focusableElements[nextIndex]?.focus();
  }, [focusTrapped]);

  const focusPrevious = useCallback(() => {
    if (!focusTrapped) return;
    
    const focusableElements = getFocusableElements(focusTrapped);
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const previousIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
    focusableElements[previousIndex]?.focus();
  }, [focusTrapped]);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSetting,
    announceMessage,
    skipToContent,
    focusManager: {
      trapFocus,
      releaseFocus,
      focusNext,
      focusPrevious,
    },
  };
  
  // Circuit breaker protection
  if (!shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Accessibility Provider Disabled</h2>
          <p className="text-yellow-600 mb-4">Infinite loop protection is active.</p>
          <p className="text-yellow-500 text-sm">Basic functionality will continue to work.</p>
        </div>
      </div>
    );
  }

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

/**
 * Skip to content link component
 */
export const SkipToContent: React.FC = () => {
  const { skipToContent } = useAccessibility();

  return (
    <button
      onClick={skipToContent}
      className="skip-to-content sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:font-medium"
      tabIndex={0}
    >
      Skip to main content
    </button>
  );
};

/**
 * Accessibility settings panel
 */
export const AccessibilitySettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { settings, updateSetting } = useAccessibility();

  const settingsConfig = [
    {
      key: 'highContrast' as const,
      label: 'High Contrast',
      description: 'Increase color contrast for better visibility',
    },
    {
      key: 'largeText' as const,
      label: 'Large Text',
      description: 'Increase font size for better readability',
    },
    {
      key: 'reducedMotion' as const,
      label: 'Reduced Motion',
      description: 'Minimize animations and transitions',
    },
    {
      key: 'screenReaderOptimized' as const,
      label: 'Screen Reader Optimized',
      description: 'Optimize layout for screen readers',
    },
    {
      key: 'keyboardNavigation' as const,
      label: 'Keyboard Navigation',
      description: 'Enable enhanced keyboard navigation',
    },
    {
      key: 'colorBlindFriendly' as const,
      label: 'Color Blind Friendly',
      description: 'Use patterns and symbols in addition to colors',
    },
  ];

  return (
    <div className={`accessibility-settings bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Accessibility Settings</h3>
      
      <div className="space-y-4">
        {settingsConfig.map((setting) => (
          <div key={setting.key} className="flex items-start space-x-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings[setting.key]}
                onChange={(e) => updateSetting(setting.key, e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                aria-describedby={`${setting.key}-description`}
              />
              <div>
                <div className="font-medium text-gray-900">{setting.label}</div>
                <div id={`${setting.key}-description`} className="text-sm text-gray-500">
                  {setting.description}
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * ARIA Live Region component for announcements
 */
export const LiveRegion: React.FC<{
  message: string;
  priority?: 'polite' | 'assertive';
  children?: React.ReactNode;
}> = ({ message, priority = 'polite', children }) => {
  return (
    <div aria-live={priority} aria-atomic="true" className="sr-only">
      {message}
      {children}
    </div>
  );
};

/**
 * Focus trap component for modal dialogs
 */
export const FocusTrap: React.FC<{
  children: React.ReactNode;
  active: boolean;
  onEscape?: () => void;
}> = ({ children, active, onEscape }) => {
  const { focusManager } = useAccessibility();
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && containerRef.current) {
      focusManager.trapFocus(containerRef.current);
    } else {
      focusManager.releaseFocus();
    }

    return () => {
      focusManager.releaseFocus();
    };
  }, [active, focusManager]);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);

  return (
    <div ref={containerRef} className="focus-trap">
      {children}
    </div>
  );
};

/**
 * Enhanced button component with accessibility features
 */
export const AccessibleButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
}> = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary', 
  size = 'md',
  ariaLabel,
  ariaDescribedBy,
  className = '' 
}) => {
  const { announceMessage } = useAccessibility();

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    
    if (variant === 'danger') {
      announceMessage('Action completed', 'assertive');
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

/**
 * Screen reader only text component
 */
export const ScreenReaderOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
};

export default AccessibilityProvider;