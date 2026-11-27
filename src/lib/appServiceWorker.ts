/** Shared gate for the combined app-shell/push worker; standalone messaging workers are untouched. */
export function allowsAppServiceWorker(hostname: string, production: boolean, inIframe: boolean, search = ""): boolean {
  const host = hostname.toLowerCase();
  const label = host.split(".")[0];
  const previewDomain = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  const previewLabel = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label)
    || /^project--.+-dev$/.test(label);
  const preview = (previewDomain && previewLabel)
    || /(^|\.)(lovableproject(?:-dev)?\.com|beta\.lovable\.dev)$/.test(host);
  return production && !inIframe && !preview && host !== "localhost"
    && host !== "127.0.0.1" && new URLSearchParams(search).get("sw") !== "off";
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const allowed = allowsAppServiceWorker(window.location.hostname, import.meta.env.PROD,
    window.self !== window.top, window.location.search);
  if (!allowed) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.filter(registration =>
      [registration.active, registration.waiting, registration.installing].some(worker =>
        worker && ["/sw.js", "/coi-serviceworker.js"].includes(new URL(worker.scriptURL).pathname),
      ),
    ).map(registration => registration.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.allSettled(names.filter(name => name.startsWith("quick-notes-shell-"))
        .map(name => caches.delete(name)));
    }
    return null;
  }
  if (!window.isSecureContext) return null;
  return navigator.serviceWorker.register("/sw.js");
}