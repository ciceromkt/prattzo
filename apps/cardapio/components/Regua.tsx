"use client";

import { useEffect, useRef } from "react";
import type { MenuGroup } from "@pede-esse/core";

/** Régua de categorias: troca de categoria sem sair dos stories. */
export function Regua({
  grupos, ativa, onTrocar,
}: {
  grupos: MenuGroup[];
  ativa: string | null;
  onTrocar: (g: MenuGroup) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Mantém a categoria atual no centro, como no ClipFood.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const alvo = el.querySelector<HTMLElement>('[aria-current="true"]');
    if (alvo) el.scrollLeft = alvo.offsetLeft - (el.clientWidth - alvo.offsetWidth) / 2;
  }, [ativa]);

  return (
    <div className="regua-faixa">
      <div className="regua" role="tablist" ref={ref}>
        {grupos.map((g) => (
          <button
            key={g.categoria.id}
            type="button"
            role="tab"
            className="regua__item"
            aria-current={g.categoria.id === ativa ? "true" : undefined}
            onClick={() => onTrocar(g)}
          >
            {g.categoria.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
