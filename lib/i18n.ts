/** Idiomas de TimerPiano. El español es la fuente: el inglés debe tener exactamente las mismas claves (TypeScript lo exige). */
export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];
export const LANG_POR_DEFECTO: Lang = "es";

const es = {
  // Cabecera
  abrirEarPiano: "Abrir EarPiano",
  sincronizacion: "Sincronización",
  conectarSync: "Conectar para sincronizar",
  sonidoOn: "Sonido activado",
  sonidoOff: "Sonido desactivado",
  cambiarIdioma: "Cambiar idioma",
  // Resumen del día
  hoyPracticas: "Hoy practicas",
  min: "min",
  racha: "Racha",
  // Áreas
  minutosPorArea: "Minutos por área",
  pctDelDia: "{n}% del día",
  editar: "Editar {name}",
  menosMinutos: "Menos minutos de {name}",
  masMinutos: "Más minutos de {name}",
  minutosDe: "Minutos de {name}",
  // Bloques
  cambioDeArea: "Cambio de área cada",
  tuOrden: "Tu orden de hoy",
  mezclar: "Mezclar de nuevo",
  bloque1: "{n} bloque, sin repetir área seguida.",
  bloques: "{n} bloques, sin repetir área seguida.",
  sumaMinutos: "Suma minutos a al menos un área.",
  notaMezcla: "Mezclar se siente más difícil que repetir lo mismo. Es normal: esa dificultad es la que ayuda a recordarlo después.",
  // EarPiano
  earPianoSub: "Tu repertorio, acordes y teoría",
  // Botón principal
  empezar: "Empezar · {n} min",
};

export type Clave = keyof typeof es;

const en: Record<Clave, string> = {
  abrirEarPiano: "Open EarPiano",
  sincronizacion: "Sync",
  conectarSync: "Connect to sync",
  sonidoOn: "Sound on",
  sonidoOff: "Sound off",
  cambiarIdioma: "Change language",
  hoyPracticas: "Today you practice",
  min: "min",
  racha: "Streak",
  minutosPorArea: "Minutes per area",
  pctDelDia: "{n}% of the day",
  editar: "Edit {name}",
  menosMinutos: "Fewer minutes of {name}",
  masMinutos: "More minutes of {name}",
  minutosDe: "Minutes of {name}",
  cambioDeArea: "Switch area every",
  tuOrden: "Your order for today",
  mezclar: "Shuffle again",
  bloque1: "{n} block, never the same area twice in a row.",
  bloques: "{n} blocks, never the same area twice in a row.",
  sumaMinutos: "Add minutes to at least one area.",
  notaMezcla: "Mixing feels harder than repeating the same thing. That's normal: that difficulty is what helps you remember it later.",
  earPianoSub: "Your repertoire, chords and theory",
  empezar: "Start · {n} min",
};

const TEXTOS: Record<Lang, Record<Clave, string>> = { es, en };

export const esLang = (x: unknown): x is Lang => x === "es" || x === "en";

/** El texto en el idioma pedido. `{name}`, `{n}`… se reemplazan con `vars`. Un idioma raro cae al español. */
export function t(lang: Lang, clave: Clave, vars?: Record<string, string | number>): string {
  const base = (TEXTOS[lang] ?? TEXTOS[LANG_POR_DEFECTO])[clave] ?? es[clave];
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
