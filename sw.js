self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Escucha mensajes para disparar notificaciones locales
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MOSTRAR_NOTIFICACION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      vibrate: [200, 100, 200]
    });
  }
});