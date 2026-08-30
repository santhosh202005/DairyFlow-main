import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './i18n';

// ── API Base URL Interceptor ───────────────────────────────────────────────
// Use a deployed backend in native apps and on the hosted site. Only use localhost
// when running the app in a standard local dev environment.
const getApiBaseUrl = () => {
  const override = import.meta.env.VITE_API_BASE_URL;
  if (override) return override.replace(/\/$/, '');

  if (typeof window === 'undefined') return 'https://dairyflow-main.onrender.com';

  const isNativeApp = !!(window as any).Capacitor
    || window.location.protocol === 'capacitor:'
    || window.location.protocol === 'file:';
  const isLocalDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalDevHost && !isNativeApp) return 'http://localhost:3000';
  return 'https://dairyflow-main.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();
const originalFetch = window.fetch;
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  let url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  const isLocalApi = url.startsWith('/api/') ||
                     url.startsWith('http://localhost/api/') ||
                     url.startsWith('https://localhost/api/') ||
                     url.startsWith('capacitor://localhost/api/');

  if (isLocalApi) {
    const path = url.substring(url.indexOf('/api/'));
    url = `${API_BASE_URL}${path}`;
  }

  if (typeof input !== 'string' && !(input instanceof URL)) {
    input = new Request(url, input);
  } else {
    input = url;
  }

  return originalFetch(input, init);
};

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
