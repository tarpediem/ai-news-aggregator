// AI Service Types and Interfaces

export interface AIModel {
  id: string;
  name: string;
  provider: 'openrouter' | 'openai' | 'anthropic' | 'local';
  description: string;
  context_length: number;
  pricing: {
    input: number;  // price per 1M tokens
    output: number; // price per 1M tokens
  };
  capabilities: ('text' | 'image' | 'tool_calling' | 'reasoning' | 'code')[];
  category: 'budget' | 'balanced' | 'premium';
  max_tokens?: number;
  supports_streaming?: boolean;
  supports_tools?: boolean;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits?: {
    prompt_tokens: string;
    completion_tokens: string;
  };
}

export interface AISettings {
  provider: 'openrouter' | 'openai' | 'anthropic' | 'local';
  apiKey: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  enableStreaming: boolean;
  fallbackModel?: string;
  costLimit?: {
    daily: number;
    monthly: number;
  };
  customEndpoint?: string;
}

export interface SummarizationOptions {
  length: 'short' | 'medium' | 'long';
  format: 'paragraph' | 'bullets' | 'structured';
  focus: 'general' | 'technical' | 'business' | 'research';
  includeSentiment: boolean;
  includeKeywords: boolean;
  maxSentences?: number;
}

export interface SummarizationResult {
  summary: string;
  keyPoints?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  keywords?: string[];
  confidence: number;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

export interface UsageStats {
  requests: number;
  tokensUsed: number;
  cost: number;
  period: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  remaining?: number;
}

export interface AIServiceError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;
}

export interface ModelCapability {
  name: string;
  description: string;
  icon: string;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  text: {
    name: 'Text Generation',
    description: 'Generate and understand text',
    icon: '📝'
  },
  image: {
    name: 'Image Understanding',
    description: 'Analyze and describe images',
    icon: '🖼️'
  },
  tool_calling: {
    name: 'Tool Calling',
    description: 'Execute functions and tools',
    icon: '🛠️'
  },
  reasoning: {
    name: 'Advanced Reasoning',
    description: 'Complex problem solving',
    icon: '🧠'
  },
  code: {
    name: 'Code Generation',
    description: 'Generate and debug code',
    icon: '💻'
  }
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'openrouter',
  apiKey: '',
  selectedModel: 'anthropic/claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 1000,
  enableStreaming: false,
  costLimit: {
    daily: 5,
    monthly: 50
  }
};

// Model categories with predefined models
export const AVAILABLE_MODELS: AIModel[] = [
  // Budget Models
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    description: 'Fast and cost-effective OpenAI model',
    context_length: 128000,
    pricing: { input: 0.15, output: 0.60 },
    capabilities: ['text', 'image', 'tool_calling'],
    category: 'budget',
    supports_streaming: true,
    supports_tools: true
  },
  {
    id: 'google/gemini-flash-1.5-8b',
    name: 'Gemini Flash 1.5 8B',
    provider: 'openrouter',
    description: 'Google\'s efficient model',
    context_length: 1000000,
    pricing: { input: 0.0375, output: 0.15 },
    capabilities: ['text', 'image'],
    category: 'budget',
    supports_streaming: true
  },
  
  // Balanced Models
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    description: 'OpenAI\'s flagship multimodal model',
    context_length: 128000,
    pricing: { input: 2.5, output: 10 },
    capabilities: ['text', 'image', 'tool_calling', 'reasoning'],
    category: 'balanced',
    supports_streaming: true,
    supports_tools: true
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    provider: 'openrouter',
    description: 'Google\'s advanced model with large context',
    context_length: 2000000,
    pricing: { input: 1.25, output: 5 },
    capabilities: ['text', 'image', 'tool_calling'],
    category: 'balanced',
    supports_streaming: true
  },
  
  // Premium Models
  {
    id: 'anthropic/claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    description: 'Anthropic\'s most capable model',
    context_length: 200000,
    pricing: { input: 3, output: 15 },
    capabilities: ['text', 'image', 'tool_calling', 'reasoning', 'code'],
    category: 'premium',
    supports_streaming: true,
    supports_tools: true
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B',
    provider: 'openrouter',
    description: 'Meta\'s largest open-source model',
    context_length: 131072,
    pricing: { input: 5, output: 15 },
    capabilities: ['text', 'reasoning', 'code'],
    category: 'premium',
    supports_streaming: true
  }
];

export interface AIServiceConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  rateLimit: {
    requests: number;
    window: number; // in milliseconds
  };
}