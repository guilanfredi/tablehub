/* Importado pelo service worker gerado (vite.config.ts → workbox.importScripts).
   Tocar na notificação "Sua vez!" foca a aba da sala (ou abre a sala, se a aba foi fechada). */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  const path = new URL(url, self.location.origin).pathname;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const tab = list.find((c) => new URL(c.url).pathname === path) || list[0];
      return tab ? tab.focus() : self.clients.openWindow(url);
    }),
  );
});
