importScripts('/workbox-sw.js');
//self.workbox.logLevel = self.workbox.LOG_LEVEL.verbose;

const w = new self.WorkboxSW();

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

w.precache([]);

// app-shell
//w.router.registerNavigationRoute('/index.html');
w.router.registerRoute('/', w.strategies.networkFirst());

// storage-cache
const storageHandler = w.strategies.cacheFirst({
  cacheName: 'storage-cache',
  cacheExpiration: {
    maxEntries: 20
  },
  cacheableResponse: { statuses: [0, 200] }
});
w.router.registerRoute('https://firebasestorage.googleapis.com/v0/b/jjong-37fd6.appspot.com/(.*)', storageHandler);
w.router.registerRoute('https://storage.googleapis.com/jjong-37fd6.appspot.com/(.*)', storageHandler);
