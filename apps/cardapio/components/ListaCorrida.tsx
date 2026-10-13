"use client";

import { useEffect, useRef } from "react";
import type { Dish, MenuGroup } from "@pede-esse/core";
import { capaDoPrato, estaEsgotado, priceLabel } from "@pede-esse/core";
import { Regua } from "./Regua";

/**
 * A lista mostra TODAS as categorias em sequência: tocar numa categoria da
 * régua rola até ela, em vez de filtrar. O cliente nunca perde o resto do menu.
 */
export function ListaCorrida({
  grupos, catInicial, onFechar, onPrato,
}: {
  grupos: MenuGroup[];
  catInicial: string | null;
  onFechar: () => void;
  onPrato: (p: Dish, g: MenuGroup) => void;
}) {
  const corpo = useRef<HTMLDivElement | null>(null);

  const irPara = (id: string) => {
    const alvo = corpo.current?.querySelector<HTMLElement>(`[data-bloco="${id}"]`);
    if (alvo && corpo.current) corpo.current.scrollTo({ top: alvo.offsetTop - 8, behavior: "smooth" });
  };

  useEffect(() => {
    if (catInicial) irPara(catInicial);
  }, [catInicial]);

  return (
    <div className="folha-lista" role="dialog" aria-modal="true" aria-label="Cardápio">
      <div className="folha-lista__topo">
        <h2>Cardápio</h2>
        <button type="button" className="redondo" onClick={onFechar} aria-label="Fechar">✕</button>
      </div>
      <Regua grupos={grupos} ativa={catInicial} onTrocar={(g) => irPara(g.categoria.id)} />
      <div className="folha-lista__corpo" ref={corpo}>
        {grupos.map((g) => (
          <section key={g.categoria.id} data-bloco={g.categoria.id}>
            <h3 className="bloco-nome">{g.categoria.nome}</h3>
            {g.pratos.map((p) => {
              const capa = capaDoPrato(p);
              const esgotado = estaEsgotado(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`linha-item${esgotado ? " linha-item--esgotado" : ""}`}
                  onClick={() => onPrato(p, g)}
                >
                  {capa ? (
                    <img className="linha-item__thumb" src={capa} alt="" loading="lazy" />
                  ) : (
                    <span className="linha-item__thumb" />
                  )}
                  <span className="linha-item__txt">
                    <span className="linha-item__nome">
                      {p.nome}
                      {esgotado ? <span className="selo-esgotado selo-esgotado--mini">Esgotado hoje</span> : null}
                    </span>
                    {p.descricao ? <span className="linha-item__desc">{p.descricao}</span> : null}
                    <span className={`linha-item__preco${p.preco_min_centavos > 0 ? "" : " linha-item__preco--vazio"}`}>
                      {priceLabel(p)}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
