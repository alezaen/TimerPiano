import { AREA_IDS } from "../areas";
import type { Minutes, SessionRecord } from "../types";

export const MAX_SESIONES = 1000;
export const MAX_AREA_MIN = 120;
const ID = /^[a-z0-9]{8,24}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const entero = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export type Ajustes = { minutes: Minutes; blockMin: number; ts: number };

/** Devuelve la sesión limpia o null si no es válida (nada se "arregla" en silencio). */
export function limpiarSesion(s: unknown): SessionRecord | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  if (typeof o.id !== "string" || !ID.test(o.id)) return null;
  if (typeof o.f !== "string" || !FECHA.test(o.f) || Number.isNaN(Date.parse(o.f + "T00:00:00Z"))) return null;
  if (!o.d || typeof o.d !== "object") return null;
  const d = o.d as Record<string, unknown>;
  const out = {} as SessionRecord["d"];
  let total = 0;
  for (const id of AREA_IDS) {
    if (!entero(d[id], 0, 43200)) return null;
    out[id] = d[id] as number;
    total += out[id];
  }
  if (total <= 0) return null;
  return { id: o.id, f: o.f, d: out };
}

export function limpiarAjustes(a: unknown): Ajustes | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  if (!entero(o.ts, 1, Date.now() + 864e5)) return null;
  if (![3, 5, 10].includes(o.blockMin as number)) return null;
  if (!o.minutes || typeof o.minutes !== "object") return null;
  const m = o.minutes as Record<string, unknown>;
  const minutes = {} as Minutes;
  for (const id of AREA_IDS) {
    if (!entero(m[id], 0, MAX_AREA_MIN)) return null;
    minutes[id] = m[id] as number;
  }
  return { minutes, blockMin: o.blockMin as number, ts: o.ts };
}
