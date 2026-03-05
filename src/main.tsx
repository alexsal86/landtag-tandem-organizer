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

  if (coiStatus.blocked) {
    sessionStorage.removeItem('coi-cleanup-state');
    return;
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    await navigator.serviceWorker.register('/coi-serviceworker.js?v=2026-03-04-v6');
  }
}

function bootstrap() {
  createRoot(document.getElementById('root')!).render(<App />);

  void Promise.race([
    setupCrossOriginIsolation(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('COI timeout')), 3000)),
  ]).catch(() => {});
}

bootstrap();
