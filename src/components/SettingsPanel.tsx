/**
 * Enhanced Settings Panel - Full UI restoration with safe patterns
 * 
 * Features:
 * - AI model configuration (OpenAI, Anthropic, Google, etc.)
 * - News source preferences and filtering
 * - Display preferences (theme, layout, etc.)
 * - Search and filter controls
 * - All settings integrated with safe store hooks
 * - Circuit breaker protection
 * - Performance optimized with memoization
 */

import React, { useState, useCallback } from 'react';
import { 
  Settings, X, Save, RotateCcw, Eye, EyeOff, Globe, 
  Palette, Layout, Filter, Search, Bell, Moon, Sun,
  Zap, RefreshCw, Sliders, Monitor, Smartphone,
  BookOpen, Clock, Shield, AlertTriangle, CheckCircle
} from 'lucide-react';

import { SafeComponentErrorBoundary } from './SafeErrorBoundary';
import { useUserPreferences, useUISettings, useNewsState } from '../store/AppStore';
import { useSafeCallback } from '../hooks/useSafeCallback';
import { useSafeEffect } from '../hooks/useSafeEffect';
import { useSafeMemo } from '../hooks/useSafeMemo';
import { cn } from '../lib/utils';
import type { NewsCategory } from '../types/news';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// AI Model Configuration
interface AIModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'local';
  model: string;
  enabled: boolean;
  priority: number;
}

const DEFAULT_AI_MODELS: AIModelConfig[] = [
  { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 1 },
  { provider: 'anthropic', model: 'claude-3-sonnet', enabled: true, priority: 2 },
  { provider: 'google', model: 'gemini-pro', enabled: false, priority: 3 },
  { provider: 'openrouter', model: 'auto', enabled: false, priority: 4 },
];

const NEWS_CATEGORIES: { value: NewsCategory | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All Categories', icon: '🌐' },
  { value: 'artificial-intelligence', label: 'AI Research', icon: '🤖' },
  { value: 'machine-learning', label: 'Machine Learning', icon: '🧠' },
  { value: 'tech-news', label: 'Tech News', icon: '💻' },
  { value: 'industry', label: 'Industry News', icon: '🏢' },
  { value: 'research', label: 'Research Papers', icon: '📚' },
];

const REFRESH_INTERVALS = [
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 1800000, label: '30 minutes' },
  { value: 3600000, label: '1 hour' },
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  // Safe store hooks
  const {
    preferences,
    updatePreferences
  } = useUserPreferences();
  
  const {
    theme,
    layout,
    fontSize,
    density,
    showThumbnails,
    animations,
    setTheme,
    setLayout,
    setFontSize,
    setDensity,
    setShowThumbnails,
    setAnimations
  } = useUISettings();
  
  const { clearCache, refreshNews } = useNewsState();
  
  // Local state for form management
  const [activeTab, setActiveTab] = useState<'general' | 'display' | 'news' | 'ai' | 'advanced'>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [aiModels, setAiModels] = useState<AIModelConfig[]>(DEFAULT_AI_MODELS);
  const [isResetting, setIsResetting] = useState(false);
  
  // Safe callbacks with circuit breaker protection
  const [handleClose] = useSafeCallback(() => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose], {
    callbackId: 'settingsPanel-handleClose',
    maxExecutionsPerSecond: 2
  });
  
  const [handleSave] = useSafeCallback(async () => {
    try {
      // Save AI model configurations to preferences
      await updatePreferences({
        aiModels: aiModels,
        lastSettingsUpdate: new Date().toISOString()
      });
      
      setHasUnsavedChanges(false);
      
      // Show success feedback
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[60]';
      successMsg.textContent = 'Settings saved successfully!';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Show error feedback
      const errorMsg = document.createElement('div');
      errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-[60]';
      errorMsg.textContent = 'Failed to save settings. Please try again.';
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 3000);
    }
  }, [aiModels, updatePreferences], {
    callbackId: 'settingsPanel-handleSave',
    maxExecutionsPerSecond: 1
  });
  
  const [handleReset] = useSafeCallback(async () => {
    const confirm = window.confirm('This will reset all settings to default values. Are you sure?');
    if (!confirm) return;
    
    setIsResetting(true);
    
    try {
      // Reset to defaults
      await updatePreferences({
        defaultCategory: 'all',
        articlesPerPage: 20,
        autoRefresh: false,
        refreshInterval: 300000,
        compactView: false,
        darkMode: false,
        notifications: false,
        emailNotifications: false,
        pushNotifications: false,
        saveReadingProgress: true,
        showTrendingTopics: true,
        enableOfflineMode: false,
      });
      
      setTheme('system');
      setLayout('list');
      setFontSize('medium');
      setDensity('comfortable');
      setShowThumbnails(true);
      setAnimations(true);
      
      setAiModels(DEFAULT_AI_MODELS);
      setHasUnsavedChanges(false);
      
      // Clear cache to refresh with new settings
      clearCache();
      
    } catch (error) {
      console.error('Failed to reset settings:', error);
    } finally {
      setIsResetting(false);
    }
  }, [updatePreferences, setTheme, setLayout, setFontSize, setDensity, setShowThumbnails, setAnimations, clearCache], {
    callbackId: 'settingsPanel-handleReset',
    maxExecutionsPerSecond: 1
  });
  
  // Safe preference updaters
  const [updatePreference] = useSafeCallback((key: string, value: any) => {
    updatePreferences({ [key]: value });
    setHasUnsavedChanges(true);
  }, [updatePreferences], {
    callbackId: 'settingsPanel-updatePreference',
    maxExecutionsPerSecond: 10
  });
  
  // Safe UI setting updaters  
  const [updateUISettings] = useSafeCallback((updates: any) => {
    Object.entries(updates).forEach(([key, value]) => {
      switch (key) {
        case 'theme': setTheme(value as any); break;
        case 'layout': setLayout(value as any); break;
        case 'fontSize': setFontSize(value as any); break;
        case 'density': setDensity(value as any); break;
        case 'showThumbnails': setShowThumbnails(value as boolean); break;
        case 'animations': setAnimations(value as boolean); break;
      }
    });
  }, [setTheme, setLayout, setFontSize, setDensity, setShowThumbnails, setAnimations], {
    callbackId: 'settingsPanel-updateUISettings', 
    maxExecutionsPerSecond: 5
  });
  
  // Safe AI model management
  const [updateAIModel] = useSafeCallback((index: number, updates: Partial<AIModelConfig>) => {
    const newModels = [...aiModels];
    newModels[index] = { ...newModels[index], ...updates };
    setAiModels(newModels);
    setHasUnsavedChanges(true);
  }, [aiModels], {
    callbackId: 'settingsPanel-updateAIModel',
    maxExecutionsPerSecond: 5
  });
  
  // Memoized tab content for performance
  const [tabContent] = useSafeMemo(() => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralSettings
            preferences={preferences}
            onUpdatePreference={updatePreference}
          />
        );
      case 'display':
        return (
          <DisplaySettings
            theme={theme}
            layout={layout}
            fontSize={fontSize}
            density={density}
            showThumbnails={showThumbnails}
            animations={animations}
            onUpdateUISettings={updateUISettings}
          />
        );
      case 'news':
        return (
          <NewsSettings
            preferences={preferences}
            onUpdatePreference={updatePreference}
            onRefreshNews={refreshNews}
          />
        );
      case 'ai':
        return (
          <AISettings
            models={aiModels}
            onUpdateModel={updateAIModel}
          />
        );
      case 'advanced':
        return (
          <AdvancedSettings
            preferences={preferences}
            onUpdatePreference={updatePreference}
            onClearCache={clearCache}
          />
        );
      default:
        return null;
    }
  }, [activeTab, preferences, theme, layout, fontSize, density, showThumbnails, animations, aiModels], {
    memoId: 'settingsPanel-tabContent',
    maxComputationsPerSecond: 5
  });
  
  // Keyboard shortcuts
  useSafeEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleSave], {
    effectId: 'settingsPanel-keyboardShortcuts',
    maxExecutionsPerSecond: 1
  });
  
  if (!isOpen) return null;
  
  return (
    <SafeComponentErrorBoundary componentId="settings-panel">
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  AI News Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize your news experience
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Unsaved changes</span>
                </div>
              )}
              
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200",
                  hasUnsavedChanges
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                )}
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all duration-200"
              >
                <RotateCcw className={cn("w-4 h-4", isResetting && "animate-spin")} />
                <span>Reset</span>
              </button>
              
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex h-[calc(90vh-120px)]">
            {/* Sidebar Navigation */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <nav className="p-4 space-y-2">
                {[
                  { id: 'general', label: 'General', icon: Settings },
                  { id: 'display', label: 'Display', icon: Palette },
                  { id: 'news', label: 'News & Sources', icon: Globe },
                  { id: 'ai', label: 'AI Models', icon: Zap },
                  { id: 'advanced', label: 'Advanced', icon: Shield },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-left",
                      activeTab === id
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
              <SafeComponentErrorBoundary componentId={`settings-tab-${activeTab}`}>
                {tabContent}
              </SafeComponentErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </SafeComponentErrorBoundary>
  );
};

// Settings Tab Components
const GeneralSettings: React.FC<{
  preferences: any;
  onUpdatePreference: (key: string, value: any) => void;
}> = ({ preferences, onUpdatePreference }) => (
  <div className="p-6 space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        General Preferences
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Default Category
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose your preferred news category
            </p>
          </div>
          <select
            value={preferences.defaultCategory || 'all'}
            onChange={(e) => onUpdatePreference('defaultCategory', e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {NEWS_CATEGORIES.map(({ value, label, icon }) => (
              <option key={value} value={value}>
                {icon} {label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Articles Per Page
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Number of articles to display
            </p>
          </div>
          <select
            value={preferences.articlesPerPage || 20}
            onChange={(e) => onUpdatePreference('articlesPerPage', parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10 articles</option>
            <option value={20}>20 articles</option>
            <option value={50}>50 articles</option>
            <option value={100}>100 articles</option>
          </select>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Auto-refresh News
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Automatically fetch new articles
            </p>
          </div>
          <button
            onClick={() => onUpdatePreference('autoRefresh', !preferences.autoRefresh)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              preferences.autoRefresh ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                preferences.autoRefresh ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        
        {preferences.autoRefresh && (
          <div className="flex items-center justify-between ml-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Refresh Interval
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                How often to check for new articles
              </p>
            </div>
            <select
              value={preferences.refreshInterval || 300000}
              onChange={(e) => onUpdatePreference('refreshInterval', parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {REFRESH_INTERVALS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  </div>
);

const DisplaySettings: React.FC<{
  theme: string;
  layout: string;
  fontSize: string;
  density: string;
  showThumbnails: boolean;
  animations: boolean;
  onUpdateUISettings: (updates: any) => void;
}> = ({ theme, layout, fontSize, density, showThumbnails, animations, onUpdateUISettings }) => (
  <div className="p-6 space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Display & Appearance
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Theme
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose your preferred color scheme
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {[
              { value: 'light', icon: Sun, label: 'Light' },
              { value: 'dark', icon: Moon, label: 'Dark' },
              { value: 'system', icon: Monitor, label: 'System' }
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => onUpdateUISettings({ theme: value })}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200",
                  theme === value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Layout
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose how articles are displayed
            </p>
          </div>
          <select
            value={layout}
            onChange={(e) => onUpdateUISettings({ layout: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="list">📝 List View</option>
            <option value="grid">⊞ Grid View</option>
            <option value="compact">📄 Compact View</option>
            <option value="masonry">🧱 Masonry View</option>
          </select>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Font Size
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adjust text size for readability
            </p>
          </div>
          <select
            value={fontSize}
            onChange={(e) => onUpdateUISettings({ fontSize: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="xl">Extra Large</option>
          </select>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Content Density
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adjust spacing between elements
            </p>
          </div>
          <select
            value={density}
            onChange={(e) => onUpdateUISettings({ density: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show Thumbnails
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Display article images
            </p>
          </div>
          <button
            onClick={() => onUpdateUISettings({ showThumbnails: !showThumbnails })}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              showThumbnails ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                showThumbnails ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Animations
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enable smooth transitions and effects
            </p>
          </div>
          <button
            onClick={() => onUpdateUISettings({ animations: !animations })}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              animations ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                animations ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  </div>
);

const NewsSettings: React.FC<{
  preferences: any;
  onUpdatePreference: (key: string, value: any) => void;
  onRefreshNews: () => void;
}> = ({ preferences, onUpdatePreference, onRefreshNews }) => (
  <div className="p-6 space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        News Sources & Filtering
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show Trending Topics
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Display popular topics and tags
            </p>
          </div>
          <button
            onClick={() => onUpdatePreference('showTrendingTopics', !preferences.showTrendingTopics)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              preferences.showTrendingTopics ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                preferences.showTrendingTopics ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Save Reading Progress
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Remember which articles you've read
            </p>
          </div>
          <button
            onClick={() => onUpdatePreference('saveReadingProgress', !preferences.saveReadingProgress)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              preferences.saveReadingProgress ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                preferences.saveReadingProgress ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        
        <div className="pt-4">
          <button
            onClick={() => onRefreshNews()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh News Now</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

const AISettings: React.FC<{
  models: AIModelConfig[];
  onUpdateModel: (index: number, updates: Partial<AIModelConfig>) => void;
}> = ({ models, onUpdateModel }) => (
  <div className="p-6 space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        AI Model Configuration
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Configure AI models for enhanced news processing and summaries
      </p>
      
      <div className="space-y-4">
        {models.map((model, index) => (
          <div key={`${model.provider}-${index}`} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  model.enabled ? "bg-green-500" : "bg-gray-400"
                )} />
                <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                  {model.provider}
                </h4>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {model.model}
                </span>
              </div>
              
              <button
                onClick={() => onUpdateModel(index, { enabled: !model.enabled })}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  model.enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    model.enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            
            {model.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model.model}
                    onChange={(e) => onUpdateModel(index, { model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter model name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority (lower = higher priority)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={model.priority}
                    onChange={(e) => onUpdateModel(index, { priority: parseInt(e.target.value) })}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
              AI Enhancement Ready
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              AI models are configured for enhanced news summaries, categorization, and relevance scoring.
              Enable the models you want to use and configure their priority order.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AdvancedSettings: React.FC<{
  preferences: any;
  onUpdatePreference: (key: string, value: any) => void;
  onClearCache: () => void;
}> = ({ preferences, onUpdatePreference, onClearCache }) => (
  <div className="p-6 space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Advanced Settings
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Offline Mode
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cache articles for offline reading
            </p>
          </div>
          <button
            onClick={() => onUpdatePreference('enableOfflineMode', !preferences.enableOfflineMode)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              preferences.enableOfflineMode ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                preferences.enableOfflineMode ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        
        <div className="pt-4">
          <button
            onClick={() => onClearCache()}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Clear Cache</span>
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            This will clear all cached news data and force a fresh reload
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default SettingsPanel;