// Archivo de totales (timerpiano/totales.json): un resumen chico que se actualiza cada vez que se suben sesiones.
// EarPiano lee SOLO este archivo (en el mismo almacén de Vercel Blob) y no tiene que recorrer ni sumar todas las sesiones cada vez que abre.
//   { version: 1, actualizado, sesiones, ultimo, segundos, areas: [solfeo, hanon, oído, thompson] (en segundos, de siempre),
//     dias: { "AAAA-MM-DD": [s, h, o, t] } (segundos por área, últimos 120 días con práctica) }
import { AREA_IDS } from "../areas";
import type { SessionRecord } from "../types";
import { leer, escribir } from "./almacen";

export const RUTA_TOTALES = "timerpiano/totales.json";
export const MAX_DIAS = 120;

export type Cuatro = [number, number, number, number];
export type Totales = {
  version: 1;
  actualizado: number;
  sesiones: number;
  ultimo: string | null;
  segundos: number;
  areas: Cuatro;
  dias: Record<string, Cuatro>;
};

export function calcularTotales(sesiones: SessionRecord[], ahora = Date.now()): Totales {
  const areas: Cuatro = [0, 0, 0, 0];
  const dias: Record<string, Cuatro> = {};
  for (const s of sesiones) {
    const d = (dias[s.f] ||= [0, 0, 0, 0]);
    AREA_IDS.forEach((a, i) => {
      areas[i] += s.d[a];
      d[i] += s.d[a];
    });
  }
  const recientes = Object.keys(dias).sort().slice(-MAX_DIAS);
  return {
    version: 1,
    actualizado: ahora,
    sesiones: sesiones.length,
    ultimo: sesiones.length ? sesiones[sesiones.length - 1].id : null,
    segundos: areas.reduce((a, b) => a + b, 0),
    areas,
    dias: Object.fromEntries(recientes.map((f) => [f, dias[f]])),
  };
}

type Almacen = {
  leer: (ruta: string) => Promise<{ data: unknown; etag: string } | null>;
  escribir: (ruta: string, data: unknown) => Promise<unknown>;
};

/**
 * Deja el archivo de totales al día con la lista de sesiones. Si ya está al día (misma cantidad y mismo último id) no escribe nada.
 * Devuelve true si escribió. Nunca lanza error hacia afuera: si falla, las sesiones ya están a salvo y se reintenta en la próxima sincronización.
 */
export async function actualizarTotales(
  sesiones: SessionRecord[],
  alm: Almacen = { leer, escribir },
  ahora = Date.now(),
): Promise<boolean> {
  try {
    const actual = await alm.leer(RUTA_TOTALES);
    const t = actual?.data as Partial<Totales> | undefined;
    const ultimo = sesiones.length ? sesiones[sesiones.length - 1].id : null;
    if (t && t.version === 1 && t.sesiones === sesiones.length && t.ultimo === ultimo) return false;
    await alm.escribir(RUTA_TOTALES, calcularTotales(sesiones, ahora));
    return true;
  } catch (e) {
    console.error("totales:", e);
    return false;
  }
}
