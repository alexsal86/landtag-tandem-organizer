/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*  Modified: iframe-aware — skips COOP/COEP when Sec-Fetch-Dest === "iframe" */
let coepCredentialless = false;

if (typeof window === 'undefined') {
  // ── Service Worker scope ──

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("message", (e) => {
    if (!e.data) return;
    if (e.data.type === "deregister") {
      self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
        clients.forEach((c) => c.navigate(c.url));
      });
    } else if (e.data.type === "coepCredentialless") {
      coepCredentialless = e.data.value;
    }
  });

  self.addEventListener("fetch", function (e) {
    const r = e.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;

    // ── Skip Vite dev requests to preserve React-refresh preamble ──
    const url = new URL(r.url);
    const isViteDevRequest =
      url.pathname.includes('node_modules/.vite/') ||
      url.pathname.includes('/@vite/') ||
      url.pathname.includes('/@react-refresh') ||
      url.pathname.startsWith('/src/') ||
      url.searchParams.has('t');
    if (isViteDevRequest) return;

    // ── Determine if we should skip COOP/COEP isolation ──
    //
    // Strategy: opt-in only — add headers exclusively when we are CERTAIN
    // this is a user-initiated top-level navigation (typed URL / bookmark).
    // Sec-Fetch-Site === "none" is only sent for those cases and is NEVER
    // sent for iframe loads, cross-origin link clicks, or embedded contexts.
    // This prevents COOP from breaking Lovable's preview postMessage channel.
    //
    // Belt-and-suspenders: also skip for explicit iframe/frame destinations.
    const secFetchDest = r.headers.get("Sec-Fetch-Dest");
    const secFetchSite = r.headers.get("Sec-Fetch-Site");

    const isIframeNavigation = secFetchDest === "iframe" || secFetchDest === "frame";

    const isTopLevelUserNav = r.mode === "navigate"
      && secFetchDest === "document"
      && secFetchSite === "none";

    const skipIsolation = isIframeNavigation || !isTopLevelUserNav;

    const s = coepCredentialless && r.mode === "no-cors"
      ? new Request(r, { credentials: "omit" })
      : r;

    e.respondWith(
      fetch(s).then(function (response) {
        if (response.status === 0) return response;

        const headers = new Headers(response.headers);

        if (!skipIsolation) {
          headers.set("Cross-Origin-Embedder-Policy",
            coepCredentialless ? "credentialless" : "require-corp");
          if (!coepCredentialless) {
            headers.set("Cross-Origin-Resource-Policy", "cross-origin");
          }
          headers.set("Cross-Origin-Opener-Policy", "same-origin");
        }

        const noBody = [101, 204, 205, 304].includes(response.status);
        return new Response(noBody ? null : response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers,
        });
      }).catch(function (err) {
        console.error('[COI SW] fetch error:', err);
        return Response.error();
      })
    );
  });

  // ── Push notification handlers ──

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

} else {
  // ── Client (browser) scope ──

  // Iframe detection — prevent SW registration & reload loops inside iframes
  var inIframe = false;
  try { inIframe = window.self !== window.top; }
  catch (_e) { inIframe = true; }

  const e = {
    shouldRegister: () => !inIframe,
    shouldDeregister: () => inIframe,
    coepCredentialless: () => !(window.chrome || window.netscape),
    doReload: () => { if (!inIframe) window.location.reload(); },
    quiet: false,
    ...window.coi
  };

  const r = navigator;

  if (r.serviceWorker && r.serviceWorker.controller) {
    r.serviceWorker.controller.postMessage({
      type: "coepCredentialless",
      value: e.coepCredentialless()
    });
    if (e.shouldDeregister()) {
      r.serviceWorker.controller.postMessage({ type: "deregister" });
    }
  }

  if (!window.crossOriginIsolated && e.shouldRegister()) {
    if (window.isSecureContext) {
      if (r.serviceWorker) {
        r.serviceWorker.register(window.document.currentScript.src).then((reg) => {
          if (!e.quiet) console.log("COOP/COEP Service Worker registered", reg.scope);
          reg.addEventListener("updatefound", () => {
            if (!e.quiet) console.log("Reloading page to make use of updated COOP/COEP Service Worker.");
            e.doReload();
          });
          if (reg.active && !r.serviceWorker.controller) {
            if (!e.quiet) console.log("Reloading page to make use of COOP/COEP Service Worker.");
            e.doReload();
          }
        }, (err) => {
          if (!e.quiet) console.error("COOP/COEP Service Worker failed to register:", err);
        });
      }
    } else {
      if (!e.quiet) console.log("COOP/COEP Service Worker not registered, a secure context is required.");
    }
  }
}
