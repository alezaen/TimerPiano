// Pruebas de la lógica de TimerPiano (lib/*.ts): plan, enlace a EarPiano, mezcla de sesiones, estadísticas, validación del servidor y bloques.
// Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarLib } from './ayuda-ts.mjs';

const plan = await cargarLib('lib/plan.ts'), links = await cargarLib('lib/links.ts'), sync = await cargarLib('lib/sync.ts');
const stats = await cargarLib('lib/stats.ts'), val = await cargarLib('lib/server/validar.ts'), inter = await cargarLib('lib/interleave.ts'), areas = await cargarLib('lib/areas.ts');
const dia = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi);
const conReloj = async (fecha, fn) => { const Real = Date; globalThis.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(fecha.getTime()); } static now() { return fecha.getTime(); } }; try { return await fn(); } finally { globalThis.Date = Real; } };

test('leerPlan: solo áreas conocidas y minutos de 5 en 5 hasta 120', () => {
  assert.deepEqual(plan.leerPlan('#plan=solfeo-5,oido-5'), { solfeo: 5, oido: 5 });
  assert.deepEqual(plan.leerPlan('#plan=solfeo-120,hanon-0,thompson-15'), { solfeo: 120, hanon: 0, thompson: 15 });
  assert.deepEqual(plan.leerPlan('#plan=solfeo-7,oido-5'), { oido: 5 });
  for (const mal of ['', '#plan=', '#plan=piano-5', '#plan=solfeo-125', '#plan=solfeo', '#plan=solfeo--5', '#plan=solfeo-5;oido-5', '#plan=' + 'solfeo-5,'.repeat(20), '#plan=<script>', '#PLAN=solfeo-5', 'plan=solfeo-5', '#plan=solfeo-5.5', '#plan=solfeo-1e2'])
    assert.equal(plan.leerPlan(mal), null, JSON.stringify(mal));
});

test('enlace a EarPiano: formato #timer=ID.FECHA.s-h-o-t con los segundos por área, en el orden de las áreas', () => {
  const rec = { id: 'abc123def456', f: '2026-11-16', d: { solfeo: 300, hanon: 120, oido: 0, thompson: 60 } };
  assert.equal(links.repertorioConSesion(rec), 'https://zaenlly.vercel.app/#timer=abc123def456.2026-11-16.300-120-0-60');
  assert.deepEqual(areas.AREA_IDS, ['solfeo', 'hanon', 'oido', 'thompson']);
});

test('uid: 12 caracteres a-z0-9 (lo que exige el servidor) y casi nunca se repite', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => sync.uid()));
  assert.equal(ids.size, 2000);
  for (const id of ids) assert.match(id, /^[a-z0-9]{12}$/);
});

test('mezclar: lo del servidor manda, lo que solo está aquí queda pendiente, sin duplicados y en orden', () => {
  const s = (id, f, p) => ({ id, f, d: { solfeo: 60, hanon: 0, oido: 0, thompson: 0 }, ...(p ? { p: 1 } : {}) });
  const r = sync.mezclar([s('aaaaaaaa1', '2026-11-15'), s('bbbbbbbb2', '2026-11-16', true)], [s('aaaaaaaa1', '2026-11-15', true), s('cccccccc3', '2026-11-14')]);
  assert.deepEqual(r.map(x => x.id), ['cccccccc3', 'aaaaaaaa1', 'bbbbbbbb2']);
  assert.equal(r[1].p, undefined, 'lo que ya está en el servidor deja de ser pendiente'); assert.equal(r[2].p, 1);
  assert.deepEqual(sync.pendientes(r).map(x => x.id), ['bbbbbbbb2']);
  const muchas = Array.from({ length: 1200 }, (_, i) => s('x' + String(i).padStart(8, '0'), '2026-01-01'));
  assert.equal(sync.mezclar(muchas, []).length, sync.MAX_SESSIONS);
  assert.deepEqual(sync.mezclar([], []), []);
});

test('dayKey, racha y últimos días con la fecha del reloj de la persona (no la de UTC)', async () => {
  assert.equal(stats.dayKey(dia(2026, 1, 5)), '2026-01-05'); assert.equal(stats.dayKey(dia(2026, 12, 31, 23, 59)), '2026-12-31'); assert.equal(stats.dayKey(dia(2026, 3, 1, 0, 0)), '2026-03-01');
  const h = n => ({ solfeo: n, hanon: 0, oido: 0, thompson: 0 });
  await conReloj(dia(2026, 11, 16, 9), () => {
    assert.equal(stats.streak({}), 0);
    assert.equal(stats.streak({ '2026-11-16': h(60) }), 1);
    assert.equal(stats.streak({ '2026-11-16': h(59) }), 0, '59 s no cuentan');
    assert.equal(stats.streak({ '2026-11-15': h(600), '2026-11-14': h(600) }), 2, 'si hoy aún no practicaste, cuenta desde ayer');
    assert.equal(stats.streak({ '2026-11-16': h(60), '2026-11-15': h(60), '2026-11-13': h(60) }), 2, 'un hueco corta la racha');
    assert.equal(stats.streak({ '2026-11-30': h(600) }), 0, 'fechas del futuro no cuentan');
    assert.deepEqual(stats.lastDays(3).map(x => x.key), ['2026-11-14', '2026-11-15', '2026-11-16']);
    assert.equal(stats.lastDays(3)[2].isToday, true);
  });
  await conReloj(dia(2026, 3, 1, 0, 5), () => assert.deepEqual(stats.lastDays(2).map(x => x.key), ['2026-02-28', '2026-03-01'], 'cruce de mes'));
  await conReloj(dia(2027, 1, 1, 0, 5), () => assert.deepEqual(stats.lastDays(2).map(x => x.key), ['2026-12-31', '2027-01-01'], 'cruce de año'));
});

test('historyOf suma varias sesiones del mismo día', () => {
  const r = stats.historyOf([{ id: 'a', f: '2026-11-16', d: { solfeo: 60, hanon: 0, oido: 0, thompson: 0 } }, { id: 'b', f: '2026-11-16', d: { solfeo: 30, hanon: 10, oido: 0, thompson: 0 } }]);
  assert.deepEqual(r, { '2026-11-16': { solfeo: 90, hanon: 10, oido: 0, thompson: 0 } });
});

test('servidor: limpiarSesion acepta lo bueno y rechaza lo raro, y todo lo que manda esta app es aceptado', () => {
  const ok = { id: 'abc123def456', f: '2026-11-16', d: { solfeo: 300, hanon: 0, oido: 0, thompson: 60 } };
  assert.deepEqual(val.limpiarSesion({ ...ok, extra: 1, p: 1 }), ok);
  assert.ok(val.limpiarSesion({ ...ok, id: 'mig20261113' }), 'ids de sesiones migradas (11 caracteres)');
  assert.ok(val.limpiarSesion({ ...ok, d: { solfeo: 7200, hanon: 7200, oido: 7200, thompson: 7200 } }), 'el máximo que se puede planear');
  for (const mal of [null, 5, 'x', [], {}, { ...ok, id: 'ABC' }, { ...ok, id: 'a'.repeat(25) }, { ...ok, f: '2026-13-01' }, { ...ok, f: '2026-02-30' }, { ...ok, f: '16-11-2026' }, { ...ok, d: null },
    { ...ok, d: { solfeo: -1, hanon: 0, oido: 0, thompson: 0 } }, { ...ok, d: { solfeo: 1.5, hanon: 0, oido: 0, thompson: 0 } }, { ...ok, d: { solfeo: '60', hanon: 0, oido: 0, thompson: 0 } },
    { ...ok, d: { solfeo: 0, hanon: 0, oido: 0, thompson: 0 } }, { ...ok, d: { solfeo: 60 } }, { ...ok, d: { solfeo: 99999, hanon: 0, oido: 0, thompson: 0 } }])
    assert.equal(val.limpiarSesion(mal), null, JSON.stringify(mal));
});

test('servidor: limpiarAjustes', () => {
  const ok = { minutes: { solfeo: 10, hanon: 10, oido: 0, thompson: 120 }, blockMin: 5, ts: Date.now() };
  assert.deepEqual(val.limpiarAjustes(ok), ok);
  for (const mal of [null, 3, {}, { ...ok, blockMin: 4 }, { ...ok, ts: 0 }, { ...ok, ts: Date.now() + 9e8 }, { ...ok, minutes: { solfeo: 121, hanon: 0, oido: 0, thompson: 0 } }, { ...ok, minutes: { solfeo: 1 } }, { ...ok, minutes: null }])
    assert.equal(val.limpiarAjustes(mal), null, JSON.stringify(mal));
});

test('bloques: suman justo lo pedido, ninguno pasa del tamaño y no se repite el área (si se puede)', () => {
  const azar = (() => { let s = 3; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();
  assert.deepEqual(inter.splitMinutes(0, 5), []); assert.deepEqual(inter.splitMinutes(12, 5), [4, 4, 4]); assert.deepEqual(inter.splitMinutes(11, 5), [4, 4, 3]); assert.deepEqual(inter.splitMinutes(5, 5), [5]);
  for (let i = 0; i < 400; i++) {
    const m = { solfeo: Math.floor(azar() * 25) * 5 % 125, hanon: Math.floor(azar() * 5) * 5, oido: Math.floor(azar() * 5) * 5, thompson: Math.floor(azar() * 5) * 5 }, b = [3, 5, 10][i % 3];
    const bloques = inter.buildBlocks(m, b, azar);
    for (const id of areas.AREA_IDS) assert.equal(bloques.filter(x => x.area === id).reduce((s, x) => s + x.seconds, 0), m[id] * 60, id);
    assert.ok(bloques.every(x => x.seconds > 0 && x.seconds <= b * 60));
    const activas = areas.AREA_IDS.filter(id => m[id] > 0).length;
    if (activas > 1 && Math.max(...areas.AREA_IDS.map(id => Math.ceil(m[id] / b))) * 2 <= bloques.length + 1) for (let k = 1; k < bloques.length; k++) assert.notEqual(bloques[k].area, bloques[k - 1].area, 'misma área dos veces seguidas: ' + JSON.stringify(m));
  }
  assert.deepEqual(inter.buildBlocks({ solfeo: 0, hanon: 0, oido: 0, thompson: 0 }, 5), []);
  assert.equal(inter.buildBlocks({ solfeo: 10, hanon: 0, oido: 0, thompson: 0 }, 5).length, 2);
});
