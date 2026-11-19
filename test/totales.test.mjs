// Archivo de totales de TimerPiano (lib/server/totales.ts) y el pase compartido (lib/server/auth.ts). Ejecutar: npm test
// Si la carpeta de EarPiano está al lado (../Repertory o REPERTORY_DIR), el pase y los totales también se prueban contra su código real.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarLib } from './ayuda-ts.mjs';

const contrato = JSON.parse(await readFile(new URL('./contrato-puente.json', import.meta.url), 'utf8'));
process.env.SESSION_SECRET = contrato.pase.secreto; process.env.ADMIN_PASSWORD = 'clave-de-prueba-larga-123';
const tot = await cargarLib('lib/server/totales.ts'), auth = await cargarLib('lib/server/auth.ts');
const { sesiones, archivo } = contrato.totales;

test('almacén compartido entre cuentas: con EARPIANO_BLOB_TOKEN se usa ese token; sin él, el almacén propio', async () => {
  const alm = await cargarLib('lib/server/almacen.ts');
  assert.deepEqual(alm.opcionesBlob({}), {}); assert.deepEqual(alm.opcionesBlob({ EARPIANO_BLOB_TOKEN: '' }), {}); assert.deepEqual(alm.opcionesBlob({ EARPIANO_BLOB_TOKEN: '   ' }), {});
  assert.deepEqual(alm.opcionesBlob({ EARPIANO_BLOB_TOKEN: ' vercel_blob_rw_abc ' }), { token: 'vercel_blob_rw_abc' });
});

test('calcularTotales produce exactamente el archivo del contrato', () => {
  const t = tot.calcularTotales(sesiones, 123);
  assert.equal(t.actualizado, 123); const { actualizado, ...resto } = t;
  assert.deepEqual(JSON.parse(JSON.stringify(resto)), archivo);
  assert.deepEqual(JSON.parse(JSON.stringify(tot.calcularTotales([], 1))), { version: 1, actualizado: 1, sesiones: 0, ultimo: null, segundos: 0, areas: [0, 0, 0, 0], dias: {} });
});

test('calcularTotales: solo guarda los últimos 120 días, pero los totales de siempre cuentan todo', () => {
  const muchas = Array.from({ length: 300 }, (_, i) => ({ id: 'x' + String(i).padStart(8, '0'), f: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), d: { solfeo: 60, hanon: 0, oido: 0, thompson: 0 } }));
  const t = tot.calcularTotales(muchas); assert.equal(Object.keys(t.dias).length, tot.MAX_DIAS); assert.equal(t.sesiones, 300); assert.equal(t.segundos, 18000);
  assert.ok(t.dias[muchas.at(-1).f] && !t.dias[muchas[0].f]);
});

function almacenFalso() { const a = { datos: null, lecturas: 0, escrituras: 0, falla: false, leer: async () => { a.lecturas++; if (a.falla) throw new Error('sin red'); return a.datos ? { data: a.datos, etag: 'e' } : null; }, escribir: async (r, d) => { a.escrituras++; if (a.falla) throw new Error('sin red'); a.datos = d; } }; return a; }
test('actualizarTotales: crea el archivo la primera vez, no reescribe si ya está al día y se pone al día cuando llegan sesiones', async () => {
  const a = almacenFalso();
  assert.equal(await tot.actualizarTotales(sesiones, a, 1), true); assert.equal(a.escrituras, 1);
  assert.equal(await tot.actualizarTotales(sesiones, a, 2), false); assert.equal(a.escrituras, 1, 'sin cambios no escribe');
  const nueva = [...sesiones, { id: 'nueva1234abc', f: '2026-11-17', d: { solfeo: 60, hanon: 0, oido: 0, thompson: 0 } }];
  assert.equal(await tot.actualizarTotales(nueva, a, 3), true); assert.equal(a.datos.sesiones, 5); assert.equal(a.datos.segundos, 1477); assert.deepEqual(a.datos.dias['2026-11-17'], [60, 0, 0, 0]);
  a.datos = { version: 7, basura: true }; assert.equal(await tot.actualizarTotales(nueva, a, 4), true, 'un archivo raro se reemplaza');
});

test('actualizarTotales nunca lanza error: si el almacén falla, las sesiones no se ven afectadas', async () => {
  const a = almacenFalso(); a.falla = true;
  const callado = console.error; console.error = () => {};
  try { assert.equal(await tot.actualizarTotales(sesiones, a), false); } finally { console.error = callado; }
});

test('pase compartido: formato ep1 y se valida; el mismo pase sirve con el mismo secreto y no con otro', () => {
  const { token, expira } = auth.crearToken();
  assert.match(token, new RegExp(contrato.pase.formato)); assert.ok(expira > Date.now() + 29 * 864e5); assert.equal(auth.tokenValido(token), true);
  for (const malo of ['v1.9999999999999.' + 'a'.repeat(64), 'ep1.1.' + 'a'.repeat(64), '', null, {}, 'ep1.9999999999999.' + 'a'.repeat(64)]) assert.equal(auth.tokenValido(malo), false, String(malo));
  process.env.SESSION_SECRET = 'otro-secreto-distinto-bien-largo-0123456789'; assert.equal(auth.tokenValido(token), false); process.env.SESSION_SECRET = contrato.pase.secreto;
});

// --- las dos apps juntas, con su código real ---
const OTRA = process.env.REPERTORY_DIR || join(fileURLToPath(new URL('..', import.meta.url)), '..', 'Repertory');
const hayOtra = await access(join(OTRA, 'lib', 'auth.js')).then(() => true, () => false);
test('las dos apps juntas: un pase de TimerPiano lo acepta EarPiano (y al revés) y EarPiano entiende el archivo que escribe TimerPiano', { skip: hayOtra ? false : 'no está la carpeta de EarPiano al lado' }, async () => {
  const otra = await import(pathToFileURL(join(OTRA, 'lib', 'auth.js')).href + '?x=' + Math.random());
  assert.equal(otra.tokenValido(auth.crearToken().token), true, 'pase de TimerPiano en EarPiano'); assert.equal(auth.tokenValido(otra.crearToken().token), true, 'pase de EarPiano en TimerPiano');
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(await readFile(join(OTRA, 'timer.js'), 'utf8'), ctx);
  const { limpiarTotales } = await import(pathToFileURL(join(OTRA, 'lib', 'totales.js')).href);
  let s = 3; const az = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let ronda = 0; ronda < 60; ronda++) {
    const ses = Array.from({ length: 1 + Math.floor(az() * 40) }, (_, i) => ({ id: 'r' + ronda + 'x' + String(i).padStart(6, '0'), f: new Date(Date.UTC(2026, 9, 1 + Math.floor(az() * 40))).toISOString().slice(0, 10),
      d: Object.fromEntries(['solfeo', 'hanon', 'oido', 'thompson'].map(a => [a, az() < 0.4 ? 0 : Math.floor(az() * 7200)])) })).filter(x => Object.values(x.d).some(v => v > 0)); if (!ses.length) continue;
    const t = JSON.parse(JSON.stringify(tot.calcularTotales(ses))), leido = limpiarTotales(t); assert.ok(leido, 'EarPiano acepta el archivo'); assert.deepEqual(leido.dias, t.dias);
    const vm_ = ctx.RepertorioTimer.limpiarTotales(t); assert.deepEqual(JSON.parse(JSON.stringify(vm_.dias)), t.dias); assert.equal(vm_.sesiones, ses.length);
    // el resumen por días (de totales) coincide con el que daría sumar sesión por sesión
    const hoy = '2026-11-05'; let est = null; for (const x of ses) est = ctx.RepertorioTimer.agregar(est, { id: x.id, f: x.f, d: ['solfeo', 'hanon', 'oido', 'thompson'].map(a => x.d[a]) }).est;
    const a = JSON.parse(JSON.stringify(ctx.RepertorioTimer.resumenDeTotales(t, hoy))), b = JSON.parse(JSON.stringify(ctx.RepertorioTimer.resumen(est, hoy)));
    delete a.registros; delete b.registros; assert.deepEqual(a, b, 'ronda ' + ronda);
  }
});
