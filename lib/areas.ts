import type { Area, AreaConfig, AreaId, AreaOverrides, Seconds } from "./types";
import { AREAS_FABRICA, LANG_POR_DEFECTO, type Lang } from "./i18n";

/** Valores de fábrica de las 4 áreas. Para mostrarlas usa `mergeAreas` (o `useAreas` en los componentes). */
export const AREAS: Area[] = [
  { id: "solfeo", label: "Solfeo", hint: "Lectura y ritmo", color: "#2ef2e0" },
  { id: "hanon", label: "Hanon", hint: "Técnica de dedos", color: "#ff8a3d" },
  { id: "oido", label: "Canción a oído", hint: "Sacar de oído", color: "#ff3d81" },
  { id: "thompson", label: "John Thompson", hint: "Repertorio", color: "#a98bff" },
];

export const AREA_IDS: AreaId[] = AREAS.map((a) => a.id);

export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a])) as Record<AreaId, Area>;

export const MAX_NOMBRE = 24;
export const MAX_HINT = 40;
const COLOR = /^#[0-9a-f]{6}$/i;

/** Una personalización limpia: solo lo que es de fiar. Un texto vacío o un color raro se descarta (vuelve al valor de fábrica). */
export function limpiarConfig(x: unknown): Partial<AreaConfig> {
  const out: Partial<AreaConfig> = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return out;
  const o = x as Record<string, unknown>;
  if (typeof o.label === "string") {
    const t = o.label.trim().slice(0, MAX_NOMBRE);
    if (t) out.label = t;
  }
  if (typeof o.hint === "string") {
    const t = o.hint.trim().slice(0, MAX_HINT);
    if (t) out.hint = t;
  }
  if (typeof o.color === "string" && COLOR.test(o.color)) out.color = o.color.toLowerCase();
  return out;
}

/** Todo lo personalizado, revisado área por área. Solo se aceptan las 4 áreas conocidas. */
export function limpiarOverrides(x: unknown): AreaOverrides {
  const out: AreaOverrides = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return out;
  const o = x as Record<string, unknown>;
  for (const id of AREA_IDS) {
    const c = limpiarConfig(o[id]);
    if (Object.keys(c).length) out[id] = c;
  }
  return out;
}

/** Los valores de fábrica de las áreas en el idioma pedido (nombre y descripción; el color no cambia). */
export function areasDeFabrica(lang: Lang = LANG_POR_DEFECTO): Area[] {
  const textos = AREAS_FABRICA[lang];
  return AREAS.map((a) => ({ ...a, ...(textos?.[a.id] ?? {}) }));
}

/** Las 4 áreas con lo que la persona cambió encima de los valores de fábrica (en su idioma). */
export function mergeAreas(over?: AreaOverrides, lang: Lang = LANG_POR_DEFECTO): Area[] {
  return areasDeFabrica(lang).map((a) => ({ ...a, ...limpiarConfig(over?.[a.id]) }));
}

export const emptySeconds = (): Seconds => ({ solfeo: 0, hanon: 0, oido: 0, thompson: 0 });

export const sumSeconds = (s: Seconds | undefined): number =>
  s ? AREA_IDS.reduce((t, id) => t + s[id], 0) : 0;
