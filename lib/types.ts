export type AreaId = "solfeo" | "hanon" | "oido" | "thompson";

/** Cómo se ve un área: lo único que la persona puede cambiar (los ids no cambian: los usan el servidor y EarPiano). */
export type AreaConfig = { label: string; hint: string; color: string };
export type Area = { id: AreaId } & AreaConfig;
/** Lo que la persona personalizó, por área. Lo que falta toma el valor de fábrica. */
export type AreaOverrides = Partial<Record<AreaId, Partial<AreaConfig>>>;

export type Minutes = Record<AreaId, number>;
export type Seconds = Record<AreaId, number>;

export type Block = { area: AreaId; seconds: number };

export type Session = {
  blocks: Block[];
  index: number;
  status: "running" | "paused" | "done";
  /** Marca de tiempo (ms) en que termina el bloque actual. Solo si status = running. */
  endAt: number | null;
  /** Segundos restantes del bloque actual. Solo importa si status = paused. */
  remaining: number;
  /** Segundos realmente practicados por área en esta sesión. */
  done: Seconds;
  /** Id de la sesión guardada en el historial cuando terminó (para llevarla a Acordes y Tonos). */
  recordId?: string | null;
};

/** Una sesión terminada. `p` = pendiente de subir a la nube. */
export type SessionRecord = { id: string; f: string; d: Seconds; p?: 1 };
