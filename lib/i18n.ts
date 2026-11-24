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
  // Sesión en curso
  pausar: "Pausar",
  seguir: "Seguir",
  tocaPausar: "Toca para pausar",
  enPausa: "En pausa · toca para seguir",
  bloqueDe: "Bloque {i} de {n}",
  sigue: "Sigue:",
  ultimoBloque: "Este es el último bloque",
  saltar: "Saltar",
  terminarPregunta: "¿Terminar y guardar lo practicado?",
  si: "Sí",
  no: "No",
  terminarSesion: "Terminar sesión",
  // Sesión terminada
  sesionTerminada: "Sesión terminada",
  noAlcanzaste: "No alcanzaste a practicar esta vez. Mañana lo retomas.",
  sesionCompleta: "¡Sesión completa!",
  cumpliste: "Cumpliste todo lo que planeaste.",
  cumplisteRacha: "Cumpliste todo y ya llevas {n} días seguidos.",
  granSesion: "¡Gran sesión!",
  casiTodo: "Casi todo hecho. Eso es constancia.",
  sesionGuardada: "Sesión guardada",
  cadaMinuto: "Cada minuto suma. Lo importante es volver mañana.",
  anilloAria: "{a} minutos practicados de {b} planeados",
  minPracticados: "min practicados",
  pctPlaneado: "{n}% de lo planeado",
  diaRacha: "día de racha",
  diasRacha: "días de racha",
  hoy: "hoy",
  ultimos7: "últimos 7 días",
  completado: "completado",
  noPracticaste: "No alcanzaste a practicar nada esta vez.",
  sumarEarPiano: "Sumar a EarPiano",
  volverInicio: "Volver al inicio",
  // Progreso
  tuSemana: "Tu semana",
  semanaSinPractica: "Esta semana aún no practicas",
  primeraSesion: "Completa tu primera sesión para empezar tu racha",
  aquiVeras: "Aquí verás tus minutos por día y por área.",
  diasPracticados: "días practicados",
  minutosAria: "{n} minutos",
  mejorDia: "Mejor día:",
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
  pausar: "Pause",
  seguir: "Resume",
  tocaPausar: "Tap to pause",
  enPausa: "Paused · tap to resume",
  bloqueDe: "Block {i} of {n}",
  sigue: "Next:",
  ultimoBloque: "This is the last block",
  saltar: "Skip",
  terminarPregunta: "End and save what you practiced?",
  si: "Yes",
  no: "No",
  terminarSesion: "End session",
  sesionTerminada: "Session ended",
  noAlcanzaste: "You didn't get to practice this time. Pick it back up tomorrow.",
  sesionCompleta: "Session complete!",
  cumpliste: "You did everything you planned.",
  cumplisteRacha: "You did it all and you're on a {n}-day streak.",
  granSesion: "Great session!",
  casiTodo: "Almost everything done. That's consistency.",
  sesionGuardada: "Session saved",
  cadaMinuto: "Every minute counts. What matters is coming back tomorrow.",
  anilloAria: "{a} minutes practiced out of {b} planned",
  minPracticados: "min practiced",
  pctPlaneado: "{n}% of what you planned",
  diaRacha: "day streak",
  diasRacha: "day streak",
  hoy: "today",
  ultimos7: "last 7 days",
  completado: "done",
  noPracticaste: "You didn't get to practice anything this time.",
  sumarEarPiano: "Add to EarPiano",
  volverInicio: "Back to home",
  tuSemana: "Your week",
  semanaSinPractica: "No practice yet this week",
  primeraSesion: "Complete your first session to start your streak",
  aquiVeras: "You'll see your minutes per day and per area here.",
  diasPracticados: "days practiced",
  minutosAria: "{n} minutes",
  mejorDia: "Best day:",
};

export const TEXTOS: Record<Lang, Record<Clave, string>> = { es, en };

/** Iniciales de los días, de domingo a sábado (como `Date.getDay()`). */
export const DIAS_SEMANA: Record<Lang, string[]> = {
  es: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
};

export const esLang = (x: unknown): x is Lang => x === "es" || x === "en";

/** El texto en el idioma pedido. `{name}`, `{n}`… se reemplazan con `vars`. Un idioma raro cae al español. */
export function t(lang: Lang, clave: Clave, vars?: Record<string, string | number>): string {
  const base = (TEXTOS[lang] ?? TEXTOS[LANG_POR_DEFECTO])[clave] ?? es[clave];
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
