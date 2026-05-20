// GolfTrainer Service Worker — Web Push handler
// Served from the root so the SW scope covers the full origin.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'GolfTrainer', body: event.data.text() };
  }

  const title = payload.title || 'GolfTrainer';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const absoluteUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window for this origin is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((c) => c.navigate(absoluteUrl));
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
