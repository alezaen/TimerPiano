// TimerPiano sin internet: tras abrirla una vez con conexión, la página y todo lo que necesita quedan guardados en el dispositivo.
//  - La página ("/"): primero la red (así llegan las actualizaciones); si no hay red o tarda más de 3 s, la copia guardada.
//  - Los archivos de /_next/static (llevan un código en el nombre y nunca cambian): primero lo guardado.
//  - Iconos y manifest: lo guardado, y se refrescan en segundo plano.
//  - /api/*: siempre la red. La nube solo existe con internet; la app ya avisa "Sin conexión" y sube lo pendiente al volver.
const CACHE = 'timerpiano-v1';
const PAGINA = '/';
const BASE = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-icon.png', '/favicon.ico'];
const MAX_ESTATICOS = 150;
const ESPERA_RED_MS = 3000;

const pausa = ms => new Promise(r => setTimeout(r, ms));

// Archivos de /_next/static que nombra una página (en sus etiquetas y en los datos que Next deja dentro) o una hoja de estilos (url(...)).
function referencias(texto, base = '/') {
  const urls = new Set();
  for (const m of texto.matchAll(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-./%~@]+\.(?:js|css|woff2?)/g)) urls.add('/_next/' + m[0].replace(/^\/_next\//, ''));
  for (const m of texto.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
    try { const u = new URL(m[1], new URL(base, self.location.origin)); if (u.origin === self.location.origin && u.pathname.startsWith('/_next/static/')) urls.add(u.pathname); } catch { /* url rara: se ignora */ }
  }
  return [...urls];
}
async function guardarArchivos(cache, urls) {
  await Promise.all(urls.map(async u => {
    if (await cache.match(u)) return;
    try {
      const r = await fetch(u);
      if (!r.ok) return;
      await cache.put(u, r.clone());
      if (u.endsWith('.css')) await guardarArchivos(cache, referencias(await r.text(), u));      // fuentes o imágenes que pida la hoja de estilos
    } catch { /* sin red ahora: se guardará en otra visita */ }
  }));
}
async function recortar(cache) {
  const claves = (await cache.keys()).filter(r => new URL(r.url).pathname.startsWith('/_next/static/'));
  for (const r of claves.slice(0, Math.max(0, claves.length - MAX_ESTATICOS))) await cache.delete(r);     // las más viejas primero
}
async function guardarPagina(cache, respuesta) {
  await cache.put(PAGINA, respuesta.clone());
  await guardarArchivos(cache, referencias(await respuesta.text()));
  await recortar(cache);
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(BASE.map(async u => { try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await cache.put(u, r); } catch { /* se guarda luego */ } }));
    const pagina = await cache.match(PAGINA);
    if (pagina) await guardarArchivos(cache, referencias(await pagina.clone().text()));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) if (n.startsWith('timerpiano-') && n !== CACHE) await caches.delete(n);
    await self.clients.claim();
  })());
});

async function pagina(e) {
  const cache = await caches.open(CACHE);
  const red = fetch(e.request).then(async r => { if (r.ok) await guardarPagina(cache, r.clone()); return r; });
  e.waitUntil(red.catch(() => {}));                         // aunque se sirva la copia, la red termina de actualizarla
  const r = await Promise.race([red, pausa(ESPERA_RED_MS).then(() => null)]).catch(() => null);
  if (r && r.ok) return r;
  return (await cache.match(PAGINA)) || r || red;           // sin copia guardada, lo que responda la red
}
async function estatico(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  if (r.ok) await cache.put(req, r.clone());
  return r;
}
async function refrescar(req, e) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req);
  const red = fetch(req).then(async r => { if (r.ok) await cache.put(req, r.clone()); return r; });
  if (guardada) { e.waitUntil(red.catch(() => {})); return guardada; }
  return red.catch(() => Response.error());
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') e.respondWith(pagina(e));
  else if (url.pathname.startsWith('/_next/static/')) e.respondWith(estatico(req));
  else e.respondWith(refrescar(req, e));
});
