import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

async function setupCrossOriginIsolation(): Promise<void> {
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (inIframe) {
    const state = sessionStorage.getItem('coi-cleanup-state');

    if (state === 'done') return;

    if (state === 'reloaded') {
      sessionStorage.setItem('coi-cleanup-state', 'done');
      return;
    }

    // Stuck-state recovery: if previous cleanup was interrupted
    if (state === 'started') {
      sessionStorage.removeItem('coi-cleanup-state');
      // Fall through to retry cleanup
    }

    if ((!state || state === 'started') && 'serviceWorker' in navigator) {
      sessionStorage.setItem('coi-cleanup-state', 'started');
      const regs = await navigator.serviceWorker.getRegistrations();

      if (regs.length === 0) {
        sessionStorage.setItem('coi-cleanup-state', 'done');
        return;
      }

      await Promise.all(regs.map((r) => r.unregister()));
      sessionStorage.setItem('coi-cleanup-state', 'reloaded');
      window.location.reload();
    }

    return;
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    await navigator.serviceWorker.register('/coi-serviceworker.js?v=2026-03-04-v5');
  }
}

async function bootstrap() {
  try {
    await setupCrossOriginIsolation();
  } catch {
    // continue app bootstrap even if COI setup fails
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();
