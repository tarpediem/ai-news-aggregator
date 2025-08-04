/**
 * Enhanced Settings panel component for managing application preferences
 * Includes API key management and model selection functionality
 * Integrates with the advanced state management system
 */

import { Eye, EyeOff, Key, Settings, Palette, Activity, Database, Shield, Zap, Search, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import React, { useState, useCallback, useEffect } from 'react';

import { aiService } from '../services/aiService';
import { useUISettings, useUserPreferences, useAppStore } from '../store/AppStore';
import type { AIModel, AISettings } from '../types/ai';
import { AVAILABLE_MODELS, DEFAULT_AI_SETTINGS, MODEL_CAPABILITIES } from '../types/ai';

import { useAccessibility , AccessibilitySettings , FocusTrap } from './AccessibilityProvider';
import { InteractiveHoverButton } from './ui/interactive-hover-button';
import { ShimmerButton } from './ui/shimmer-button';


interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Convert AI service settings to internal format for compatibility
const convertToLegacySettings = (aiSettings: AISettings | null) => {
  if (!aiSettings) return getDefaultSettings();
  
  return {
    openrouterApiKey: aiSettings.apiKey,
    selectedModel: aiSettings.selectedModel,
    maxTokens: aiSettings.maxTokens,
    temperature: aiSettings.temperature,
    useStreamingMode: aiSettings.enableStreaming,
    enableModelFallback: !!aiSettings.fallbackModel,
    fallbackModel: aiSettings.fallbackModel || 'openai/gpt-4o-mini'
  };
};

const convertFromLegacySettings = (legacySettings: any): AISettings => {
  return {
    provider: 'openrouter',
    apiKey: legacySettings.openrouterApiKey || '',
    selectedModel: legacySettings.selectedModel || DEFAULT_AI_SETTINGS.selectedModel,
    temperature: legacySettings.temperature || DEFAULT_AI_SETTINGS.temperature,
    maxTokens: legacySettings.maxTokens || DEFAULT_AI_SETTINGS.maxTokens,
    enableStreaming: legacySettings.useStreamingMode || DEFAULT_AI_SETTINGS.enableStreaming,
    fallbackModel: legacySettings.enableModelFallback ? legacySettings.fallbackModel : undefined,
    costLimit: DEFAULT_AI_SETTINGS.costLimit
  };
};

const getDefaultSettings = () => {
  return {
    openrouterApiKey: '',
    selectedModel: 'openai/gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
    useStreamingMode: true,
    enableModelFallback: true,
    fallbackModel: 'openai/gpt-4o-mini'
  };
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai-models' | 'appearance' | 'accessibility' | 'data' | 'security'>('general');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [importData, setImportData] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);

  // AI Settings State
  const [availableModels, setAvailableModels] = useState<AIModel[]>(AVAILABLE_MODELS);
  const [apiSettings, setApiSettings] = useState(() => convertToLegacySettings(aiService.getSettings()));
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<'success' | 'error' | null>(null);
  const [searchModelQuery, setSearchModelQuery] = useState('');
  const [selectedModelCategory, setSelectedModelCategory] = useState<'all' | 'budget' | 'balanced' | 'premium'>('all');

  const uiSettings = useUISettings();
  const userPreferences = useUserPreferences();
  const { exportData, importData: importStoreData, reset, getStats } = useAppStore();
  const { announceMessage } = useAccessibility();

  const stats = getStats();

  // Load models when API key is set
  useEffect(() => {
    const loadModels = async () => {
      if (apiSettings.openrouterApiKey && apiSettings.openrouterApiKey.trim().length > 0) {
        setIsLoadingModels(true);
        try {
          const models = await aiService.fetchAvailableModels();
          setAvailableModels(models);
        } catch (error) {
          console.error('Failed to load models:', error);
          // Reset to default models on error to prevent infinite loading
          setAvailableModels(AVAILABLE_MODELS);
        } finally {
          setIsLoadingModels(false);
        }
      }
    };
    
    // Only load if the API key is actually set and different from empty string
    const apiKey = apiSettings.openrouterApiKey;
    if (apiKey && apiKey.trim().length > 0) {
      loadModels();
    }
  }, [apiSettings.openrouterApiKey]);

  // Update API settings and save to AI service
  const updateAPISettings = useCallback((updates: Partial<typeof apiSettings>) => {
    const newSettings = { ...apiSettings, ...updates };
    setApiSettings(newSettings);
    
    // Convert to AI settings format and save
    const aiSettings = convertFromLegacySettings(newSettings);
    aiService.saveSettings(aiSettings);
    
    announceMessage('AI settings updated');
  }, [apiSettings, announceMessage]);

  // Test API key validity
  const testApiKey = useCallback(async () => {
    if (!apiSettings.openrouterApiKey.trim()) {
      setApiKeyTestResult('error');
      announceMessage('Please enter an API key first', 'assertive');
      return;
    }

    setIsTestingApiKey(true);
    setApiKeyTestResult(null);

    try {
      const isValid = await aiService.validateApiKey(apiSettings.openrouterApiKey);
      
      if (isValid) {
        setApiKeyTestResult('success');
        announceMessage('API key is valid');
        
        // Refresh models with the new key
        setIsLoadingModels(true);
        try {
          const models = await aiService.fetchAvailableModels();
          setAvailableModels(models);
        } catch (error) {
          console.error('Failed to refresh models:', error);
        } finally {
          setIsLoadingModels(false);
        }
      } else {
        setApiKeyTestResult('error');
        announceMessage('API key is invalid', 'assertive');
      }
    } catch (error) {
      setApiKeyTestResult('error');
      announceMessage('Failed to test API key', 'assertive');
    } finally {
      setIsTestingApiKey(false);
    }
  }, [apiSettings.openrouterApiKey, announceMessage]);

  // Filter models based on search and category
  const filteredModels = availableModels.filter(model => {
    const matchesCategory = selectedModelCategory === 'all' || model.category === selectedModelCategory;
    const matchesSearch = searchModelQuery === '' || 
      model.name.toLowerCase().includes(searchModelQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchModelQuery.toLowerCase()) ||
      model.capabilities.some(cap => cap.toLowerCase().includes(searchModelQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  // Get selected model details
  const selectedModel = availableModels.find(m => m.id === apiSettings.selectedModel);

  // Reset API settings to defaults
  const resetAPISettings = useCallback(() => {
    const defaultSettings = getDefaultSettings();
    setApiSettings(defaultSettings);
    
    // Save to AI service
    const aiSettings = convertFromLegacySettings(defaultSettings);
    aiService.saveSettings(aiSettings);
    
    setApiKeyTestResult(null);
    setAvailableModels(AVAILABLE_MODELS);
    announceMessage('AI settings reset to defaults');
  }, [announceMessage]);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-news-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
    announceMessage('Settings exported successfully');
  };

  // Note: Import functionality handled in inline click handler below

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
      reset();
      announceMessage('Settings reset to default');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-panel fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <FocusTrap active={isOpen} onEscape={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              aria-label="Close settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 dark:bg-gray-800 p-4 border-r border-gray-200 dark:border-gray-700">
              <nav className="space-y-2">
                {[
                  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
                  { id: 'ai-models', label: 'AI Models', icon: <Zap className="w-4 h-4" /> },
                  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
                  { id: 'accessibility', label: 'Accessibility', icon: <Activity className="w-4 h-4" /> },
                  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
                  { id: 'data', label: 'Data & Privacy', icon: <Database className="w-4 h-4" /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">General Preferences</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Default Category
                        </label>
                        <select
                          value={userPreferences.preferences.defaultCategory}
                          onChange={(e) => userPreferences.updatePreferences({
                            defaultCategory: e.target.value as any
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">All Categories</option>
                          <option value="artificial-intelligence">Artificial Intelligence</option>
                          <option value="machine-learning">Machine Learning</option>
                          <option value="deep-learning">Deep Learning</option>
                          <option value="nlp">Natural Language Processing</option>
                          <option value="computer-vision">Computer Vision</option>
                          <option value="robotics">Robotics</option>
                          <option value="research">Research</option>
                          <option value="industry">Industry</option>
                          <option value="startups">Startups</option>
                          <option value="tech-news">Tech News</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Articles per Page
                        </label>
                        <select
                          value={userPreferences.preferences.articlesPerPage}
                          onChange={(e) => userPreferences.updatePreferences({
                            articlesPerPage: parseInt(e.target.value)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="auto-refresh"
                          checked={userPreferences.preferences.autoRefresh}
                          onChange={(e) => userPreferences.updatePreferences({
                            autoRefresh: e.target.checked
                          })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="auto-refresh" className="text-sm font-medium text-gray-700">
                          Auto-refresh articles
                        </label>
                      </div>

                      {userPreferences.preferences.autoRefresh && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Refresh Interval (minutes)
                          </label>
                          <select
                            value={userPreferences.preferences.refreshInterval / 60000}
                            onChange={(e) => userPreferences.updatePreferences({
                              refreshInterval: parseInt(e.target.value) * 60000
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={5}>5 minutes</option>
                            <option value={10}>10 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                          </select>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="notifications"
                          checked={userPreferences.preferences.notifications}
                          onChange={(e) => userPreferences.updatePreferences({
                            notifications: e.target.checked
                          })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="notifications" className="text-sm font-medium text-gray-700">
                          Enable notifications
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900">{stats.totalArticles}</div>
                        <div className="text-sm text-gray-500">Total Articles</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900">{stats.bookmarkedArticles}</div>
                        <div className="text-sm text-gray-500">Bookmarked</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900">{stats.readArticles}</div>
                        <div className="text-sm text-gray-500">Read Articles</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900">{stats.sourcesVisited}</div>
                        <div className="text-sm text-gray-500">Sources Visited</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ai-models' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                      <Key className="w-5 h-5" />
                      <span>API Configuration</span>
                    </h3>
                    
                    <div className="space-y-4">
                      {/* API Key Management */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            OpenRouter API Key
                          </label>
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex-1 relative">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={apiSettings.openrouterApiKey}
                              onChange={(e) => updateAPISettings({ openrouterApiKey: e.target.value })}
                              placeholder="sk-or-..."
                              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                              aria-describedby="api-key-help"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              aria-label={showApiKey ? "Hide API key" : "Show API key"}
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <ShimmerButton
                            onClick={testApiKey}
                            disabled={isTestingApiKey || !apiSettings.openrouterApiKey.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            shimmerColor="#ffffff"
                            background="rgba(37, 99, 235, 1)"
                          >
                            {isTestingApiKey ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            <span>{isTestingApiKey ? 'Testing...' : 'Test Key'}</span>
                          </ShimmerButton>
                        </div>
                        
                        {/* API Key Test Result */}
                        {apiKeyTestResult && (
                          <div className={`mt-2 flex items-center space-x-2 text-sm ${
                            apiKeyTestResult === 'success' 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {apiKeyTestResult === 'success' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            <span>
                              {apiKeyTestResult === 'success' 
                                ? 'API key is valid and working' 
                                : 'API key is invalid or expired'
                              }
                            </span>
                          </div>
                        )}
                        
                        <p id="api-key-help" className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">OpenRouter</a>
                        </p>
                      </div>

                      {/* Model Selection */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center space-x-2">
                          <Zap className="w-4 h-4" />
                          <span>Model Selection</span>
                        </h4>
                        
                        {/* Search and Filter */}
                        <div className="flex space-x-3 mb-4">
                          <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="text"
                              value={searchModelQuery}
                              onChange={(e) => setSearchModelQuery(e.target.value)}
                              placeholder="Search models..."
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <select
                            value={selectedModelCategory}
                            onChange={(e) => setSelectedModelCategory(e.target.value as any)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          >
                            <option value="all">All Categories</option>
                            <option value="budget">Budget</option>
                            <option value="balanced">Balanced</option>
                            <option value="premium">Premium</option>
                          </select>
                        </div>

                        {/* Loading State */}
                        {isLoadingModels && (
                          <div className="flex items-center justify-center py-8">
                            <Loader className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading models...</span>
                          </div>
                        )}

                        {/* Model Grid */}
                        <div className="grid gap-3 max-h-96 overflow-y-auto">
                          {filteredModels.map((model) => (
                            <div
                              key={model.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                apiSettings.selectedModel === model.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                              }`}
                              onClick={() => updateAPISettings({ selectedModel: model.id })}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h5 className="font-medium text-gray-900 dark:text-gray-100">{model.name}</h5>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      model.category === 'budget' 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : model.category === 'balanced'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                    }`}>
                                      {model.category}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{model.description}</p>
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {model.capabilities.map((cap) => (
                                      <span key={cap} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center space-x-1">
                                        <span>{MODEL_CAPABILITIES[cap]?.icon || '•'}</span>
                                        <span>{MODEL_CAPABILITIES[cap]?.name || cap}</span>
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                    <span>Input: ${model.pricing.input}/1M tokens</span>
                                    <span>Output: ${model.pricing.output}/1M tokens</span>
                                    <span>Context: {model.context_length.toLocaleString()}</span>
                                  </div>
                                </div>
                                {apiSettings.selectedModel === model.id && (
                                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {filteredModels.length === 0 && (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                            <p>No models match your search criteria</p>
                          </div>
                        )}
                      </div>

                      {/* Selected Model Preview */}
                      {selectedModel && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Selected Model</h4>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p><strong className="text-gray-900 dark:text-gray-100">{selectedModel.name}</strong> by {selectedModel.provider}</p>
                            <p className="mt-1">{selectedModel.description}</p>
                            <div className="mt-2 flex items-center space-x-4">
                              <span>Input: ${selectedModel.pricing.input}/1M</span>
                              <span>Output: ${selectedModel.pricing.output}/1M</span>
                              <span>Context: {selectedModel.context_length.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Advanced Settings */}
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Advanced Settings</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Max Tokens
                            </label>
                            <input
                              type="number"
                              value={apiSettings.maxTokens}
                              onChange={(e) => updateAPISettings({ maxTokens: parseInt(e.target.value) || 4096 })}
                              min="1"
                              max="32768"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Temperature ({apiSettings.temperature})
                            </label>
                            <input
                              type="range"
                              value={apiSettings.temperature}
                              onChange={(e) => updateAPISettings({ temperature: parseFloat(e.target.value) })}
                              min="0"
                              max="2"
                              step="0.1"
                              className="w-full"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={apiSettings.useStreamingMode}
                              onChange={(e) => updateAPISettings({ useStreamingMode: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Enable streaming mode</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={apiSettings.enableModelFallback}
                              onChange={(e) => updateAPISettings({ enableModelFallback: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Enable model fallback</span>
                          </label>
                        </div>
                      </div>

                      {/* API Settings Actions */}
                      <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <InteractiveHoverButton
                          onClick={resetAPISettings}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                        >
                          Reset to Defaults
                        </InteractiveHoverButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                      <Palette className="w-5 h-5" />
                      <span>Appearance</span>
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Theme
                        </label>
                        <select
                          value={uiSettings.theme}
                          onChange={(e) => uiSettings.setTheme(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="system">System</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Layout
                        </label>
                        <select
                          value={uiSettings.layout}
                          onChange={(e) => uiSettings.setLayout(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="list">List</option>
                          <option value="grid">Grid</option>
                          <option value="compact">Compact</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Font Size
                        </label>
                        <select
                          value={uiSettings.fontSize}
                          onChange={(e) => uiSettings.setFontSize(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Density
                        </label>
                        <select
                          value={uiSettings.density}
                          onChange={(e) => uiSettings.setDensity(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="compact">Compact</option>
                          <option value="comfortable">Comfortable</option>
                          <option value="spacious">Spacious</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Sort By
                        </label>
                        <select
                          value={uiSettings.sortBy}
                          onChange={(e) => uiSettings.setSortBy(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="relevance">Relevance</option>
                          <option value="date">Date</option>
                          <option value="source">Source</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Sort Order
                        </label>
                        <select
                          value={uiSettings.sortOrder}
                          onChange={(e) => uiSettings.setSortOrder(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="desc">Descending</option>
                          <option value="asc">Ascending</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="show-thumbnails"
                          checked={uiSettings.showThumbnails}
                          onChange={(e) => uiSettings.setShowThumbnails(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="show-thumbnails" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Show article thumbnails
                        </label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="pin-sidebar"
                          checked={uiSettings.sidebar.isPinned}
                          onChange={(e) => uiSettings.setSidebarPinned(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="pin-sidebar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Pin sidebar
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'accessibility' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Accessibility</h3>
                    <AccessibilitySettings />
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                      <Shield className="w-5 h-5" />
                      <span>Security & Privacy</span>
                    </h3>
                    
                    <div className="space-y-4">
                      {/* API Key Security */}
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">API Key Storage</h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                              Your API keys are stored locally in your browser's localStorage and are never sent to our servers.
                            </p>
                            <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
                              <li>• Keys are encrypted in transit when communicating with AI providers</li>
                              <li>• Clear your browser data to remove stored keys</li>
                              <li>• Never share your API keys with others</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Privacy Settings */}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Privacy Settings</h4>
                        <div className="space-y-3">
                          <label className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={userPreferences.preferences.notifications}
                              onChange={(e) => userPreferences.updatePreferences({
                                notifications: e.target.checked
                              })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable notifications</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Receive browser notifications for new articles</p>
                            </div>
                          </label>
                          
                          <label className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              defaultChecked={true}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Anonymous usage analytics</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Help improve the app by sharing anonymous usage data</p>
                            </div>
                          </label>

                          <label className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Third-party integrations</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Allow integrations with external services</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Data Retention */}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Data Retention</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex justify-between items-center py-2">
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Search History</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Keep last 10 searches</p>
                            </div>
                            <button
                              onClick={() => {
                                userPreferences.clearSearchHistory();
                                announceMessage('Search history cleared');
                              }}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-md transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                          
                          <div className="flex justify-between items-center py-2">
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reading History</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{userPreferences.readArticles.length} articles tracked</p>
                            </div>
                            <button
                              onClick={() => {
                                // Clear read articles - you'd implement this in the store
                                announceMessage('Reading history cleared');
                              }}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-md transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Security Actions */}
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Security Actions</h4>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              // Clear API keys from aiService
                              aiService.clearSettings();
                              setApiSettings(getDefaultSettings());
                              setApiKeyTestResult(null);
                              announceMessage('API keys cleared from local storage');
                            }}
                            className="w-full px-4 py-2 text-left text-sm bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors flex items-center space-x-2"
                          >
                            <Key className="w-4 h-4" />
                            <span>Clear all stored API keys</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              if (confirm('This will clear all local data including bookmarks, preferences, and API keys. Continue?')) {
                                localStorage.clear();
                                window.location.reload();
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors flex items-center space-x-2"
                          >
                            <Database className="w-4 h-4" />
                            <span>Clear all local data</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                      <Database className="w-5 h-5" />
                      <span>Data Management</span>
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Export Settings</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Export your settings, bookmarks, preferences, and API configurations as a JSON file.
                        </p>
                        <div className="flex space-x-2">
                          <ShimmerButton
                            onClick={() => setShowExportDialog(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            shimmerColor="#ffffff"
                            background="rgba(37, 99, 235, 1)"
                          >
                            Export Data
                          </ShimmerButton>
                          <button
                            onClick={() => {
                              const fullData = {
                                ...JSON.parse(exportData()),
                                apiSettings
                              };
                              const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `ai-news-full-backup-${new Date().toISOString().split('T')[0]}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                              announceMessage('Full backup exported successfully');
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                          >
                            Export Full Backup
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Database className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Import Settings</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Import settings from a previously exported JSON file or full backup.
                        </p>
                        <InteractiveHoverButton
                          onClick={() => setShowImportDialog(true)}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          Import Data
                        </InteractiveHoverButton>
                      </div>

                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Reset Settings</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Reset all settings to their default values. This cannot be undone.
                        </p>
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          Reset All Settings
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Storage Usage */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Storage Usage</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userPreferences.bookmarks.length}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Bookmarks</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userPreferences.readArticles.length}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Read Articles</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userPreferences.searchHistory.length}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Search History</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {apiSettings.openrouterApiKey ? '1' : '0'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">API Keys</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Export Dialog */}
          {showExportDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Export Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will download a JSON file containing your settings, bookmarks, and preferences.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleExport}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => setShowExportDialog(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Import Dialog */}
          {showImportDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Import Data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Paste the JSON data from your exported settings file or full backup below.
                </p>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Paste your exported JSON data here..."
                />
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={() => {
                      try {
                        const imported = JSON.parse(importData);
                        // Handle both regular exports and full backups
                        if (imported.apiSettings) {
                          // Full backup import
                          setApiSettings(imported.apiSettings);
                          const aiSettings = convertFromLegacySettings(imported.apiSettings);
                          aiService.saveSettings(aiSettings);
                          delete imported.apiSettings; // Remove before passing to store
                        }
                        importStoreData(JSON.stringify(imported));
                        setShowImportDialog(false);
                        setImportData('');
                        announceMessage('Data imported successfully');
                      } catch (error) {
                        announceMessage('Failed to import data - invalid JSON format', 'assertive');
                      }
                    }}
                    disabled={!importData.trim()}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import
                  </button>
                  <button
                    onClick={() => {
                      setShowImportDialog(false);
                      setImportData('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
};

export default SettingsPanel;