// Simple Service Worker for PWA Installation Requirements
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through everything to network to preserve Firebase realtime
  e.respondWith(fetch(e.request));
});
