import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './SimpleApp.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { serviceWorker } from './utils/serviceWorker.ts'

// Register service worker for offline support
if (serviceWorker.isSupported) {
  serviceWorker.register({
    onSuccess: () => console.log('Service worker registered successfully'),
    onUpdate: () => console.log('New content available, refresh to update')
  }).catch(error => {
    console.warn('Service worker registration failed silently:', error);
  });
}

// Check if root element exists
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: monospace;">❌ Error: Root element not found. Check HTML structure.</div>';
} else {
  console.log('✅ Root element found, proceeding with render');
  
  try {
    console.log('🔧 Creating React root...');
    const root = createRoot(rootElement);
    
    console.log('🎨 Rendering Full AI News Hub with Enhanced Features...');
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    
    console.log('✅ Full AI News Hub app rendered successfully');
    
  } catch (error) {
    console.error('❌ Error during React initialization:', error);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: monospace; background: #fee;">
        <h3>❌ React Initialization Error</h3>
        <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
        <p><strong>Stack:</strong></p>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.stack : 'No stack trace'}</pre>
      </div>
    `;
  }
}