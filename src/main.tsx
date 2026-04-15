import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { evaluateCoiCapabilityStatus, setCoiCapabilityStatus } from './lib/coiRuntime'

async function unregisterAllServiceWorkers(
  shouldUnregister: (registration: ServiceWorkerRegistration) => boolean = () => true,
): Promise<number> {
  if (!('serviceWorker' in navigator)) return 0;
  const regs = await navigator.serviceWorker.getRegistrations();
  const relevantRegistrations = regs.filter(shouldUnregister);
  if (relevantRegistrations.length === 0) return 0;

  const results = await Promise.allSettled(relevantRegistrations.map((r) => r.unregister()));
  const successfulUnregistrations = results.filter(
    (result) => result.status === 'fulfilled' && result.value,
  ).length;

  return successfulUnregistrations;
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
    let removedCoiServiceWorkerRegistrations = 0;

    if ('serviceWorker' in navigator) {
      const coiServiceWorkerUrl = new URL('/coi-serviceworker.js', window.location.origin).href;
      removedCoiServiceWorkerRegistrations = await unregisterAllServiceWorkers((registration) => {
        const activeScriptUrl = registration.active?.scriptURL;
        const waitingScriptUrl = registration.waiting?.scriptURL;
        const installingScriptUrl = registration.installing?.scriptURL;

        return [activeScriptUrl, waitingScriptUrl, installingScriptUrl]
          .filter((scriptUrl): scriptUrl is string => Boolean(scriptUrl))
          .some((scriptUrl) => scriptUrl.startsWith(coiServiceWorkerUrl));
      });
    }

    debugLog('Skipping service worker registration: running inside iframe.', {
      reason: coiStatus.reason,
      host: window.location.hostname,
      removedCoiServiceWorkerRegistrations,
    });

    // If we just unregistered a stale COI service worker, do a one-time reload so
    // the page is served without SW interception (the old SW may still control this
    // load and could have added COOP headers that break Lovable's preview postMessage).
    // sessionStorage prevents an infinite reload loop.
    const reloadKey = 'coi-iframe-reload-done';
    if (removedCoiServiceWorkerRegistrations > 0 && !sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
      return;
    }
    sessionStorage.removeItem(reloadKey);
    sessionStorage.removeItem('coi-cleanup-state');
    return;
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    debugLog('Registering COI service worker in top-level window.', {
      host: window.location.hostname,
      isPreviewHost: coiStatus.isPreviewHost,
    });
    await navigator.serviceWorker.register('/sw.js?v=2026-04-15-v1');
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
