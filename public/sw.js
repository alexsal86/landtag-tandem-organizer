// Service Worker for Push Notifications
const CACHE_NAME = 'notification-cache-v1';

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

// Push event handler
self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  if (!event.data) {
    console.log('Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data:', data);

    const options = {
      body: data.message,
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      data: data.data || {},
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      actions: [
        {
          action: 'view',
          title: 'Anzeigen'
        },
        {
          action: 'dismiss',
          title: 'Schließen'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Error parsing push data:', error);
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('Neue Benachrichtigung', {
        body: 'Sie haben eine neue Benachrichtigung erhalten.',
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'dismiss') {
    return;
  }
  
  // Default action or 'view' action
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Focus existing window and navigate if needed
          client.focus();
          
          // Send message to client to handle notification
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data
          });
          
          return;
        }
      }
      
      // Open new window if app is not open
      if (clients.openWindow) {
        let url = self.location.origin;
        
        // Navigate to specific page based on notification type
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

// Background sync (future enhancement)
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    // Sync offline notifications when back online
    console.log('Syncing notifications...');
    // Implementation for offline sync
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}