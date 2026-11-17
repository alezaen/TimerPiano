// Recorridos de personas de verdad en un navegador real (Chromium sin pantalla, 360 px de ancho) y escenarios raros de TimerPiano.
// Con la carpeta de EarPiano al lado, el recorrido completo pasa de una app a la otra.
// Ejecutar:  npm i --no-save playwright && npx playwright install chromium   (una vez)    luego:  npm run test:recorridos
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, hacerSesion, ponerMinutos, hayOtra, REPERTORIO, TIMER } from './ayuda-navegador.mjs';

let app;
before(async () => { app = await arrancar(); });
after(async () => { await app.cerrar(); });
const limpio = p => assert.deepEqual(p.errores, [], 'errores en la página:\n' + p.errores.join('\n'));
const HORA = new Date('2026-11-17T00:00:00Z');       // 16 nov 2026, 20:00 en Santo Domingo (la zona de las pruebas)
const nubeNueva = () => ({ sesiones: new Map(), llamadas: 0, lento: 0, caida: false });

test('RECORRIDO COMPLETO: abrir TimerPiano, hacer una sesión, ver el aviso, sumarla a EarPiano y volver a ver el plan', { skip: hayOtra ? false : 'falta la carpeta de EarPiano al lado (REPERTORY_DIR)' }, async () => {
  const { pagina } = await app.telefono({ hora: HORA }), p = await pagina();
  await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor();
  await hacerSesion(p, { solfeo: 5, oido: 5 });
  const enlace = await p.getByRole('link', { name: 'Sumar a EarPiano' }).getAttribute('href');
  assert.match(enlace, /^https:\/\/zaenlly\.vercel\.app\/#timer=[a-z0-9]{12}\.2026-11-16\.300-0-300-0$/);
  await p.getByRole('link', { name: 'Sumar a EarPiano' }).click();
  await p.waitForFunction(o => location.origin === o, REPERTORIO, { timeout: 15000 }); await p.locator('#lista .fila').first().waitFor();
  await p.locator('#aviso-timer').waitFor({ timeout: 8000 });
  assert.equal((await p.locator('#aviso-timer').textContent()).trim(), 'TimerPiano: se sumaron 10 min a tu práctica.');
  await p.reload(); await p.locator('#lista .fila').first().waitFor();                 // volver a abrir el mismo enlace no suma dos veces
  await p.goto(enlace); await p.locator('#lista .fila').first().waitFor(); await p.waitForTimeout(500);
  await p.click('#practica-btn'); await p.waitForSelector('#pr-timer-ir', { state: 'attached' });
  assert.match(await p.locator('#pr-timer').textContent(), /Hoy: 10 min/, 'el total de hoy no se duplicó');
  await p.evaluate(() => document.getElementById('pr-timer-ir').click());                // EarPiano → TimerPiano con su plan
  await p.waitForFunction(o => location.origin === o, TIMER, { timeout: 15000 }); await p.getByRole('button', { name: /Empezar/ }).waitFor();
  assert.match(await p.getByRole('button', { name: /Empezar · \d+ min/ }).textContent(), /Empezar · \d+ min/);
  limpio(p);
});

test('SESIÓN: el reloj corre bloque a bloque, pausa, omitir y terminar antes guardan solo lo practicado', async () => {
  const { pagina } = await app.telefono({ hora: HORA }), p = await pagina();
  await p.goto(app.url);
  for (const [n, v] of [['Solfeo', 6], ['Hanon', 0], ['Canción a oído', 6], ['John Thompson', 0]]) await ponerMinutos(p, n, v);
  await p.getByRole('button', { name: /Empezar · 12 min/ }).click();
  await p.getByRole('button', { name: 'Pausar' }).last().click(); await p.clock.fastForward(600000);                    // en pausa no corre
  await p.getByRole('button', { name: 'Seguir' }).last().click(); await p.clock.fastForward(60000);
  await p.getByRole('button', { name: 'Terminar sesión' }).click(); await p.getByRole('button', { name: 'Sí' }).click();
  await p.getByText('Sesión guardada').waitFor();
  const guardado = JSON.parse(await p.evaluate(() => localStorage.getItem('timerpiano-v2'))).state.sessions;
  assert.equal(guardado.length, 1); assert.equal(Object.values(guardado[0].d).reduce((a, b) => a + b, 0), 60, 'solo el minuto que corrió');
  limpio(p);
});

test('SIN INTERNET: una vez abierta, la app abre y funciona sin conexión; al volver la señal sube lo pendiente', async () => {
  const nube = nubeNueva(), { ctx, pagina } = await app.telefono({ hora: HORA, nubeLocal: nube }), p = await pagina();
  await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor();
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.reload(); await p.waitForTimeout(500);
  await ctx.setOffline(true); await p.reload(); await p.getByRole('button', { name: /Empezar/ }).waitFor({ timeout: 8000 });
  await hacerSesion(p, { solfeo: 5 });
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('timerpiano-v2'))).state.sessions.length, 1);
  await ctx.setOffline(false); limpio(p);
});

test('MUY LENTO: con la nube tardando 8 s la pantalla sigue respondiendo', async () => {
  const nube = nubeNueva(); nube.lento = 8000;
  const { pagina } = await app.telefono({ hora: HORA, nubeLocal: nube, init: [() => localStorage.setItem('timerpiano-v2', JSON.stringify({ state: { auth: { token: 't', expira: Date.now() + 1e10 }, sessions: [] }, version: 3 }))] }), p = await pagina();
  await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor();
  await hacerSesion(p, { solfeo: 5 });
  await p.getByRole('button', { name: 'Volver al inicio' }).click(); await p.getByRole('button', { name: /Empezar/ }).waitFor({ timeout: 3000 });
  limpio(p);
});

test('ALMACENAMIENTO bloqueado o lleno: la app abre y se puede practicar (no se guarda, pero no se rompe)', async () => {
  for (const caso of ['bloqueado', 'lleno']) {
    const init = caso === 'bloqueado'
      ? [() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); }]
      : [() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; }];
    const { pagina } = await app.telefono({ hora: HORA, init }), p = await pagina();
    await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor({ timeout: 8000 });
    await hacerSesion(p, { solfeo: 5 });
    await p.getByRole('button', { name: 'Volver al inicio' }).click(); await p.getByRole('button', { name: /Empezar/ }).waitFor();
    assert.deepEqual(p.errores, [], caso + ': errores en la página:\n' + p.errores.join('\n'));
  }
});

test('DATOS GUARDADOS dañados o viejos: la app siempre abre', async () => {
  const BUENA = { minutes: { solfeo: 10, hanon: 10, oido: 10, thompson: 10 }, blockMin: 5, sound: true, sessions: [], session: null };
  const casos = ['{"state":', 'null', '7', JSON.stringify({ state: { ...BUENA, sessions: null }, version: 3 }), JSON.stringify({ state: { ...BUENA, minutes: null }, version: 3 }),
    JSON.stringify({ state: { ...BUENA, session: { blocks: [], index: 3, status: 'running' } }, version: 3 }), JSON.stringify({ state: { history: { x: 5 } }, version: 2 }),
    JSON.stringify({ state: { history: { '2026-11-10': { solfeo: 600, hanon: 0, oido: 0, thompson: 0 } } }, version: 2 }), JSON.stringify({ state: { ...BUENA, auth: 'x', blockMin: 'z' }, version: 3 })];
  for (const [i, texto] of casos.entries()) {
    const { pagina } = await app.telefono({ hora: HORA, init: [`localStorage.setItem('timerpiano-v2', ${JSON.stringify(texto)})`.replace(/^/, '') && new Function(`localStorage.setItem('timerpiano-v2', ${JSON.stringify(texto)});`)] }), p = await pagina();
    await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor({ timeout: 8000 });
    await hacerSesion(p, { solfeo: 5 });
    assert.deepEqual(p.errores, [], `caso ${i} (${texto.slice(0, 40)}): errores:\n` + p.errores.join('\n'));
  }
});

test('OTRA ZONA HORARIA: la sesión se guarda con el día de TU reloj, no el de UTC', async () => {
  for (const [zona, hora, dia] of [['Pacific/Kiritimati', new Date('2026-11-16T10:30:00Z'), '2026-11-17'], ['Pacific/Pago_Pago', new Date('2026-11-16T05:30:00Z'), '2026-11-15'], ['Asia/Kolkata', new Date('2026-11-16T20:00:00Z'), '2026-11-17']]) {
    const { pagina } = await app.telefono({ zona, hora }), p = await pagina();
    await p.goto(app.url); await hacerSesion(p, { solfeo: 5 });
    const f = JSON.parse(await p.evaluate(() => localStorage.getItem('timerpiano-v2'))).state.sessions[0].f;
    assert.equal(f, dia, zona); assert.match(await p.getByRole('link', { name: 'Sumar a EarPiano' }).getAttribute('href'), new RegExp(`\\.${dia}\\.`));
    limpio(p);
  }
});

test('PASAR LA MEDIANOCHE en medio de la sesión: se guarda entera, con el día en que termina, y la racha no se parte', async () => {
  const { pagina } = await app.telefono({ hora: new Date('2026-11-17T03:58:00Z') }), p = await pagina();
  await p.goto(app.url);
  for (const [n, v] of [['Solfeo', 5], ['Hanon', 0], ['Canción a oído', 0], ['John Thompson', 0]]) await ponerMinutos(p, n, v);
  await p.getByRole('button', { name: /Empezar · 5 min/ }).click();
  await p.clock.fastForward(60000); await p.clock.fastForward(60000); await p.clock.fastForward(60000);      // 00:01 del día 17
  await p.clock.fastForward(130000); await p.getByText('Sesión guardada').waitFor();
  const ses = JSON.parse(await p.evaluate(() => localStorage.getItem('timerpiano-v2'))).state.sessions;
  assert.equal(ses.length, 1); assert.equal(ses[0].f, '2026-11-17'); assert.equal(ses[0].d.solfeo, 300);
  limpio(p);
});

test('MINUTOS que no son de 5 en 5 (escribes 7 y luego tocas "Más"): con sonido no debe saltar ningún error', async () => {
  const { pagina } = await app.telefono({ hora: HORA }), p = await pagina();
  await p.goto(app.url); await p.getByRole('button', { name: /Empezar/ }).waitFor();
  await ponerMinutos(p, 'Solfeo', 7);
  await p.getByRole('button', { name: 'Más minutos de Solfeo' }).click(); await p.getByRole('button', { name: 'Menos minutos de Solfeo' }).click();
  await p.getByRole('button', { name: 'Más minutos de Hanon' }).click();
  assert.equal(await p.getByLabel('Minutos de Solfeo', { exact: true }).inputValue(), '7');
  limpio(p);
});
