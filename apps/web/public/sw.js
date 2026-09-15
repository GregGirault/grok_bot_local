const CACHE = 'grok-bot-shell-v8';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health') || url.pathname.startsWith('/uploads')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        if (event.request.method === 'GET' && res.ok) {
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/')))
  );
});
