/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
let coepCredentialless=!1;"undefined"==typeof window?(self.addEventListener("install",(()=>self.skipWaiting())),self.addEventListener("activate",(e=>e.waitUntil(self.clients.claim()))),self.addEventListener("message",(e=>{e.data&&("deregister"===e.data.type?self.registration.unregister().then((()=>self.clients.matchAll())).then((e=>{e.forEach((e=>e.navigate(e.url)))})):"coepCredentialless"===e.data.type&&(coepCredentialless=e.data.value))})),self.addEventListener("fetch",(function(e){const r=e.request;if("only-if-cached"===r.cache&&"same-origin"!==r.mode)return;const s=coepCredentialless&&"no-cors"===r.mode?new Request(r,{credentials:"omit"}):r;e.respondWith(fetch(s).then((e=>{if(0===e.status)return e;const r=new Headers(e.headers);r.set("Cross-Origin-Embedder-Policy",coepCredentialless?"credentialless":"require-corp"),coepCredentialless||r.set("Cross-Origin-Resource-Policy","cross-origin"),r.set("Cross-Origin-Opener-Policy","same-origin");const n=[101,204,205,304].includes(e.status);return new Response(n?null:e.body,{status:e.status,statusText:e.statusText,headers:r})})).catch((e=>console.error(e))))}))):(()=>{const e={shouldRegister:()=>!0,shouldDeregister:()=>!1,coepCredentialless:()=>!(window.chrome||window.netscape),doReload:()=>window.location.reload(),quiet:!1,...window.coi},r=navigator;r.serviceWorker&&r.serviceWorker.controller&&(r.serviceWorker.controller.postMessage({type:"coepCredentialless",value:e.coepCredentialless()}),e.shouldDeregister()&&r.serviceWorker.controller.postMessage({type:"deregister"})),!1===window.crossOriginIsolated&&e.shouldRegister()&&(window.isSecureContext?r.serviceWorker&&r.serviceWorker.register(window.document.currentScript.src).then((s=>{!e.quiet&&console.log("COOP/COEP Service Worker registered",s.scope),s.addEventListener("updatefound",(()=>{!e.quiet&&console.log("Reloading page to make use of updated COOP/COEP Service Worker."),e.doReload()})),s.active&&!r.serviceWorker.controller&&(!e.quiet&&console.log("Reloading page to make use of COOP/COEP Service Worker."),e.doReload())}),(r=>{!e.quiet&&console.error("COOP/COEP Service Worker failed to register:",r)})):!e.quiet&&console.log("COOP/COEP Service Worker not registered, a secure context is required."))})();

// Push notification handlers are appended here so the single root-scoped service worker
// can support both COOP/COEP and Web Push at the same time.
if (typeof window === 'undefined') {
  self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
      const data = event.data.json();
      const options = {
        body: data.body || data.message || 'Sie haben eine neue Benachrichtigung erhalten.',
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        data: data.data || data,
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || data.priority === 'urgent' || data.priority === 'high',
        actions: [
          { action: 'view', title: 'Anzeigen' },
          { action: 'dismiss', title: 'Schließen' }
        ]
      };

      event.waitUntil(self.registration.showNotification(data.title || 'Neue Benachrichtigung', options));
    } catch (_error) {
      event.waitUntil(
        self.registration.showNotification('Neue Benachrichtigung', {
          body: 'Sie haben eine neue Benachrichtigung erhalten.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          actions: [{ action: 'view', title: 'Anzeigen' }]
        })
      );
    }
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const data = event.notification.data || {};

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NOTIFICATION_CLICKED', data });
            return;
          }
        }

        if (clients.openWindow) {
          let url = self.location.origin;

          if (data.type) {
            switch (data.type) {
              case 'task_created':
              case 'task_due':
                url += '#/tasks';
                break;
              case 'appointment_reminder':
                url += '#/calendar';
                break;
              case 'message_received':
                url += '#/messages';
                break;
              default:
                url += '#/';
            }
          }

          return clients.openWindow(url);
        }
      })
    );
  });
}
