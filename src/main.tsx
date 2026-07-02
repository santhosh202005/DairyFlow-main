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
const SW_VERSION = 'v2';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Unregister any previous SW to force fresh asset load after changes
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));

      const reg = await navigator.serviceWorker.register(`/sw.js?version=${SW_VERSION}`);
      console.log('[PWA] Service Worker registered:', reg.scope, 'version:', SW_VERSION);
    } catch (err) {
      console.warn('[PWA] Service Worker failed:', err);
    }
  });
}

