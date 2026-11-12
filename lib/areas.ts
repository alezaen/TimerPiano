import type { AreaId, Seconds } from "./types";

export const AREAS: { id: AreaId; label: string; hint: string; color: string }[] = [
  { id: "solfeo", label: "Solfeo", hint: "Lectura y ritmo", color: "#7c9eff" },
  { id: "hanon", label: "Hanon", hint: "Técnica de dedos", color: "#ff8a5b" },
  { id: "oido", label: "Canción a oído", hint: "Sacar de oído", color: "#a78bfa" },
  { id: "thompson", label: "John Thompson", hint: "Repertorio", color: "#4ade80" },
];

export const AREA_IDS: AreaId[] = AREAS.map((a) => a.id);

export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a])) as Record<
  AreaId,
  (typeof AREAS)[number]
>;

export const emptySeconds = (): Seconds => ({ solfeo: 0, hanon: 0, oido: 0, thompson: 0 });

export const sumSeconds = (s: Seconds | undefined): number =>
  s ? AREA_IDS.reduce((t, id) => t + s[id], 0) : 0;
