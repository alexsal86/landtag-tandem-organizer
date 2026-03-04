import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

function isLovablePreviewHost(hostname: string): boolean {
  return hostname.endsWith('lovable.app') || hostname.endsWith('lovableproject.com');
}

async function unregisterAllServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) return;
  await Promise.allSettled(regs.map((r) => r.unregister()));
}

async function setupCrossOriginIsolation(): Promise<void> {
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const isPreviewHost = isLovablePreviewHost(window.location.hostname);

  // Hard failsafe: never touch SW API on Lovable preview domains.
  // navigator.serviceWorker calls can hang indefinitely in cross-origin iframes.
  if (isPreviewHost) {
    sessionStorage.removeItem('coi-cleanup-state');
    return;
  }

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
    }

    if ((!state || state === 'started') && 'serviceWorker' in navigator) {
      sessionStorage.setItem('coi-cleanup-state', 'started');
      await unregisterAllServiceWorkers();
      sessionStorage.setItem('coi-cleanup-state', 'reloaded');
      window.location.reload();
    }

    return;
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    await navigator.serviceWorker.register('/coi-serviceworker.js?v=2026-03-04-v6');
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
