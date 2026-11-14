import type { SessionRecord } from "./types";
import { AREA_IDS } from "./areas";

export const REPERTORIO_URL = "https://zaenlly.vercel.app/";

/**
 * Enlace que lleva a Acordes y Tonos el tiempo practicado en una sesión: #timer=ID.FECHA.solfeo-hanon-oido-thompson
 * (segundos por área, en el orden de AREA_IDS). Acordes y Tonos lo valida y no lo cuenta dos veces (usa el id).
 */
export function repertorioConSesion(rec: SessionRecord): string {
  return `${REPERTORIO_URL}#timer=${rec.id}.${rec.f}.${AREA_IDS.map((id) => rec.d[id]).join("-")}`;
}
