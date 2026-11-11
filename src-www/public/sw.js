// Minimaler Service Worker: App-Shell offline verfügbar, Daten kommen live per WebSocket.
const CACHE = 'smartvis-v1';

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html'])));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
    );
    self.clients.claim();
});

// Network-first, Fallback auf Cache
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }
    event.respondWith(
        fetch(request)
            .then(response => {
                const copy = response.clone();
                caches.open(CACHE).then(c => c.put(request, copy));
                return response;
            })
            .catch(() => caches.match(request).then(r => r || caches.match('./index.html'))),
    );
});
