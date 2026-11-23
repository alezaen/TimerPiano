import type { Block, Minutes, Seconds, Session, SessionRecord } from "./types";
import { AREA_IDS, emptySeconds, limpiarOverrides } from "./areas";

const MAX_MINUTOS = 120;
const MAX_SEGUNDOS = 43200;
const MAX_SESIONES = 1000;
const ID = /^[a-z0-9]{8,24}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const entero = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Una fecha que existe de verdad ("2026-02-30" no). */
export function fechaReal(f: unknown): f is string {
  if (typeof f !== "string" || !FECHA.test(f)) return false;
  const t = Date.parse(f + "T00:00:00Z");
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === f;
}

function segundos(d: unknown): Seconds | null {
  if (!esObjeto(d)) return null;
  const out = emptySeconds();
  for (const id of AREA_IDS) {
    if (!entero(d[id], 0, MAX_SEGUNDOS)) return null;
    out[id] = d[id] as number;
  }
  return out;
}

/** Deja solo las sesiones guardadas que son de fiar; lo demás se descarta (mejor perder una basura que trabar la app). */
export function sesionesLimpias(x: unknown): SessionRecord[] {
  if (!Array.isArray(x)) return [];
  const out: SessionRecord[] = [];
  for (const s of x) {
    if (!esObjeto(s) || typeof s.id !== "string" || !ID.test(s.id) || !fechaReal(s.f)) continue;
    const d = segundos(s.d);
    if (!d) continue;
    out.push(s.p === 1 ? { id: s.id, f: s.f, d, p: 1 } : { id: s.id, f: s.f, d });
  }
  return out.slice(-MAX_SESIONES);
}

/** La sesión en curso guardada, o null si está rota (así nunca queda una pantalla sin bloque que mostrar). */
export function sesionEnCurso(x: unknown): Session | null {
  if (!esObjeto(x) || !Array.isArray(x.blocks) || x.blocks.length < 1 || x.blocks.length > 500) return null;
  const blocks: Block[] = [];
  for (const b of x.blocks) {
    if (!esObjeto(b) || !AREA_IDS.includes(b.area as never) || !entero(b.seconds, 1, MAX_SEGUNDOS)) return null;
    blocks.push({ area: b.area as Block["area"], seconds: b.seconds });
  }
  if (!entero(x.index, 0, blocks.length - 1)) return null;
  if (x.status !== "running" && x.status !== "paused" && x.status !== "done") return null;
  const done = segundos(x.done) ?? emptySeconds();
  const completo = x.status === "done";
  const endAt = typeof x.endAt === "number" && Number.isFinite(x.endAt) ? x.endAt : null;
  const remaining = typeof x.remaining === "number" && Number.isFinite(x.remaining) ? Math.max(0, Math.min(blocks[x.index].seconds, x.remaining)) : blocks[x.index].seconds;
  // "corriendo" sin hora de fin no tiene sentido: se deja en pausa.
  const status = x.status === "running" && endAt === null ? "paused" : x.status;
  return {
    blocks, index: x.index, status, endAt: status === "running" ? endAt : null, remaining: completo ? 0 : remaining, done,
    ...(typeof x.recordId === "string" || x.recordId === null ? { recordId: x.recordId as string | null } : {}),
  };
}

/** Todo lo guardado en el teléfono, revisado campo por campo. Devuelve solo lo que sirve; lo que falta toma su valor normal. */
export function sanear(guardado: unknown): Record<string, unknown> {
  if (!esObjeto(guardado)) return {};
  const out: Record<string, unknown> = {};
  if (esObjeto(guardado.minutes)) {
    const m = {} as Minutes;
    for (const id of AREA_IDS) m[id] = entero(guardado.minutes[id], 0, MAX_MINUTOS) ? (guardado.minutes[id] as number) : 10;
    out.minutes = m;
  }
  if ([3, 5, 10].includes(guardado.blockMin as number)) out.blockMin = guardado.blockMin;
  if (typeof guardado.sound === "boolean") out.sound = guardado.sound;
  out.areaNames = limpiarOverrides(guardado.areaNames);
  out.sessions = sesionesLimpias(guardado.sessions);
  const sesion = sesionEnCurso(guardado.session);
  if (sesion) out.session = sesion;
  for (const k of ["ajustesTs", "ajustesOk"] as const) if (typeof guardado[k] === "number" && Number.isFinite(guardado[k])) out[k] = guardado[k];
  const a = guardado.auth;
  if (esObjeto(a) && typeof a.token === "string" && typeof a.expira === "number" && Number.isFinite(a.expira)) out.auth = { token: a.token, expira: a.expira };
  if (typeof guardado.lastSync === "number" && Number.isFinite(guardado.lastSync)) out.lastSync = guardado.lastSync;
  return out;
}
