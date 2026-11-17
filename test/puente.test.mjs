// El puente con EarPiano, de este lado: lo que manda esta app lo entiende la otra, y lo que la otra manda lo entiende esta.
// Usa test/contrato-puente.json (el MISMO archivo está en EarPiano). Si la carpeta de esa app está al lado (../Repertory o REPERTORY_DIR),
// además se prueban las dos apps juntas, con su código real. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarLib } from './ayuda-ts.mjs';

const contrato = JSON.parse(await readFile(new URL('./contrato-puente.json', import.meta.url), 'utf8'));
const links = await cargarLib('lib/links.ts'), plan = await cargarLib('lib/plan.ts'), areas = await cargarLib('lib/areas.ts');

test('puente: sitios y áreas coinciden con el contrato', () => {
  assert.equal(links.REPERTORIO_URL, contrato.sitios.repertorio); assert.deepEqual(areas.AREA_IDS, contrato.areas);
});

test('puente: el enlace "Sumar a EarPiano" tiene exactamente el formato del contrato', () => {
  for (const c of contrato.timer_a_repertorio.filter(x => x.valido && x.id && x.f)) assert.equal(links.repertorioConSesion({ id: c.id, f: c.f, d: c.d }), c.enlace, c.caso);
});

test('puente: el plan que manda EarPiano lo entiende TimerPiano', () => {
  for (const c of contrato.plan_hash) assert.deepEqual(plan.leerPlan(c.hash), c.resultado, c.caso);
  for (const c of contrato.repertorio_a_timer) assert.deepEqual(plan.leerPlan(new URL(c.enlace).hash), c.resultado, c.caso);
});

test('puente: cualquier sesión que arme esta app sale con un enlace de formato válido (muchas al azar)', () => {
  let s = 9; const az = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = 0; i < 500; i++) {
    const d = Object.fromEntries(areas.AREA_IDS.map(a => [a, az() < 0.4 ? 0 : Math.floor(az() * 7200)]));
    const id = Array.from({ length: 12 }, () => (Math.floor(az() * 36)).toString(36)).join('');
    const url = links.repertorioConSesion({ id, f: '2026-11-16', d });
    assert.match(url, /^https:\/\/zaenlly\.vercel\.app\/#timer=[a-z0-9]{12}\.\d{4}-\d{2}-\d{2}\.\d{1,4}-\d{1,4}-\d{1,4}-\d{1,4}$/);
  }
});

// --- las dos apps juntas, con su código real (solo si la otra carpeta está al lado) ---
const RAIZ = fileURLToPath(new URL('..', import.meta.url)), OTRA = process.env.REPERTORY_DIR || join(RAIZ, '..', 'Repertory');
const hayOtra = await access(join(OTRA, 'timer.js')).then(() => true, () => false);
test('las dos apps juntas: lo que genera TimerPiano lo acepta EarPiano, se suma una sola vez y el total coincide', { skip: hayOtra ? false : 'no está la carpeta de EarPiano al lado (REPERTORY_DIR)' }, async () => {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(await readFile(join(OTRA, 'timer.js'), 'utf8'), ctx);
  const T = ctx.RepertorioTimer; let s = 5; const az = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  let est = null;
  for (let i = 0; i < 300; i++) {
    const d = Object.fromEntries(areas.AREA_IDS.map(a => [a, az() < 0.5 ? 0 : 1 + Math.floor(az() * 7199)])); if (!areas.AREA_IDS.some(a => d[a] > 0)) d.solfeo = 60;
    const id = Array.from({ length: 12 }, () => (Math.floor(az() * 36)).toString(36)).join('');
    const reg = T.leerHash(new URL(links.repertorioConSesion({ id, f: '2026-11-16', d })).hash, '2026-11-16');
    assert.ok(reg, 'EarPiano acepta ' + JSON.stringify(d));
    assert.deepEqual(JSON.parse(JSON.stringify(reg)), { id, f: '2026-11-16', d: areas.AREA_IDS.map(a => d[a]) });
    const a = T.agregar(est, reg); assert.equal(a.nuevo, true); est = a.est;
    assert.equal(T.agregar(est, reg).nuevo, false, 'el mismo enlace dos veces no suma dos veces');
  }
  assert.ok(plan.leerPlan(new URL(T.enlace({ solfeo: 10, hanon: 5, oido: 15, thompson: 0 })).hash), 'TimerPiano entiende el plan de EarPiano');
  assert.deepEqual(plan.leerPlan(new URL(T.enlace({ solfeo: 10, hanon: 5, oido: 15, thompson: 0 })).hash), { solfeo: 10, hanon: 5, oido: 15, thompson: 0 });
});
