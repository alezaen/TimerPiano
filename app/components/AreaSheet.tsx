"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useAreas } from "@/lib/useAreas";
import { AREA_BY_ID, MAX_HINT, MAX_NOMBRE } from "@/lib/areas";
import type { AreaId } from "@/lib/types";

/** Colores sugeridos (se puede escribir otro con el selector). */
const COLORES = ["#2ef2e0", "#ff8a3d", "#ff3d81", "#a98bff", "#4ade80", "#facc15", "#60a5fa", "#f87171"];

/** Panel para cambiar el nombre, la descripción y el color de un área. El id no cambia. */
export default function AreaSheet({ id, onClose }: { id: AreaId; onClose: () => void }) {
  const { byId } = useAreas();
  const setAreaConfig = useStore((s) => s.setAreaConfig);
  const resetArea = useStore((s) => s.resetArea);
  const a = byId[id];
  // Se escribe en un borrador y se guarda al terminar: así se pueden escribir espacios sin que se borren al instante.
  const [label, setLabel] = useState(a.label);
  const [hint, setHint] = useState(a.hint);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const guardarTextos = () => {
    setAreaConfig(id, { label, hint });
  };
  const restaurar = () => {
    resetArea(id);
    setLabel(AREA_BY_ID[id].label);
    setHint(AREA_BY_ID[id].hint);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/75" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar área"
        onClick={(e) => e.stopPropagation()}
        className="tp-up w-full max-w-md rounded-t-3xl border-t border-edge bg-ink/95 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar área</h2>
          <button
            onClick={() => {
              guardarTextos();
              onClose();
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-gold"
          >
            Listo
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-dim" htmlFor="area-nombre">
          Nombre
        </label>
        <input
          id="area-nombre"
          value={label}
          maxLength={MAX_NOMBRE}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={guardarTextos}
          className="mt-2 h-12 w-full rounded-2xl border border-edge bg-ink/60 px-4 text-base outline-none focus:border-gold"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-dim" htmlFor="area-desc">
          Descripción
        </label>
        <input
          id="area-desc"
          value={hint}
          maxLength={MAX_HINT}
          onChange={(e) => setHint(e.target.value)}
          onBlur={guardarTextos}
          className="mt-2 h-12 w-full rounded-2xl border border-edge bg-ink/60 px-4 text-base outline-none focus:border-gold"
        />

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-dim">Color</p>
        <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color">
          {COLORES.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={a.color.toLowerCase() === c}
              aria-label={`Color ${c}`}
              onClick={() => setAreaConfig(id, { color: c })}
              className="h-9 w-9 rounded-full transition-transform active:scale-90"
              style={{ background: c, outline: a.color.toLowerCase() === c ? "2px solid #f4efe4" : "none", outlineOffset: 2 }}
            />
          ))}
          <input
            type="color"
            aria-label="Otro color"
            value={a.color}
            onChange={(e) => setAreaConfig(id, { color: e.target.value })}
            className="h-9 w-9 cursor-pointer rounded-full border border-edge bg-transparent p-0"
          />
        </div>

        <button onClick={restaurar} className="mt-5 w-full rounded-2xl border border-line py-3 text-sm text-dim active:scale-[0.98]">
          Volver a los valores de fábrica
        </button>
      </div>
    </div>
  );
}
