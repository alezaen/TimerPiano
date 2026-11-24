"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { mergeAreas } from "./areas";
import type { Area, AreaId } from "./types";

/** Las áreas tal como la persona las personalizó: la lista en orden y un acceso por id. */
export function useAreas(): { areas: Area[]; byId: Record<AreaId, Area> } {
  const areaNames = useStore((s) => s.areaNames);
  const lang = useStore((s) => s.lang);
  return useMemo(() => {
    const areas = mergeAreas(areaNames, lang);
    return { areas, byId: Object.fromEntries(areas.map((a) => [a.id, a])) as Record<AreaId, Area> };
  }, [areaNames, lang]);
}
