import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

function isLovablePreviewHost(hostname: string): boolean {
  return (
    hostname.endsWith('lovable.app') ||
    hostname.endsWith('lovableproject.com') ||
    hostname.includes('lovable') // catch subdomain variants
  );
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin iframe – treat as iframe
  }
}

async function unregisterAllServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) return;
  await Promise.allSettled(regs.map((r) => r.unregister()));
}

async function setupCrossOriginIsolation(): Promise<void> {
  const inIframe = isInIframe();
  const isPreviewHost = isLovablePreviewHost(window.location.hostname);

  // Never touch SW in Lovable preview or any iframe – can hang indefinitely
  if (isPreviewHost || inIframe) {
    sessionStorage.removeItem('coi-cleanup-state');
    return;
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    await navigator.serviceWorker.register('/coi-serviceworker.js?v=2026-03-04-v6');
  }
}

function bootstrap() {
  // Always render immediately – never block on COI
  createRoot(document.getElementById('root')!).render(<App />);

  void Promise.race([
    setupCrossOriginIsolation(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('COI timeout')), 3000)),
  ]).catch(() => { /* ignore */ });
}

bootstrap();
