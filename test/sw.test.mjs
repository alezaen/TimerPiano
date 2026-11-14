// Pruebas de public/sw.js (TimerPiano sin internet) con un navegador falso: caché, red y eventos. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const CODIGO = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGEN = 'https://timer.test';
const HTML = `<html><head><link rel="stylesheet" href="/_next/static/css/app.css"/><script src="/_next/static/chunks/main.js" async></script></head>
<body>x<script>self.__next_f.push([1,"static/chunks/lazy.js"]);self.__next_f.push([1,"static/chunks/app/page-abc123.js"])</script></body></html>`;
const SITIO = () => ({ '/': HTML, '/manifest.json': '{}', '/icon-192.png': 'i1', '/icon-512.png': 'i2', '/apple-icon.png': 'i3', '/favicon.ico': 'i4',
  '/_next/static/css/app.css': 'body{} @font-face{src:url(../media/f.woff2)}', '/_next/static/media/f.woff2': 'fuente', '/_next/static/chunks/main.js': 'main', '/_next/static/chunks/lazy.js': 'lazy', '/_next/static/chunks/app/page-abc123.js': 'pagina-app' });

function entorno({ rutas = SITIO(), enLinea = true, lenta = null } = {}) {
  const almacenes = new Map(), oyentes = {}, estado = { enLinea, lenta, llamadas: [], rutas, borradas: [], claimed: false, skip: false };
  const ruta = u => { const x = new URL(typeof u === 'string' ? u : u.url, ORIGEN); return x.pathname; };
  const crearCache = datos => ({
    async match(r) { const g = datos.get(ruta(r)); return g ? new Response(g.cuerpo, { status: g.status }) : undefined; },
    async put(r, resp) { datos.set(ruta(r), { cuerpo: await resp.text(), status: resp.status }); },
    async keys() { return [...datos.keys()].map(p => ({ url: ORIGEN + p })); },
    async delete(r) { return datos.delete(ruta(r)); },
  });
  const caches = {
    async open(n) { if (!almacenes.has(n)) almacenes.set(n, new Map()); return crearCache(almacenes.get(n)); },
    async keys() { return [...almacenes.keys()]; },
    async delete(n) { estado.borradas.push(n); return almacenes.delete(n); },
  };
  const fetchFalso = async (r) => {
    const p = ruta(r); estado.llamadas.push(p);
    if (estado.lenta && p === '/') await estado.lenta;
    if (!estado.enLinea) throw new TypeError('Failed to fetch');
    const c = estado.rutas[p];
    return c === undefined ? new Response('no', { status: 404 }) : new Response(typeof c === 'object' ? c.cuerpo : c, { status: typeof c === 'object' ? c.status : 200 });
  };
  const self = { location: { origin: ORIGEN }, addEventListener: (t, f) => { oyentes[t] = f; }, skipWaiting: async () => { estado.skip = true; }, clients: { claim: async () => { estado.claimed = true; } } };
  const ctx = { self, caches, fetch: fetchFalso, Response, URL, console, setTimeout: (f, ms) => setTimeout(f, ms >= 3000 ? 0 : ms) };
  vm.createContext(ctx); vm.runInContext(CODIGO, ctx);
  const evento = (tipo, extra = {}) => {
    const e = { ...extra, esperas: [], respuesta: undefined, waitUntil(p) { this.esperas.push(p); }, respondWith(p) { this.respuesta = p; } };
    oyentes[tipo](e); return e;
  };
  const pedir = (url, { modo = 'cors', metodo = 'GET' } = {}) => evento('fetch', { request: { url: url.startsWith('http') ? url : ORIGEN + url, method: metodo, mode: modo } });
  const terminar = async e => { await Promise.allSettled(e.esperas); };
  return { estado, almacenes, evento, pedir, terminar, oyentes };
}
const texto = async e => (await e.respuesta).text();

test('instalar: guarda la página, los iconos y todo lo que la página nombra (incluidas las fuentes de la hoja de estilos)', async () => {
  const t = entorno(); const e = t.evento('install'); await Promise.all(e.esperas);
  const c = t.almacenes.get('timerpiano-v1');
  for (const p of ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-icon.png', '/favicon.ico', '/_next/static/css/app.css', '/_next/static/chunks/main.js', '/_next/static/chunks/lazy.js', '/_next/static/chunks/app/page-abc123.js', '/_next/static/media/f.woff2']) assert.ok(c.has(p), 'guardado ' + p);
  assert.equal(t.estado.skip, true);
});

test('instalar sin red: no falla (se guarda en la próxima visita)', async () => {
  const t = entorno({ enLinea: false }); const e = t.evento('install'); await Promise.all(e.esperas);
  assert.equal(t.almacenes.get('timerpiano-v1').size, 0); assert.equal(t.estado.skip, true);
});

test('abrir la página con internet: sirve la de la red, actualiza la copia y guarda los archivos nuevos', async () => {
  const t = entorno(); t.evento('install'); await t.terminar(t.evento('install'));
  t.estado.rutas['/'] = HTML.replace('main.js', 'main2.js') ; t.estado.rutas['/_next/static/chunks/main2.js'] = 'main2';
  const e = t.pedir('/', { modo: 'navigate' });
  assert.match(await texto(e), /main2\.js/, 'la red manda'); await t.terminar(e);
  const c = t.almacenes.get('timerpiano-v1');
  assert.match(c.get('/').cuerpo, /main2\.js/); assert.ok(c.has('/_next/static/chunks/main2.js'), 'sus archivos nuevos también');
});

test('abrir la página sin internet: sirve la copia guardada y sus archivos salen de la copia', async () => {
  const t = entorno(); await Promise.all(t.evento('install').esperas);
  t.estado.enLinea = false; t.estado.llamadas.length = 0;
  const e = t.pedir('/', { modo: 'navigate' });
  assert.match(await texto(e), /_next\/static\/chunks\/main\.js/); await t.terminar(e);
  for (const p of ['/_next/static/css/app.css', '/_next/static/chunks/main.js', '/_next/static/media/f.woff2']) assert.equal(await texto(t.pedir(p)), t.estado.rutas[p], p);
  for (const p of ['/manifest.json', '/icon-192.png']) assert.equal(await texto(t.pedir(p)), t.estado.rutas[p], p);
  assert.equal(t.estado.llamadas.filter(p => p.startsWith('/_next/static/')).length, 0, 'los archivos con código en el nombre ni intentan la red');
});

test('con la red lenta (más de 3 s) sirve la copia al momento y la red la actualiza después', async () => {
  let soltar; const espera = new Promise(r => { soltar = r; });
  const t = entorno(); await Promise.all(t.evento('install').esperas);
  t.estado.lenta = espera; t.estado.rutas['/'] = HTML + '<!--nueva-->';
  const e = t.pedir('/', { modo: 'navigate' });
  assert.ok(!/nueva/.test(await texto(e)), 'sirvió la copia sin esperar');
  soltar(); await t.terminar(e);
  assert.match(t.almacenes.get('timerpiano-v1').get('/').cuerpo, /nueva/, 'la copia se actualizó cuando llegó la red');
});

test('si la red responde con error no se pisa la copia buena', async () => {
  const t = entorno(); await Promise.all(t.evento('install').esperas);
  t.estado.rutas['/'] = { cuerpo: 'error del servidor', status: 500 };
  const e = t.pedir('/', { modo: 'navigate' }); const cuerpo = await texto(e); await t.terminar(e);
  assert.match(cuerpo, /_next\/static/, 'se sirve la copia buena'); assert.match(t.almacenes.get('timerpiano-v1').get('/').cuerpo, /_next\/static/);
});

test('sin internet y sin copia, no inventa nada: falla como cualquier página sin conexión', async () => {
  const t = entorno({ enLinea: false });
  const e = t.pedir('/', { modo: 'navigate' });
  await assert.rejects(Promise.resolve(e.respuesta)); await t.terminar(e);
});

test('archivos de /_next/static: primero lo guardado, y lo que se descarga se guarda para después', async () => {
  const t = entorno();
  assert.equal(await texto(t.pedir('/_next/static/chunks/main.js')), 'main');
  t.estado.enLinea = false; t.estado.llamadas.length = 0;
  assert.equal(await texto(t.pedir('/_next/static/chunks/main.js')), 'main'); assert.equal(t.estado.llamadas.length, 0, 'ni intentó la red');
  await assert.rejects(Promise.resolve(t.pedir('/_next/static/chunks/otro.js').respuesta), 'lo que nunca se guardó falla sin red');
});

test('no toca la nube ni lo que no es suyo: /api, POST y otros sitios van directo a la red', async () => {
  const t = entorno();
  for (const e of [t.pedir('/api/sync'), t.pedir('/api/entrar', { metodo: 'POST' }), t.pedir('https://otro.sitio/x.js'), t.pedir('/', { modo: 'navigate', metodo: 'POST' })]) assert.equal(e.respuesta, undefined);
});

test('actualizar: borra las cachés viejas de TimerPiano, respeta las de otras apps y toma el control', async () => {
  const t = entorno(); t.almacenes.set('timerpiano-v0', new Map()); t.almacenes.set('otra-app', new Map()); t.almacenes.set('timerpiano-v1', new Map());
  await Promise.all(t.evento('activate').esperas);
  assert.deepEqual(t.estado.borradas, ['timerpiano-v0']); assert.ok(t.almacenes.has('otra-app') && t.almacenes.has('timerpiano-v1')); assert.equal(t.estado.claimed, true);
});

test('la caché no crece sin fin: conserva los 150 archivos más nuevos', async () => {
  const rutas = SITIO(); for (let i = 0; i < 170; i++) rutas[`/_next/static/chunks/c${i}.js`] = 'c' + i;
  const t = entorno({ rutas });
  for (let i = 0; i < 170; i++) await texto(t.pedir(`/_next/static/chunks/c${i}.js`));
  t.estado.rutas['/'] = '<html>' + '</html>'; const e = t.pedir('/', { modo: 'navigate' }); await texto(e); await t.terminar(e);       // al guardar la página se recorta
  const estaticos = [...t.almacenes.get('timerpiano-v1').keys()].filter(p => p.startsWith('/_next/static/'));
  assert.equal(estaticos.length, 150); assert.ok(!estaticos.includes('/_next/static/chunks/c0.js') && estaticos.includes('/_next/static/chunks/c169.js'));
});
