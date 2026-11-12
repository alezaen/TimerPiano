import type { AreaId, Block, Minutes } from "./types";
import { AREA_IDS } from "./areas";

/** Reparte `minutes` en trozos de tamaño parejo, ninguno mayor que `max`. */
export function splitMinutes(minutes: number, max: number): number[] {
  if (minutes <= 0) return [];
  const n = Math.ceil(minutes / max);
  const base = Math.floor(minutes / n);
  const extra = minutes % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Construye una sesión intercalada: cada área se parte en bloques cortos y los
 * bloques se mezclan al azar sin repetir la misma área dos veces seguidas
 * (salvo que sea matemáticamente imposible, p. ej. si solo eliges una área).
 */
export function buildBlocks(
  minutes: Minutes,
  blockMin: number,
  rng: () => number = Math.random,
): Block[] {
  const pools = {} as Record<AreaId, number[]>;
  for (const id of AREA_IDS) pools[id] = splitMinutes(minutes[id], blockMin);

  const out: Block[] = [];
  let last: AreaId | null = null;
  let total = AREA_IDS.reduce((t, id) => t + pools[id].length, 0);

  while (total > 0) {
    const alive = AREA_IDS.filter((id) => pools[id].length > 0);
    let pick: AreaId | null = null;

    // Si un área necesita este turno para poder evitar repeticiones, se elige ya.
    const forced = alive.find((id) => id !== last && pools[id].length * 2 > total);
    if (forced) pick = forced;

    if (!pick) {
      const candidates = alive.filter((id) => id !== last);
      const options = candidates.length ? candidates : alive;
      const weight = options.reduce((t, id) => t + pools[id].length, 0);
      let r = rng() * weight;
      for (const id of options) {
        r -= pools[id].length;
        if (r < 0) {
          pick = id;
          break;
        }
      }
      pick = pick ?? options[options.length - 1];
    }

    const m = pools[pick].shift()!;
    out.push({ area: pick, seconds: m * 60 });
    last = pick;
    total--;
  }
  return out;
}
