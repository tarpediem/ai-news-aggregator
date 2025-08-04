import axios from 'axios';
import type { AxiosResponse } from 'axios';

import type { 
  AIModel, 
  AISettings, 
  OpenRouterModel, 
  SummarizationOptions, 
  SummarizationResult, 
  UsageStats, 
  AIServiceError,
  AIServiceConfig
} from '../types/ai';
import { AVAILABLE_MODELS } from '../types/ai';

export class AIService {
  private config: AIServiceConfig;
  private settings: AISettings | null = null;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(config: AIServiceConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    rateLimit: {
      requests: 60,
      window: 60000
    }
  }) {
    this.config = config;
    this.loadSettings();
  }

  // Settings Management
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('ai-settings');
      if (saved) {
        this.settings = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }
  }

  public saveSettings(settings: AISettings): void {
    this.settings = settings;
    try {
      localStorage.setItem('ai-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  public getSettings(): AISettings | null {
    return this.settings;
  }

  public clearSettings(): void {
    this.settings = null;
    try {
      localStorage.removeItem('ai-settings');
    } catch (error) {
      console.error('Failed to clear AI settings:', error);
    }
  }

  // Rate Limiting
  private checkRateLimit(): void {
    const now = Date.now();
    if (now - this.windowStart > this.config.rateLimit.window) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    if (this.requestCount >= this.config.rateLimit.requests) {
      throw new AIServiceError({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please try again later.',
        retryable: true,
        retryAfter: this.config.rateLimit.window - (now - this.windowStart)
      });
    }

    this.requestCount++;
  }

  // Model Management
  public async fetchAvailableModels(): Promise<AIModel[]> {
    if (!this.settings?.apiKey) {
      return AVAILABLE_MODELS;
    }

    try {
      this.checkRateLimit();
      
      const response = await axios.get<{ data: OpenRouterModel[] }>(
        'https://openrouter.ai/api/v1/models',
        {
          headers: {
            'Authorization': `Bearer ${this.settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.config.timeout
        }
      );

      const openRouterModels = response.data.data.map(this.transformOpenRouterModel);
      
      // Merge with predefined models and remove duplicates
      const allModels = [...AVAILABLE_MODELS];
      openRouterModels.forEach(model => {
        const existingIndex = allModels.findIndex(m => m.id === model.id);
        if (existingIndex >= 0) {
          allModels[existingIndex] = model;
        } else {
          allModels.push(model);
        }
      });

      return allModels;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return AVAILABLE_MODELS;
    }
  }

  private transformOpenRouterModel(orModel: OpenRouterModel): AIModel {
    const getCategory = (id: string): 'budget' | 'balanced' | 'premium' => {
      if (id.includes('mini') || id.includes('flash') || id.includes('8b')) return 'budget';
      if (id.includes('405b') || id.includes('claude-3-opus') || id.includes('o3')) return 'premium';
      return 'balanced';
    };

    const getCapabilities = (id: string, name: string): AIModel['capabilities'] => {
      const caps: AIModel['capabilities'] = ['text'];
      if (id.includes('gpt-4') || id.includes('claude') || id.includes('gemini')) {
        caps.push('image');
      }
      if (id.includes('gpt-4') || id.includes('claude') || id.includes('gemini')) {
        caps.push('tool_calling');
      }
      if (id.includes('o3') || id.includes('claude') || id.includes('reasoning')) {
        caps.push('reasoning');
      }
      if (id.includes('code') || id.includes('llama') || id.includes('codestral')) {
        caps.push('code');
      }
      return caps;
    };

    return {
      id: orModel.id,
      name: orModel.name,
      provider: 'openrouter',
      description: orModel.description || 'AI model via OpenRouter',
      context_length: orModel.context_length,
      pricing: {
        input: parseFloat(orModel.pricing.prompt) * 1000000,
        output: parseFloat(orModel.pricing.completion) * 1000000
      },
      capabilities: getCapabilities(orModel.id, orModel.name),
      category: getCategory(orModel.id),
      max_tokens: orModel.top_provider?.max_completion_tokens,
      supports_streaming: true,
      supports_tools: orModel.id.includes('gpt-4') || orModel.id.includes('claude')
    };
  }

  // API Key Validation
  public async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.status === 200 && response.data?.data?.label;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  // Content Summarization
  public async summarizeContent(
    content: string,
    options: SummarizationOptions = {
      length: 'medium',
      format: 'paragraph',
      focus: 'general',
      includeSentiment: false,
      includeKeywords: false
    }
  ): Promise<SummarizationResult> {
    if (!this.settings?.apiKey) {
      throw new AIServiceError({
        code: 'NO_API_KEY',
        message: 'OpenRouter API key not configured',
        retryable: false
      });
    }

    this.checkRateLimit();

    const prompt = this.buildSummarizationPrompt(content, options);
    
    try {
      const response = await this.makeAPIRequest(prompt);
      return this.parseSummarizationResponse(response, options);
    } catch (error) {
      if (this.settings.fallbackModel && error instanceof AIServiceError && error.retryable) {
        // Try with fallback model
        const originalModel = this.settings.selectedModel;
        this.settings.selectedModel = this.settings.fallbackModel;
        
        try {
          const response = await this.makeAPIRequest(prompt);
          return this.parseSummarizationResponse(response, options);
        } finally {
          this.settings.selectedModel = originalModel;
        }
      }
      throw error;
    }
  }

  private buildSummarizationPrompt(content: string, options: SummarizationOptions): string {
    let prompt = `Please summarize the following AI/tech news article:\n\n${content}\n\n`;
    
    // Add length instruction
    const lengthMap = {
      short: '1-2 sentences',
      medium: '2-3 sentences',
      long: '4-5 sentences'
    };
    prompt += `Summary length: ${lengthMap[options.length]}\n`;
    
    // Add format instruction
    if (options.format === 'bullets') {
      prompt += 'Format: Use bullet points\n';
    } else if (options.format === 'structured') {
      prompt += 'Format: Include headline, key points, and conclusion\n';
    }
    
    // Add focus instruction
    const focusMap = {
      general: 'Focus on the main points',
      technical: 'Focus on technical details and innovations',
      business: 'Focus on business impact and market implications',
      research: 'Focus on research findings and methodologies'
    };
    prompt += `${focusMap[options.focus]}\n`;
    
    // Add optional features
    if (options.includeSentiment) {
      prompt += 'Include sentiment analysis (positive/negative/neutral)\n';
    }
    
    if (options.includeKeywords) {
      prompt += 'Include 3-5 key technical terms\n';
    }
    
    return prompt;
  }

  private async makeAPIRequest(prompt: string): Promise<AxiosResponse> {
    const requestData = {
      model: this.settings!.selectedModel,
      messages: [
        {
          role: 'user' as const,
          content: prompt
        }
      ],
      max_tokens: this.settings!.maxTokens,
      temperature: this.settings!.temperature,
      stream: this.settings!.enableStreaming
    };

    let lastError: any;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${this.settings!.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.href,
              'X-Title': 'AI News Hub'
            },
            timeout: this.config.timeout
          }
        );

        return response;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on auth errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new AIServiceError({
            code: 'INVALID_API_KEY',
            message: 'Invalid API key',
            retryable: false
          });
        }
        
        // Don't retry on quota exceeded
        if (error.response?.status === 402) {
          throw new AIServiceError({
            code: 'QUOTA_EXCEEDED',
            message: 'API quota exceeded',
            retryable: false
          });
        }
        
        // Wait before retry
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }

    throw new AIServiceError({
      code: 'REQUEST_FAILED',
      message: lastError?.message || 'Request failed after retries',
      details: lastError,
      retryable: true
    });
  }

  private parseSummarizationResponse(
    response: AxiosResponse, 
    options: SummarizationOptions
  ): SummarizationResult {
    const choice = response.data.choices?.[0];
    if (!choice) {
      throw new Error('No response from AI model');
    }

    const content = choice.message.content;
    const usage = response.data.usage;
    
    // Parse content based on options
    const summary = content;
    let keyPoints: string[] | undefined;
    let sentiment: 'positive' | 'negative' | 'neutral' | undefined;
    let keywords: string[] | undefined;

    // Extract sentiment if requested
    if (options.includeSentiment) {
      const sentimentMatch = content.match(/sentiment:\s*(positive|negative|neutral)/i);
      sentiment = sentimentMatch?.[1]?.toLowerCase();
    }

    // Extract keywords if requested
    if (options.includeKeywords) {
      const keywordMatch = content.match(/keywords?:\s*([^\n]+)/i);
      if (keywordMatch) {
        keywords = keywordMatch[1].split(',').map(k => k.trim());
      }
    }

    // Calculate cost (rough estimate)
    const inputCost = (usage?.prompt_tokens || 0) * 0.000003; // $3 per 1M tokens
    const outputCost = (usage?.completion_tokens || 0) * 0.000015; // $15 per 1M tokens
    const cost = inputCost + outputCost;

    return {
      summary,
      keyPoints,
      sentiment,
      keywords,
      confidence: 0.85, // Default confidence
      model: this.settings!.selectedModel,
      tokensUsed: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0
      },
      cost
    };
  }

  // Batch summarization
  public async summarizeBatch(
    articles: { id: string; title: string; content: string }[],
    options: SummarizationOptions = {
      length: 'medium',
      format: 'paragraph',
      focus: 'general',
      includeSentiment: false,
      includeKeywords: false
    }
  ): Promise<{ id: string; result: SummarizationResult | null; error?: string }[]> {
    const results = [];
    
    for (const article of articles) {
      try {
        const result = await this.summarizeContent(
          `${article.title}\n\n${article.content}`,
          options
        );
        results.push({ id: article.id, result });
      } catch (error: any) {
        results.push({ 
          id: article.id, 
          result: null, 
          error: error.message 
        });
      }
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  // Usage Statistics (mock implementation)
  public async getUsageStats(period: 'hour' | 'day' | 'week' | 'month'): Promise<UsageStats> {
    // In a real implementation, this would fetch from your backend
    return {
      requests: 45,
      tokensUsed: 12500,
      cost: 0.15,
      period,
      limit: period === 'day' ? this.settings?.costLimit?.daily : this.settings?.costLimit?.monthly,
      remaining: 0.85
    };
  }

  // Synchronous version for immediate access
  public getCurrentUsageStats(): { totalRequests: number; totalTokens: number } {
    // Mock implementation for immediate stats
    return {
      totalRequests: this.requestCount,
      totalTokens: this.requestCount * 500 // Rough estimate
    };
  }

  // Article-specific methods for AI enhancement features
  public async summarizeArticle(title: string, description: string): Promise<string> {
    const content = `${title}\n\n${description}`;
    const result = await this.summarizeContent(content, {
      length: 'medium',
      format: 'paragraph',
      focus: 'general',
      includeSentiment: false,
      includeKeywords: false
    });
    return result.summary;
  }

  public async generateTags(article: { title: string; description: string; content?: string }): Promise<string[]> {
    if (!this.settings?.apiKey) {
      // Return mock tags when no API key is configured
      return ['ai', 'technology', 'news'];
    }

    try {
      const content = `${article.title}\n\n${article.description}\n\n${article.content || ''}`;
      const prompt = `Generate 3-5 relevant tags for this AI/tech news article. Return only the tags separated by commas:\n\n${content}`;
      
      const response = await this.makeAPIRequest(prompt);
      const tagsText = response.data.choices?.[0]?.message?.content || '';
      
      return tagsText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0).slice(0, 5);
    } catch (error) {
      console.error('Failed to generate tags:', error);
      return ['ai', 'technology', 'news'];
    }
  }

  public async analyzeRelevance(
    article: { title: string; description: string; content?: string },
    interests: string[]
  ): Promise<number> {
    if (!this.settings?.apiKey) {
      // Return mock relevance score when no API key is configured
      return Math.random() * 10;
    }

    try {
      const content = `${article.title}\n\n${article.description}\n\n${article.content || ''}`;
      const prompt = `Rate the relevance of this article to these interests: ${interests.join(', ')} on a scale of 0-10. Return only the number:\n\n${content}`;
      
      const response = await this.makeAPIRequest(prompt);
      const scoreText = response.data.choices?.[0]?.message?.content || '5';
      const score = parseFloat(scoreText.trim());
      
      return isNaN(score) ? 5 : Math.max(0, Math.min(10, score));
    } catch (error) {
      console.error('Failed to analyze relevance:', error);
      return 5;
    }
  }

  public async enhanceSearchQuery(query: string, context: string): Promise<string> {
    if (!this.settings?.apiKey) {
      // Return enhanced query without API when no key is configured
      return `${query} (AI news technology)`;
    }

    try {
      const prompt = `Enhance this search query for ${context}: "${query}". Make it more specific and effective. Return only the enhanced query:`;
      
      const response = await this.makeAPIRequest(prompt);
      const enhancedQuery = response.data.choices?.[0]?.message?.content || query;
      
      return enhancedQuery.trim().replace(/^["']|["']$/g, '');
    } catch (error) {
      console.error('Failed to enhance search query:', error);
      return query;
    }
  }

  public async testConnection(): Promise<boolean> {
    if (!this.settings?.apiKey) {
      return false;
    }

    try {
      const response = await this.makeAPIRequest('Test connection. Reply with "OK".');
      return response.status === 200 && response.data.choices?.[0]?.message?.content;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

// Custom error class
class AIServiceError extends Error {
  public code: string;
  public retryable: boolean;
  public retryAfter?: number;
  public details?: any;

  constructor(error: AIServiceError) {
    super(error.message);
    this.code = error.code;
    this.retryable = error.retryable;
    this.retryAfter = error.retryAfter;
    this.details = error.details;
    this.name = 'AIServiceError';
  }
}

// Singleton instance
export const aiService = new AIService();