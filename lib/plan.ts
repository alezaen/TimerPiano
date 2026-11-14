import type { AreaId } from "./types";
import { AREA_IDS } from "./areas";

const MAX_MINUTOS = 120;
const PASO = 5;

/**
 * Plan sugerido por Acordes y Tonos: "#plan=solfeo-5,oido-5" -> { solfeo: 5, oido: 5 }.
 * Solo se aceptan áreas conocidas y minutos de 5 en 5 (de 0 a 120); lo demás se ignora. Si no hay nada válido, null.
 */
export function leerPlan(hash: string): Partial<Record<AreaId, number>> | null {
  const m = /^#plan=([a-z0-9,-]{1,100})$/.exec(hash);
  if (!m) return null;
  const plan: Partial<Record<AreaId, number>> = {};
  for (const parte of m[1].split(",")) {
    const [id, n] = parte.split("-");
    if (!AREA_IDS.includes(id as AreaId) || !/^\d{1,3}$/.test(n ?? "")) continue;
    const min = Number(n);
    if (min > MAX_MINUTOS || min % PASO !== 0) continue;
    plan[id as AreaId] = min;
  }
  return Object.keys(plan).length ? plan : null;
}
