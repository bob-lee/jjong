importScripts('/workbox-sw.js');

workbox.skipWaiting();
workbox.clientsClaim();

workbox.precaching.precacheAndRoute([]);

// app-shell
workbox.routing.registerRoute('/', workbox.strategies.networkFirst());

// storage-cache
const STORAGE1 = /https:\/\/firebasestorage.googleapis.com\/v0\/b\/jjong-37fd6.appspot.com\/.*/;
const STORAGE2 = /https:\/\/storage.googleapis.com\/jjong-37fd6.appspot.com\/.*/;
const matchCb = ({url, event}) => {
  return STORAGE1.test(url) || STORAGE2.test(url) ? {url} : null;
};
workbox.routing.registerRoute(matchCb,
  workbox.strategies.cacheFirst({
    cacheName: 'storage-cache',
    plugins: [
      new workbox.expiration.Plugin({maxEntries: 60}),
      new workbox.cacheableResponse.Plugin({statuses: [0, 200]}),
    ],
  })
);
