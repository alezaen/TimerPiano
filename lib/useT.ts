"use client";

import { useCallback } from "react";
import { useStore } from "./store";
import { t, type Clave } from "./i18n";

/** `const t = useT()` → `t("empezar", { n: 25 })` en el idioma que la persona eligió. */
export function useT() {
  const lang = useStore((s) => s.lang);
  return useCallback((clave: Clave, vars?: Record<string, string | number>) => t(lang, clave, vars), [lang]);
}
