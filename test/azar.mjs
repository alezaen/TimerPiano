// Toques al azar (opcional) en TimerPiano, con un navegador real a 360 px: toca botones, escribe cosas raras en las casillas, adelanta el reloj
// (segundos o horas), recarga, corta la red y daña los datos guardados. Solo busca errores de JavaScript y pantallas que se quedan en blanco.
// Ejecutar: npm run test:azar      AZAR_PASOS=300 (por defecto 150)   AZAR_SEMILLA=123 repite una corrida   AZAR_RONDAS=3
import { arrancar } from './ayuda-navegador.mjs';

const PASOS = Number(process.env.AZAR_PASOS) || 150, RONDAS = Number(process.env.AZAR_RONDAS) || 2;
const SEMILLA = Number(process.env.AZAR_SEMILLA) || (Date.now() % 1e9);
let s = SEMILLA; const azar = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const elegir = a => a[Math.floor(azar() * a.length)];
console.log(`Toques al azar en TimerPiano: semilla ${SEMILLA}, ${PASOS} pasos × ${RONDAS} rondas (repetir: AZAR_SEMILLA=${SEMILLA})`);
const TEXTOS = ['', '0', '5', '7', '120', '121', '-3', '99999', 'abc', '١٢', '1e3', ' 8 ', '💥', '<b>x</b>'];
const SALTOS = [1000, 5000, 61000, 301000, 600000, 3600000, 86400000];
const BAD = ['{"state":', 'null', '7', '{"state":{"sessions":null},"version":3}', '{"state":{"minutes":null,"session":{"blocks":[]}},"version":3}', '{"state":{"history":{"x":1}},"version":2}'];

const app = await arrancar(), fallos = [];
for (let ronda = 1; ronda <= RONDAS; ronda++) {
  const { pagina, ctx } = await app.telefono({ hora: new Date('2026-11-17T00:00:00Z') }), p = await pagina(), bitacora = [];
  await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor();
  for (let i = 0; i < PASOS; i++) {
    const r = azar();
    try {
      if (r < 0.50) {
        const cand = p.locator('button:visible, a[href^="#"]:visible'), n = await cand.count();
        if (n) { const el = cand.nth(Math.floor(azar() * n)); bitacora.push('toca ' + ((await el.getAttribute('aria-label')) || (await el.textContent() || '').trim().slice(0, 25))); await el.click({ timeout: 800, force: false }); }
      } else if (r < 0.65) {
        const cand = p.locator('input:visible'), n = await cand.count();
        if (n) { const el = cand.nth(Math.floor(azar() * n)), v = elegir(TEXTOS); bitacora.push(`escribe "${v}"`); await el.fill(v, { timeout: 800 }); if (azar() < 0.7) await el.press('Enter', { timeout: 800 }); }
      } else if (r < 0.80) { const ms = elegir(SALTOS); bitacora.push('reloj +' + ms / 1000 + ' s'); await p.clock.fastForward(ms); }
      else if (r < 0.86) { bitacora.push('recarga'); await p.reload(); }
      else if (r < 0.90) { const off = azar() < 0.5; bitacora.push(off ? 'sin red' : 'con red'); await ctx.setOffline(off); }
      else if (r < 0.93) { const v = elegir(BAD); bitacora.push('daña datos'); await p.evaluate(x => localStorage.setItem('timerpiano-v2', x), v); }
      else if (r < 0.96) { bitacora.push('enlace plan'); await p.evaluate(h => { location.hash = h; }, elegir(['#plan=solfeo-5,oido-5', '#plan=zz', '#plan=solfeo-125', ''])); }
      else if (r < 0.98) { bitacora.push('oculta y muestra'); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); }
      else { bitacora.push('atrás'); await p.goBack({ timeout: 800 }).catch(() => {}); if (!p.url().startsWith(app.url)) await p.goto(app.url); }
    } catch (e) { if (!/Timeout|detached|not visible|intercepts|closed|Execution context|navigat/i.test(e.message)) { fallos.push(`ronda ${ronda}, paso ${i}: ${e.message.split('\n')[0]}`); break; } }
    if (p.errores.length) { fallos.push(`ronda ${ronda}, paso ${i}: ${p.errores[0].slice(0, 300)}\n   últimos pasos: ${bitacora.slice(-10).join(' → ')}`); break; }
    const vacia = await p.evaluate(() => document.body.innerText.trim().length < 5).catch(() => false);
    if (vacia && i % 5 === 0) { await p.waitForTimeout(400); if (await p.evaluate(() => document.body.innerText.trim().length < 5).catch(() => false)) { fallos.push(`ronda ${ronda}, paso ${i}: la pantalla quedó en blanco\n   últimos pasos: ${bitacora.slice(-10).join(' → ')}`); break; } }
  }
  await ctx.close().catch(() => {});
}
await app.cerrar();
if (fallos.length) { console.error('\nERRORES ENCONTRADOS:\n' + fallos.join('\n\n') + `\n\nRepetir: AZAR_SEMILLA=${SEMILLA} AZAR_PASOS=${PASOS} AZAR_RONDAS=${RONDAS} npm run test:azar`); process.exit(1); }
console.log('Sin errores de JavaScript ni pantallas en blanco.'); process.exit(0);
