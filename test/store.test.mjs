// Pruebas del almacén de TimerPiano (lib/store.ts, zustand): sesión completa con reloj falso, medianoche, datos guardados dañados o viejos,
// almacenamiento bloqueado o lleno y sincronización con red caída, lenta o con errores. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarLib } from './ayuda-ts.mjs';

const RealDate = Date;
const reloj = { ms: new RealDate(2026, 10, 16, 20, 0, 0).getTime() };
class Falsa extends RealDate { constructor(...a) { if (a.length) super(...a); else super(reloj.ms); } static now() { return reloj.ms; } }
const memoria = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: k => void m.delete(k), _m: m }; };

/** Prepara un "dispositivo" y carga el almacén ya con esos datos guardados. almacen: 'normal' | 'bloqueado' | 'lleno' */
async function dispositivo({ guardado, almacen = 'normal', fetch: f } = {}) {
  const base = memoria();
  if (guardado !== undefined) base.setItem('timerpiano-v2', typeof guardado === 'string' ? guardado : JSON.stringify(guardado));
  const ls = almacen === 'lleno' ? { ...base, setItem() { throw new DOMException('quota', 'QuotaExceededError'); } } : base;
  if (almacen === 'bloqueado') Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: ls, writable: true });
  globalThis.window = globalThis;                        // zustand busca window.localStorage
  globalThis.Date = Falsa; globalThis.fetch = f || (async () => { throw new TypeError('sin red'); });
  const { useStore, remainingSeconds } = await cargarLib('lib/store.ts', { fresco: true });
  return { useStore, remainingSeconds, base, st: () => useStore.getState() };
}
test.afterEach(() => { globalThis.Date = RealDate; });
const HOY = '2026-11-16';

test('sesión completa: los bloques corren con el reloj, se guarda UNA sesión con id válido y fecha de hoy, pendiente de subir', async () => {
  const { st } = await dispositivo();
  st().start([{ area: 'solfeo', seconds: 300 }, { area: 'oido', seconds: 300 }]);
  reloj.ms += 301e3; st().tick(); assert.equal(st().session.index, 1); assert.equal(st().session.done.solfeo, 300);
  reloj.ms += 300e3; st().tick();
  assert.equal(st().session.status, 'done'); assert.equal(st().sessions.length, 1);
  const s = st().sessions[0]; assert.match(s.id, /^[a-z0-9]{12}$/); assert.equal(s.f, HOY); assert.deepEqual(s.d, { solfeo: 300, hanon: 0, oido: 300, thompson: 0 }); assert.equal(s.p, 1);
  assert.equal(st().session.recordId, s.id);
  st().tick(); st().tick(); assert.equal(st().sessions.length, 1, 'no se guarda dos veces');
});

test('el teléfono se bloquea y al volver pasaron varios bloques: se pone al día sin perder ni inventar tiempo', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime();
  const { st } = await dispositivo();
  st().start([{ area: 'solfeo', seconds: 180 }, { area: 'hanon', seconds: 180 }, { area: 'oido', seconds: 180 }]);
  reloj.ms += 400e3; st().tick();
  assert.equal(st().session.index, 2); assert.deepEqual(st().session.done, { solfeo: 180, hanon: 180, oido: 0, thompson: 0 });
  reloj.ms += 3600e3; st().tick(); assert.equal(st().session.status, 'done'); assert.equal(st().sessions[0].d.oido, 180);
});

test('omitir, pausar, seguir y terminar antes: se cuenta solo lo practicado', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime();
  const { st, remainingSeconds } = await dispositivo();
  st().start([{ area: 'solfeo', seconds: 300 }, { area: 'oido', seconds: 300 }]);
  reloj.ms += 100e3; st().pause(); assert.equal(st().session.remaining, 200);
  reloj.ms += 99999e3; assert.equal(remainingSeconds(st().session), 200, 'en pausa no corre');
  st().resume(); reloj.ms += 50e3; st().skip(); assert.equal(st().session.done.solfeo, 150); assert.equal(st().session.index, 1);
  reloj.ms += 10e3; st().finish(); assert.equal(st().session.status, 'done'); assert.deepEqual(st().sessions[0].d, { solfeo: 150, hanon: 0, oido: 10, thompson: 0 });
  st().close(); assert.equal(st().session, null);
  st().start([{ area: 'solfeo', seconds: 300 }]); st().finish(); assert.equal(st().sessions.length, 1, 'una sesión sin nada practicado no se guarda');
  assert.equal(st().session.recordId, null);
});

test('PASAR LA MEDIANOCHE: una sesión que empieza a las 23:55 y termina a las 00:05 se guarda entera con la fecha del momento en que termina', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 23, 55, 0).getTime();
  const { st } = await dispositivo();
  st().start([{ area: 'solfeo', seconds: 300 }, { area: 'oido', seconds: 300 }]);
  reloj.ms += 600e3; st().tick();
  assert.equal(st().session.status, 'done'); assert.equal(st().sessions.length, 1); assert.equal(st().sessions[0].f, '2026-11-17');
  assert.equal(st().sessions[0].d.solfeo + st().sessions[0].d.oido, 600, 'no se pierde ni se parte el tiempo');
});

test('al reabrir con una sesión corriendo queda en pausa y no cuenta el tiempo cerrado', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime();
  const a = await dispositivo(); a.st().start([{ area: 'solfeo', seconds: 300 }]); reloj.ms += 100e3;
  const guardado = a.base.getItem('timerpiano-v2'); assert.ok(guardado);
  reloj.ms += 7200e3;                                   // dos horas con la app cerrada
  const b = await dispositivo({ guardado });
  b.st().recover(); assert.equal(b.st().session.status, 'paused'); assert.equal(b.st().session.remaining, 300, 'vuelve al bloque entero, no al tiempo negativo');
});

test('DATOS GUARDADOS dañados o de versiones viejas: la app abre con lo normal o con lo que sirva, sin lanzar errores', async () => {
  const BUENA = { minutes: { solfeo: 10, hanon: 10, oido: 10, thompson: 10 }, blockMin: 5, sound: true, sessions: [], session: null };
  const casos = [
    ['JSON roto', '{"state":'], ['texto', 'hola'], ['null', 'null'], ['número', '7'], ['lista', '[]'],
    ['sin estado', { version: 3 }], ['estado nulo', { state: null, version: 3 }], ['estado texto', { state: 'x', version: 3 }],
    ['versión futura', { state: BUENA, version: 99 }], ['sin versión', { state: BUENA }],
    ['v2 con historial por día', { state: { history: { '2026-11-10': { solfeo: 600, hanon: 0, oido: 0, thompson: 0 } }, minutes: BUENA.minutes }, version: 2 }],
    ['v2 con historial roto', { state: { history: { 'x': 5, '2026-11-11': null } }, version: 2 }], ['v1', { state: { history: 7 }, version: 1 }],
    ['sesiones no es lista', { state: { ...BUENA, sessions: 'x' }, version: 3 }], ['sesiones nulas', { state: { ...BUENA, sessions: null }, version: 3 }],
    ['sesiones con basura', { state: { ...BUENA, sessions: [null, 5, {}, { id: 1 }, { id: 'abc123def456', f: '2026-11-16', d: null }] }, version: 3 }],
    ['minutos nulos', { state: { ...BUENA, minutes: null }, version: 3 }], ['minutos raros', { state: { ...BUENA, minutes: { solfeo: 'x', hanon: -5, oido: 9999 } }, version: 3 }],
    ['blockMin raro', { state: { ...BUENA, blockMin: 'x' }, version: 3 }], ['sesión en curso rota', { state: { ...BUENA, session: { blocks: null, index: 'x', status: 'running' } }, version: 3 }],
    ['sesión en curso sin bloques', { state: { ...BUENA, session: { blocks: [], index: 0, status: 'running', endAt: 5, remaining: 0, done: {} } }, version: 3 }],
    ['sesión con índice fuera', { state: { ...BUENA, session: { blocks: [{ area: 'solfeo', seconds: 60 }], index: 5, status: 'running', endAt: 5, remaining: 0, done: {} } }, version: 3 }],
    ['auth rota', { state: { ...BUENA, auth: 'x' }, version: 3 }],
  ];
  const fallos = [];
  for (const [nombre, guardado] of casos) {
    for (const quien of ['abrir', 'recover', 'tick', 'start', 'sync']) {
      try {
        const { st } = await dispositivo({ guardado, fetch: async () => { throw new TypeError('sin red'); } });
        const s = st();
        if (quien === 'recover') s.recover(); if (quien === 'tick') { reloj.ms += 1e6; s.tick(); }
        if (quien === 'start') { s.start([{ area: 'solfeo', seconds: 60 }]); reloj.ms += 61e3; st().tick(); }
        if (quien === 'sync') await s.sync();
        // lo que usa la pantalla: tienen que existir y ser del tipo esperado
        const x = st();
        assert.ok(Array.isArray(x.sessions), 'sessions es lista'); assert.ok(x.minutes && typeof x.minutes === 'object', 'minutes es objeto');
        for (const id of ['solfeo', 'hanon', 'oido', 'thompson']) assert.ok(Number.isFinite(x.minutes[id]), 'minutos de ' + id);
        assert.ok([3, 5, 10].includes(x.blockMin), 'blockMin ' + x.blockMin);
        if (x.session) { assert.ok(Array.isArray(x.session.blocks) && x.session.blocks[x.session.index], 'la sesión en curso tiene bloque actual'); }
        x.sessions.forEach(r => assert.ok(r && typeof r.id === 'string' && r.d && typeof r.d.solfeo === 'number', 'sesión válida ' + JSON.stringify(r)));
      } catch (e) { fallos.push(`${nombre} / ${quien}: ${e.message.split('\n')[0]}`); }
    }
  }
  assert.deepEqual(fallos, [], 'datos guardados que dejan la app en mal estado:\n' + fallos.join('\n'));
});

test('ALMACENAMIENTO bloqueado o lleno: la sesión sigue funcionando en esta visita', async () => {
  for (const almacen of ['bloqueado', 'lleno']) {
    reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime();
    const { st } = await dispositivo({ almacen });
    const intentos = [() => st().setMinutes('solfeo', 15), () => st().start([{ area: 'solfeo', seconds: 60 }]), () => { reloj.ms += 61e3; st().tick(); }];
    const errores = [];
    for (const f of intentos) { try { f(); } catch (e) { errores.push(e.name); } }
    assert.deepEqual(errores, [], `${almacen}: ninguna acción debería lanzar error (${errores.join()})`);
    assert.equal(st().session.status, 'done', almacen); assert.equal(st().sessions.length, 1, almacen); assert.equal(st().minutes.solfeo, 15, almacen);
  }
});

test('SINCRONIZAR: sin red se queda pendiente y avisa; con red sube lo pendiente; 401 pide volver a entrar; errores del servidor no borran nada', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime();
  const auth = { token: 't', expira: reloj.ms + 1e9 };
  let modo = 'caida'; const subidas = [];
  const f = async (url, opts) => {
    if (modo === 'caida') throw new TypeError('sin red');
    const cuerpo = JSON.parse(opts.body); subidas.push(cuerpo.sesiones.map(s => s.id));
    if (modo === '401') return new Response('{}', { status: 401 });
    if (modo === '500') return new Response('{"error":"fallo"}', { status: 500 });
    if (modo === 'basura') return new Response('<html>', { status: 200 });
    return new Response(JSON.stringify({ sesiones: cuerpo.sesiones, ajustes: null }), { status: 200 });
  };
  const { st } = await dispositivo({ guardado: { state: { sessions: [{ id: 'abc123def456', f: HOY, d: { solfeo: 60, hanon: 0, oido: 0, thompson: 0 }, p: 1 }], auth, minutes: { solfeo: 10, hanon: 10, oido: 10, thompson: 10 }, blockMin: 5, sound: true, session: null }, version: 3 }, fetch: f });
  await st().sync(); assert.equal(st().syncState, 'error'); assert.match(st().syncError, /Sin conexión/); assert.equal(st().sessions[0].p, 1);
  modo = '500'; await st().sync(); assert.equal(st().syncState, 'error'); assert.equal(st().sessions.length, 1); assert.equal(st().sessions[0].p, 1);
  modo = 'basura'; await st().sync(); assert.equal(st().sessions.length, 1, 'una respuesta rara no borra tus sesiones'); assert.equal(st().syncState, 'error');
  modo = 'ok'; await st().sync(); assert.equal(st().syncState, 'ok'); assert.equal(st().sessions[0].p, undefined, 'ya subida');
  assert.deepEqual(subidas.at(-1), ['abc123def456']);
  modo = '401'; await st().sync(); assert.equal(st().auth, null); assert.match(st().syncError, /venció/); assert.equal(st().sessions.length, 1);
});

test('SINCRONIZAR: con más de 100 pendientes sube de a 100 hasta terminar y no hace dos sincronizaciones a la vez', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime();
  const auth = { token: 't', expira: reloj.ms + 1e9 }, subidas = [], nube = new Map(); let enCurso = 0, maxSimultaneas = 0;
  const f = async (url, opts) => {                       // la nube guarda todo lo que recibe y devuelve TODO el historial (como el servidor de verdad)
    enCurso++; maxSimultaneas = Math.max(maxSimultaneas, enCurso); await new Promise(r => setTimeout(r, 5));
    const c = JSON.parse(opts.body); subidas.push(c.sesiones.length); c.sesiones.forEach(x => nube.set(x.id, x)); enCurso--;
    return new Response(JSON.stringify({ sesiones: [...nube.values()], ajustes: null }), { status: 200 });
  };
  const sesiones = Array.from({ length: 250 }, (_, i) => ({ id: 'x' + String(i).padStart(8, '0'), f: HOY, d: { solfeo: 60, hanon: 0, oido: 0, thompson: 0 }, p: 1 }));
  const { st } = await dispositivo({ guardado: { state: { sessions: sesiones, auth, minutes: { solfeo: 10, hanon: 10, oido: 10, thompson: 10 }, blockMin: 5, sound: true, session: null }, version: 3 }, fetch: f });
  await Promise.all([st().sync(), st().sync(), st().sync()]);
  for (let i = 0; i < 60 && st().sessions.some(s => s.p); i++) await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(subidas, [100, 100, 50]); assert.equal(maxSimultaneas, 1); assert.equal(nube.size, 250); assert.equal(st().sessions.filter(s => s.p).length, 0);
});

test('SINCRONIZAR: una sesión de login vencida se descarta sin llamar al servidor', async () => {
  reloj.ms = new RealDate(2026, 10, 16, 20, 0, 0).getTime(); let llamadas = 0;
  const { st } = await dispositivo({ guardado: { state: { sessions: [], auth: { token: 't', expira: reloj.ms - 1 }, minutes: { solfeo: 1, hanon: 1, oido: 1, thompson: 1 }, blockMin: 5, sound: true, session: null }, version: 3 }, fetch: async () => { llamadas++; return new Response('{}'); } });
  await st().sync(); assert.equal(llamadas, 0); assert.equal(st().auth, null); assert.match(st().syncError, /venció/);
});
