// Service worker: la app se actualiza sola.
// - index.html y archivos propios: red primero (si hay conexión, siempre la versión nueva), caché como respaldo.
// - Librerías externas (Three.js, Chart.js, fuentes): caché primero para que cargue rápido y funcione sin red.
// Para forzar que todos los usuarios limpien la caché antigua, sube el número de VERSION.
const VERSION = 'atlas-v11';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca interceptar llamadas a APIs de datos (Gemini, etc.)
  if (url.hostname.endsWith('googleapis.com') && url.pathname.startsWith('/v1')) return;

  if (url.origin === location.origin) {
    // Red primero, caché de respaldo
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Recursos externos (CDN, fuentes): caché primero
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.status === 200 || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
