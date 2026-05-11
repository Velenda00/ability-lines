// 再塑法典 - Service Worker
const CACHE_NAME = 'ability-lines-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/store.js',
  '/js/sync.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 非同域请求（如 GitHub API）直接放行，不经过 Service Worker
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }
  // 同域请求：网络优先，失败再回缓存
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
