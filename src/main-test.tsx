import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TestApp } from './test-app'

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <TestApp />
    </StrictMode>
  );
  console.log('Test app rendered!');
}