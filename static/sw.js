const CACHE_NAME = 'quizerai-cache-v1';
const PRECACHE_ASSETS = [
    '/',
    '/static/style.css',
    '/static/script.js',
    '/static/logo.png',
    '/static/logo_192.png',
    '/static/logo_512.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Pre-caching offline assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event
self.addEventListener('fetch', event => {
    // Skip non-GET requests (e.g. POST for generating quizzes and submitting)
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Dynamic routing/caching strategies
    // For local static assets and external CDN assets, use Cache First strategy
    if (
        (url.origin === self.location.origin && url.pathname.startsWith('/static/')) ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('cdnjs.cloudflare.com')
    ) {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        // Cache the newly retrieved static resource
                        if (networkResponse && networkResponse.status === 200) {
                            return caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, networkResponse.clone());
                                return networkResponse;
                            });
                        }
                        return networkResponse;
                    });
                }).catch(() => fetch(event.request))
        );
    } else {
        // For HTML pages / other GET requests, use Network First strategy
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Update the cache with the fresh page
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // If network fails, serve from cache
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Fallback if nothing is in the cache (should not happen for precached '/')
                            return caches.match('/');
                        });
                })
        );
    }
});
