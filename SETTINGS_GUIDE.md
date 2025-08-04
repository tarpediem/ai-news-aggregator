# AI News App - Settings Guide

This guide explains how to use the enhanced settings system with API key management and AI model selection capabilities.

## Overview

The enhanced settings panel provides comprehensive configuration options for:
- API key management with secure storage
- AI model selection and configuration
- Advanced security and privacy controls
- Enhanced data management with full backup/restore

## Features

### 🔑 API Key Management

#### Secure Storage
- API keys are stored locally in browser localStorage
- Keys are never sent to our servers
- Encrypted in transit when communicating with AI providers
- Easy to clear and manage through security settings

#### Supported Providers
- **OpenRouter**: Primary AI provider supporting multiple models
- Future support planned for direct provider APIs

#### Testing & Validation
- Built-in API key testing functionality
- Real-time validation with provider APIs
- Clear error messages for troubleshooting

### 🤖 AI Model Selection

#### Model Categories
- **Budget**: Cost-effective models for basic tasks
  - GPT-4o Mini: $0.15/$0.60 per 1M tokens
- **Balanced**: Good performance-to-cost ratio
  - GPT-4: $3.00/$6.00 per 1M tokens
  - Gemini Pro: $0.50/$1.50 per 1M tokens
- **Premium**: Top-tier models for complex tasks
  - Claude 3.5 Sonnet: $3.00/$15.00 per 1M tokens
  - Llama 3.1 405B: $2.70/$2.70 per 1M tokens

#### Model Features
- Search and filter models by name, provider, or capability
- View detailed model information including:
  - Pricing (input/output tokens)
  - Context length
  - Capabilities (reasoning, code generation, etc.)
  - Provider and category

#### Advanced Configuration
- **Max Tokens**: Control response length (1-32,768)
- **Temperature**: Adjust creativity/randomness (0-2)
- **Streaming Mode**: Enable real-time response streaming
- **Model Fallback**: Automatic fallback to backup model on errors

### 🔒 Security & Privacy

#### Data Protection
- Local storage encryption information
- Privacy settings for notifications and analytics
- Third-party integration controls
- Clear explanations of data handling

#### Data Retention Management
- Clear search history (keeps last 10 searches)
- Clear reading history
- Bulk data clearing options
- Secure API key removal

#### Security Actions
- Clear all stored API keys
- Clear all local data (nuclear option)
- Confirmation dialogs for destructive actions

### 📊 Enhanced Data Management

#### Export Options
- **Standard Export**: Settings, bookmarks, preferences
- **Full Backup**: Includes API settings and configurations
- Timestamped export files
- JSON format for portability

#### Import Features
- Support for both standard exports and full backups
- Automatic detection of backup type
- Safe import with error handling
- Preservation of existing data during partial imports

#### Storage Monitoring
- Real-time usage statistics
- Visual representation of stored data
- Clear breakdown by data type

## Getting Started

### 1. Initial Setup

1. **Open Settings**: Click the settings icon in the app
2. **Navigate to AI Models**: Select the "AI Models" tab
3. **Add API Key**: 
   - Get your key from [OpenRouter](https://openrouter.ai/keys)
   - Paste it in the API key field
   - Use the show/hide toggle for security
   - Click "Test Key" to verify

### 2. Model Selection

1. **Browse Models**: Use search and category filters
2. **Compare Options**: Review pricing and capabilities
3. **Select Model**: Click on your preferred model
4. **Configure Settings**: Adjust max tokens and temperature
5. **Save**: Settings are automatically saved

### 3. Advanced Configuration

1. **Enable Streaming**: For real-time responses
2. **Set Fallback Model**: Choose a backup model
3. **Adjust Temperature**: 
   - Lower (0-0.3): More focused, deterministic
   - Medium (0.4-0.8): Balanced creativity
   - Higher (0.9-2.0): More creative, random

## Usage Examples

### Using AI Features

```typescript
import { aiService } from '../services/aiService';

// Summarize an article
const summary = await aiService.summarizeArticle(title, content);

// Analyze relevance
const score = await aiService.analyzeRelevance(article, userInterests);

// Generate tags
const tags = await aiService.generateTags(article);

// Enhance search query
const enhanced = await aiService.enhanceSearchQuery(query);
```

### Settings Integration

```typescript
// Update API settings
aiService.updateSettings({
  selectedModel: 'anthropic/claude-3.5-sonnet',
  temperature: 0.7,
  maxTokens: 4096
});

// Test connection
const isValid = await aiService.testConnection();

// Get usage statistics
const stats = aiService.getUsageStats();
```

## Troubleshooting

### Common Issues

#### API Key Problems
- **"API key is invalid"**: Check key format (should start with 'sk-or-')
- **"No API key configured"**: Add key in AI Models settings
- **Connection failed**: Check internet connection and key validity

#### Model Selection Issues
- **Model not responding**: Try fallback model or different provider
- **Rate limiting**: Wait and retry, or upgrade API plan
- **Context too long**: Reduce max tokens or input length

#### Settings Not Saving
- **Clear browser cache**: Sometimes localStorage gets corrupted
- **Check storage quota**: Browser may be out of space
- **Try incognito mode**: Rule out extension conflicts

### Best Practices

#### API Key Security
- Never share your API keys
- Regularly rotate keys
- Use browser's private/incognito mode for extra security
- Clear keys when using shared computers

#### Model Selection
- Start with budget models for testing
- Use premium models for important tasks
- Enable fallback for reliability
- Monitor usage to control costs

#### Data Management
- Regular exports for backup
- Clear old data periodically
- Use full backup for complete migration
- Test imports with small datasets first

## Advanced Features

### Custom Integration

The settings system is designed to be extensible:

```typescript
// Custom model provider integration
interface CustomProvider {
  name: string;
  baseUrl: string;
  authHeader: string;
  models: AIModel[];
}

// Settings validation
const validateSettings = (settings: APISettings): boolean => {
  return settings.maxTokens > 0 && 
         settings.temperature >= 0 && 
         settings.temperature <= 2;
};
```

### Theming Support

All components support dark mode:
- Automatic system theme detection
- Manual light/dark mode toggle
- High contrast support
- Reduced motion preferences

### Accessibility

The settings panel includes:
- Screen reader support
- Keyboard navigation
- Focus management
- ARIA labels and descriptions
- Color contrast compliance

## Support

### Getting Help
- Check browser console for detailed error messages
- Use the "Test Connection" feature to diagnose API issues
- Export settings before making major changes
- Clear cache and cookies if experiencing persistent issues

### Reporting Issues
When reporting problems, include:
- Browser version and type
- Error messages from console
- Steps to reproduce
- Settings export (without API keys)

### Feature Requests
The settings system is actively developed. Suggestions for:
- New AI providers
- Additional model categories
- Enhanced security features
- Better data management tools

Are welcome through the project's issue tracker.

## Security Considerations

### Data Protection
- API keys stored locally only
- No server-side key storage
- Encrypted API communications
- Optional analytics (can be disabled)

### Privacy Controls
- Granular notification settings
- Third-party integration toggles
- Data retention controls
- Complete data clearing options

### Best Practices
- Regular key rotation
- Monitor usage statistics
- Use fallback models for reliability
- Keep settings backed up securely

---

For technical implementation details, see the source code in:
- `/src/components/SettingsPanel.tsx`
- `/src/services/aiService.ts`
- `/src/types/ai.ts`