import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {applyTheme, readStoredTheme} from './hooks/useTheme.ts';

// Apply the saved theme before first render to avoid a flash of the wrong theme.
applyTheme(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
