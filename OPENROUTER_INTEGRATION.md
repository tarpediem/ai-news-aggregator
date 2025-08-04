# OpenRouter Integration Guide

## Overview

AI News Hub now includes comprehensive OpenRouter integration, allowing users to leverage multiple AI models for intelligent content summarization. This guide covers the complete setup and usage of OpenRouter features.

## Features Added

### 🤖 **Multi-Model AI Support**
- **400+ Models**: Access to all OpenRouter models including GPT-4, Claude, Llama, Gemini, and more
- **Real-time Model Discovery**: Dynamically fetch available models from OpenRouter API
- **Smart Categorization**: Models organized by Budget, Balanced, and Premium tiers
- **Live Pricing**: Real-time pricing information for input/output tokens

### 🎛️ **Advanced Settings Panel**
- **API Key Management**: Secure storage and validation of OpenRouter API keys
- **Model Selection**: Interactive model browser with search and filtering
- **Parameter Tuning**: Configurable temperature, max tokens, and streaming options
- **Fallback Support**: Automatic model fallback for enhanced reliability

### 📰 **AI-Enhanced News Cards**
- **One-Click Summarization**: Generate AI summaries for any news article
- **Multiple Formats**: Paragraph, bullet points, or structured summaries
- **Sentiment Analysis**: Optional sentiment detection for articles
- **Keyword Extraction**: Automatic extraction of key technical terms
- **Cost Tracking**: Real-time token usage and cost estimation

### 🔧 **Developer Features**
- **TypeScript Support**: Fully typed interfaces for all AI operations
- **Error Handling**: Comprehensive error recovery and retry mechanisms
- **Rate Limiting**: Built-in protection against API abuse
- **Caching**: Intelligent caching to reduce API calls and costs

## Quick Setup

### 1. Get Your OpenRouter API Key
1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Create an account and generate an API key
3. Copy your key (starts with `sk-or-v1-...`)

### 2. Configure in the App
1. Start the application: `./start-app.sh`
2. Click the **Settings** button in the top navigation
3. Go to the **AI Models** tab
4. Paste your API key and click **Test Key**
5. Select your preferred model from the list

### 3. Use AI Summarization
1. Browse news articles on the main page
2. Click **Generate** on any AI Summary section
3. View the intelligent summary with sentiment and keywords
4. Monitor token usage and costs in real-time

## Available Models

### Budget Tier ($0.04-$0.60 per 1M tokens)
- **GPT-4o Mini**: Fast, cost-effective OpenAI model
- **Gemini Flash 1.5 8B**: Google's efficient model with 1M context
- **Qwen 3 235B**: Ultra-low cost at $0.0001 per token

### Balanced Tier ($1.25-$10 per 1M tokens)
- **GPT-4o**: OpenAI's flagship multimodal model
- **Gemini Pro 1.5**: Advanced model with 2M context length
- **Claude 3 Haiku**: Anthropic's fast and capable model

### Premium Tier ($3-$15 per 1M tokens)
- **Claude 3.5 Sonnet**: Top-tier reasoning and code generation
- **Llama 3.1 405B**: Meta's largest open-source model
- **GPT-4 Turbo**: OpenAI's most advanced model

## API Configuration

### Environment Variables
```env
# OpenRouter Integration
VITE_OPENROUTER_API_URL=https://openrouter.ai/api/v1
VITE_OPENROUTER_MODELS_ENDPOINT=https://openrouter.ai/api/v1/models
VITE_OPENROUTER_AUTH_ENDPOINT=https://openrouter.ai/api/v1/auth/key

# AI Settings
VITE_DEFAULT_AI_MODEL=anthropic/claude-3-5-sonnet-20241022
VITE_AI_MAX_TOKENS=1000
VITE_AI_TEMPERATURE=0.7
VITE_AI_RETRY_ATTEMPTS=3
```

### Settings Storage
- **Local Storage**: API keys and preferences stored securely in browser
- **No Server Storage**: Your API key never leaves your browser
- **Automatic Sync**: Settings persist across browser sessions
- **Export/Import**: Backup and restore complete configurations

## Usage Examples

### Basic Summarization
```typescript
import { aiService } from './services/aiService';

// Configure API key (usually done through Settings UI)
const settings = {
  provider: 'openrouter',
  apiKey: 'sk-or-v1-your-key-here',
  selectedModel: 'anthropic/claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 1000,
  enableStreaming: false
};

aiService.saveSettings(settings);

// Summarize content
const result = await aiService.summarizeContent(
  'Article title and content here...',
  {
    length: 'medium',
    format: 'paragraph',
    focus: 'technical',
    includeSentiment: true,
    includeKeywords: true
  }
);

console.log(result.summary);
console.log(result.sentiment);
console.log(result.keywords);
```

### Batch Processing
```typescript
// Summarize multiple articles
const articles = [
  { id: '1', title: 'AI News', content: 'Content...' },
  { id: '2', title: 'ML Research', content: 'Content...' }
];

const results = await aiService.summarizeBatch(articles, {
  length: 'short',
  format: 'bullets',
  focus: 'business'
});

results.forEach(({ id, result, error }) => {
  if (result) {
    console.log(`Article ${id}: ${result.summary}`);
  } else {
    console.error(`Article ${id} failed: ${error}`);
  }
});
```

### Model Management
```typescript
// Fetch available models
const models = await aiService.fetchAvailableModels();
console.log(`Found ${models.length} models`);

// Validate API key
const isValid = await aiService.validateApiKey('sk-or-v1-...');
console.log(`API key is ${isValid ? 'valid' : 'invalid'}`);

// Get usage statistics
const stats = await aiService.getUsageStats('day');
console.log(`Today: ${stats.requests} requests, $${stats.cost}`);
```

## Advanced Configuration

### Custom Model Parameters
```typescript
const settings = {
  provider: 'openrouter',
  apiKey: 'your-key',
  selectedModel: 'anthropic/claude-3-5-sonnet-20241022',
  temperature: 0.8,        // Higher creativity
  maxTokens: 2000,         // Longer responses
  enableStreaming: true,   // Real-time streaming
  fallbackModel: 'openai/gpt-4o-mini',  // Backup model
  costLimit: {
    daily: 10,             // $10 daily limit
    monthly: 100           // $100 monthly limit
  }
};
```

### Summarization Options
```typescript
const options = {
  length: 'long',           // short | medium | long
  format: 'structured',     // paragraph | bullets | structured
  focus: 'research',        // general | technical | business | research
  includeSentiment: true,   // Include sentiment analysis
  includeKeywords: true,    // Extract key terms
  maxSentences: 5          // Limit summary length
};
```

## UI Components

### Settings Panel Integration
The settings panel includes six comprehensive tabs:

1. **General**: Application preferences and usage statistics
2. **AI Models**: OpenRouter configuration and model selection
3. **Appearance**: Theme and layout customization
4. **Accessibility**: Screen reader and keyboard navigation
5. **Security**: API key security and privacy settings
6. **Data & Privacy**: Export/import and data management

### AI-Enhanced News Cards
Each news article can display:
- **Original Content**: Title, description, and source
- **AI Summary**: Intelligent summarization with one click
- **Metadata**: Sentiment, keywords, confidence score
- **Usage Info**: Token count and cost estimation
- **Error Handling**: Graceful fallback for failed requests

## Security & Privacy

### API Key Security
- **Local Storage Only**: Keys never sent to our servers
- **HTTPS Encryption**: All API calls use secure connections
- **No Logging**: API keys are not logged or tracked
- **Easy Removal**: Clear keys with one click in settings

### Privacy Features
- **Anonymous Usage**: No personal data collection
- **Local Processing**: All settings stored in browser
- **Transparent Costs**: Real-time cost tracking
- **Data Control**: Export/import all your data

## Troubleshooting

### Common Issues

**API Key Invalid**
- Verify key starts with `sk-or-v1-`
- Check OpenRouter account has credits
- Ensure key has necessary permissions

**No Models Loading**
- Check internet connection
- Verify API key is valid
- Try refreshing the models list

**Summarization Fails**
- Check API key and credits
- Verify model is available
- Try a different model or reduce max tokens

**High Costs**
- Use budget models for routine tasks
- Set daily/monthly limits in settings
- Monitor token usage in real-time

### Error Codes
- `NO_API_KEY`: Configure API key in settings
- `INVALID_API_KEY`: Check key validity and permissions
- `QUOTA_EXCEEDED`: Add credits to OpenRouter account
- `RATE_LIMIT_EXCEEDED`: Wait before making more requests
- `REQUEST_FAILED`: Network or server issue, retry

## Cost Management

### Model Pricing (per 1M tokens)
- **Budget**: $0.04 - $0.60 (GPT-4o Mini, Gemini Flash)
- **Balanced**: $1.25 - $10 (GPT-4o, Gemini Pro)
- **Premium**: $3 - $15 (Claude 3.5 Sonnet, Llama 405B)

### Cost Optimization Tips
1. **Choose Appropriate Models**: Use budget models for simple tasks
2. **Set Limits**: Configure daily/monthly spending limits
3. **Monitor Usage**: Check real-time cost tracking
4. **Batch Requests**: Process multiple articles together
5. **Adjust Parameters**: Lower max tokens for shorter summaries

## Architecture

### Service Layer
```
aiService.ts
├── API Key Management
├── Model Discovery
├── Content Summarization
├── Error Handling
├── Rate Limiting
└── Usage Tracking
```

### UI Components
```
Components/
├── SettingsPanel.tsx       # Main settings interface
├── AIEnhancedNewsCard.tsx  # News cards with AI features
├── ModelSelector.tsx       # Model selection component
└── UsageIndicator.tsx      # Cost and usage tracking
```

### Type Definitions
```
types/ai.ts
├── AIModel              # Model information structure
├── AISettings           # Configuration interface
├── SummarizationOptions # Request parameters
├── SummarizationResult  # Response structure
└── UsageStats          # Usage tracking data
```

## Future Enhancements

### Planned Features
- **Streaming Responses**: Real-time summary generation
- **Batch Processing**: Process multiple articles simultaneously
- **Usage Analytics**: Detailed cost and performance insights
- **Custom Prompts**: User-defined summarization templates
- **Multi-language Support**: Summarization in different languages

### Integration Opportunities
- **Knowledge Graphs**: Entity extraction and relationship mapping
- **Trend Analysis**: AI-powered trend detection across articles
- **Personalization**: User-specific summarization preferences
- **Collaboration**: Shared summaries and annotations

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in browser console
3. Test API key in OpenRouter dashboard
4. Verify model availability and pricing

## Contributing

To contribute to the OpenRouter integration:
1. Fork the repository
2. Create a feature branch
3. Test with various models and configurations
4. Submit a pull request with detailed changes

---

*AI News Hub with OpenRouter Integration - Bringing the power of 400+ AI models to news aggregation*