export type AreaId = "solfeo" | "hanon" | "oido" | "thompson";

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
};

/** Una sesión terminada. `p` = pendiente de subir a la nube. */
export type SessionRecord = { id: string; f: string; d: Seconds; p?: 1 };
