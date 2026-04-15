// Unified Service Worker: Push Notifications + Cross-Origin Isolation
const CACHE_NAME = 'notification-cache-v1';

// ── COI Configuration ──
let coepCredentialless = false;

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// Message handler (COI deregister + credentialless toggle)
self.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'deregister') {
    self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
      clients.forEach((c) => c.navigate(c.url));
    });
  } else if (e.data.type === 'coepCredentialless') {
    coepCredentialless = e.data.value;
  }
});

// ── Fetch handler: COI header injection ──
self.addEventListener('fetch', function (e) {
  const r = e.request;
  if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;

  // Skip Vite dev requests
  const url = new URL(r.url);
  const isViteDevRequest =
    url.pathname.includes('node_modules/.vite/') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    url.searchParams.has('t');
  if (isViteDevRequest) return;

  // Determine if we should add COOP/COEP headers
  const secFetchDest = r.headers.get('Sec-Fetch-Dest');
  const secFetchSite = r.headers.get('Sec-Fetch-Site');

  const isIframeNavigation = secFetchDest === 'iframe' || secFetchDest === 'frame';
  const isTopLevelUserNav = r.mode === 'navigate'
    && secFetchDest === 'document'
    && secFetchSite === 'none';
  const skipIsolation = isIframeNavigation || !isTopLevelUserNav;

  const s = coepCredentialless && r.mode === 'no-cors'
    ? new Request(r, { credentials: 'omit' })
    : r;

  e.respondWith(
    fetch(s).then(function (response) {
      if (response.status === 0) return response;

      const headers = new Headers(response.headers);

      if (!skipIsolation) {
        headers.set('Cross-Origin-Embedder-Policy',
          coepCredentialless ? 'credentialless' : 'require-corp');
        if (!coepCredentialless) {
          headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        }
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      }

      const noBody = [101, 204, 205, 304].includes(response.status);
      return new Response(noBody ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    }).catch(function (err) {
      console.error('[SW] fetch error:', err);
      return Response.error();
    })
  );
});

// ── Push notification handler ──
self.addEventListener('push', (event) => {
  console.log('Push received:', event);

  if (!event.data) {
    console.log('Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data received:', data);

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

    console.log('Showing notification:', data.title, options);

    event.waitUntil(
      self.registration.showNotification(data.title || 'Neue Benachrichtigung', options)
    );
  } catch (error) {
    console.error('Error parsing push data:', error);

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

// ── Notification click handler ──
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') return;

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

// Background sync
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);

  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    console.log('Syncing notifications...');
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}
