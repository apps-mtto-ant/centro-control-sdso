importScripts('./js/config.js');

const CONFIG = self.SDSO_CONFIG;
const CACHE_NAME = `${CONFIG.cachePrefix}v${CONFIG.version}`;
const CACHE_PREFIX = CONFIG.cachePrefix;
const NETWORK_TIMEOUT_MS = 4000;
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/config.js',
  './js/app.js',
  './js/api.js',
  './js/offline.js',
  './js/auth.js',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('network-timeout')), timeoutMs))
  ]);
}

async function putIfOk(cacheKey, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(cacheKey, response.clone());
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request);
        const scope = new URL(self.registration.scope);
        const isAppEntry = response.ok && (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`);
        if (isAppEntry) await putIfOk('./index.html', response);
        return response;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetchWithTimeout(request);
      if (response.ok) await putIfOk(request, response);
      return response;
    } catch {
      return (await caches.match(request)) || Response.error();
    }
  })());
});
