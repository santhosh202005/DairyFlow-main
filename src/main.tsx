import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);

// ── Register Service Worker (PWA) ─────────────────────────────────────────────
// Cache-busting: bump SW_VERSION on every deploy so stale old bundles don't stick.
const SW_VERSION = 'v4';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Force unregister all service workers
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
        console.log('[PWA] Unregistered old service worker:', r.scope);
      }
      
      // Clear all caches to release browser from cached assets
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        console.log('[PWA] Cleared all browser caches');
      }
    } catch (err) {
      console.warn('[PWA] Cache clearing failed:', err);
    }
  });
}
