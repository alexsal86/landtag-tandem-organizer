import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { evaluateCoiCapabilityStatus, setCoiCapabilityStatus } from './lib/coiRuntime'

async function unregisterAllServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) return;
  await Promise.allSettled(regs.map((r) => r.unregister()));
}

async function setupCrossOriginIsolation(): Promise<void> {
  const coiStatus = evaluateCoiCapabilityStatus();
  setCoiCapabilityStatus(coiStatus);
  const isTopLevel = window.self === window.top;
  const debugLog = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info('[COI]', ...args);
    }
  };

  if (!isTopLevel) {
    debugLog('Skipping service worker registration: running inside iframe.', {
      reason: coiStatus.reason,
      host: window.location.hostname,
    });
    sessionStorage.removeItem('coi-cleanup-state');
    return;
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    debugLog('Registering COI service worker in top-level window.', {
      host: window.location.hostname,
      isPreviewHost: coiStatus.isPreviewHost,
    });
    await navigator.serviceWorker.register('/coi-serviceworker.js?v=2026-03-04-v6');
    return;
  }

  debugLog('Skipping service worker registration: unsupported environment.', {
    hasServiceWorker: 'serviceWorker' in navigator,
    isSecureContext: window.isSecureContext,
  });
}

function bootstrap() {
  createRoot(document.getElementById('root')!).render(<App />);

  void Promise.race([
    setupCrossOriginIsolation(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('COI timeout')), 3000)),
  ]).catch(() => {});
}

bootstrap();
