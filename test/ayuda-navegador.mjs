// Ayudas para las pruebas con navegador REAL sin pantalla (Chromium con Playwright): arranca la app compilada, simula la nube y, si la carpeta de
// EarPiano está al lado (../Repertory o REPERTORY_DIR), también la sirve, para recorrer las dos apps juntas en el mismo navegador.
// Se instala una vez:  npm i --no-save playwright && npx playwright install chromium     (la app se compila sola si falta: npm run build)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { createServer } from 'node:http';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const OTRA = process.env.REPERTORY_DIR || join(RAIZ, '..', 'Repertory');
export const hayOtra = await access(join(OTRA, 'timer.js')).then(() => true, () => false);
export const REPERTORIO = 'https://zaenlly.vercel.app', TIMER = 'https://zaenlly1.vercel.app';
export const ANCHO = 360, ALTO = 740;

const TIPOS = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const parte = (nombre, prog) => ({ nombre, tono: '', prog, letra: 'La la la\nLa la la', pista: '' });
const CANCIONES = { version: 2, nombre: 'EarPiano', intro: '', canciones: [
  { id: 'id0aleluya', titulo: 'Aleluya', artista: 'Artista A', tono: 'C', partes: [parte('Verso', 'C Am | F G'), parte('Coro', 'F G | Em Am')] },
  { id: 'id1grande', titulo: 'Cuán grande es Él', artista: 'Artista B', tono: 'G', partes: [parte('Coro', 'C G | D Em')] }] };

function correr(cmd, args) { return new Promise((ok, mal) => { const p = spawn(cmd, args, { cwd: RAIZ, stdio: 'inherit' }); p.on('exit', c => (c === 0 ? ok() : mal(new Error(cmd + ' terminó con ' + c)))); }); }
const hasta = async (fn, ms, que) => { const fin = Date.now() + ms; for (;;) { try { if (await fn()) return; } catch { /* aún no */ } if (Date.now() > fin) throw new Error('Se agotó la espera: ' + que); await new Promise(r => setTimeout(r, 200)); } };

export async function arrancar() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { console.error('Falta Playwright: npm i --no-save playwright && npx playwright install chromium'); process.exit(2); }
  if (!existsSync(join(RAIZ, '.next', 'BUILD_ID'))) { console.log('Compilando la app (npm run build)…'); await correr(process.execPath, ['node_modules/next/dist/bin/next', 'build']); }
  const puerto = 4100 + Math.floor(Math.random() * 800), url = `http://127.0.0.1:${puerto}`;
  const srv = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(puerto)], { cwd: RAIZ, stdio: 'ignore' });
  await hasta(async () => (await fetch(url)).ok, 30000, 'que arranque la app');
  const navegador = await chromium.launch();
  const nube = { sesiones: new Map(), llamadas: 0, lento: 0, caida: false };
  return {
    url, nube, navegador,
    /** Un teléfono nuevo: 360 px, claro u oscuro, con zona horaria y reloj opcionales. Las dos apps y la nube falsa ya están conectadas. */
    async telefono({ tema = 'claro', zona = 'America/Santo_Domingo', hora, init = [], nubeLocal = nube, offline = false } = {}) {
      const ctx = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: tema === 'oscuro' ? 'dark' : 'light', timezoneId: zona, locale: 'es-DO' });
      for (const s of init) await ctx.addInitScript(s);
      if (hora) { const pagina0 = await ctx.newPage(); await pagina0.clock.install({ time: hora }); await pagina0.close(); }
      await ctx.route('**/api/entrar', async r => {
        const { clave } = JSON.parse(r.request().postData() || '{}');
        if (clave !== 'prueba') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Clave incorrecta"}' });
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'tok', expira: Date.now() + 1e10 }) });
      });
      await ctx.route('**/api/sync', async r => {
        nubeLocal.llamadas++; if (nubeLocal.lento) await new Promise(ok => setTimeout(ok, nubeLocal.lento));
        if (nubeLocal.caida) return r.abort('failed');
        const c = JSON.parse(r.request().postData() || '{}'); for (const s of c.sesiones || []) nubeLocal.sesiones.set(s.id, s);
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sesiones: [...nubeLocal.sesiones.values()], ajustes: null }) });
      });
      await ctx.route(`${TIMER}/**`, async r => { const u = new URL(r.request().url()); try { await r.fulfill({ response: await r.fetch({ url: url + u.pathname + u.search }) }); } catch { await r.abort('failed'); } });   // el sitio de TimerPiano = esta app local
      await ctx.route(`${REPERTORIO}/**`, async r => {                                                                         // el sitio de EarPiano = su carpeta local
        if (!hayOtra) return r.fulfill({ status: 404, body: 'EarPiano no está al lado' });
        let ruta = new URL(r.request().url()).pathname; if (ruta === '/') ruta = '/index.html';
        if (ruta === '/api/canciones') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANCIONES) });
        if (ruta.startsWith('/api/')) return r.fulfill({ status: 503, body: '{}' });
        try { await r.fulfill({ status: 200, contentType: TIPOS[extname(ruta)] || 'application/octet-stream', body: await readFile(join(OTRA, ruta)) }); } catch { await r.fulfill({ status: 404, body: 'no existe' }); }
      });
      if (offline) await ctx.setOffline(true);
      const pagina = async () => {
        const p = await ctx.newPage(), errores = [];
        p.errores = errores; p.on('pageerror', e => errores.push('error: ' + e.message));
        p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|503|404|ERR_INTERNET|Failed to fetch|Blocked call to navigator.vibrate/.test(m.text())) errores.push('consola: ' + m.text()); });
        return p;
      };
      return { ctx, pagina };
    },
    async cerrar() { await navegador.close().catch(() => {}); srv.kill(); }
  };
}

/** Qué se sale del ancho en lo que se ve (se ejecuta dentro de la página). */
export const revisarCortes = () => {
  const ancho = document.documentElement.clientWidth, malos = [];
  if (document.documentElement.scrollWidth > ancho + 1) malos.push('la página se mueve de lado (ancho ' + document.documentElement.scrollWidth + ')');
  const desliza = el => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden], [inert]')) continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    if ((b.right > ancho + 1 || b.left < -1) && !desliza(el)) malos.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} (${Math.round(b.left)}→${Math.round(b.right)}) "${(el.textContent || '').trim().slice(0, 25)}"`);
  }
  return malos.slice(0, 6);
};

/** Escribe los minutos de un área y confirma con Enter (la casilla guarda al salir de ella). */
export async function ponerMinutos(p, nombre, v) { const c = p.getByLabel(`Minutos de ${nombre}`, { exact: true }); await c.fill(String(v)); await c.press('Enter'); }

/** Pasa un teléfono por una sesión corta: pone minutos, empieza y deja correr el reloj hasta terminar. */
export async function hacerSesion(p, { solfeo = 5, hanon = 0, oido = 0, thompson = 0 } = {}) {
  for (const [n, v] of Object.entries({ Solfeo: solfeo, Hanon: hanon, 'Canción a oído': oido, 'John Thompson': thompson })) await ponerMinutos(p, n, v);
  const total = solfeo + hanon + oido + thompson;
  await p.getByRole('button', { name: new RegExp(`Empezar · ${total} min`) }).click();
  await p.clock.fastForward((total * 60 + 5) * 1000);
  await p.getByText(/Sesión (guardada|terminada)/).waitFor({ timeout: 8000 });
}
