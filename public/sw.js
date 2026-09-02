// v2026-09-02-uyelik-sifre — /api ve POST isteklerini yakalama (şifre güncelleme takılıyordu)
const SW_VERSION = '2026-09-02-a';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      if (self.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)));
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const method = String(e.request.method || 'GET').toUpperCase();
  // API (üyelik şifresi dahil) ve POST gövdeli istekler tarayıcıya bırakılır.
  // POST gövdesini cache seçeneğiyle yeniden göndermek PWA'da isteği asılı bırakabiliyor.
  if (url.pathname.startsWith('/api/')) return;
  if (method !== 'GET' && method !== 'HEAD') return;
  if (url.pathname === '/siparis' || url.pathname === '/siparis.html' || url.pathname === '/sw.js') {
    return;
  }
  e.respondWith(fetch(e.request));
});
