"use client";

import { useState } from "react";
import { taxaInteresse, variacao } from "@prattzo/core";
import { Delta } from "./Indicadores";

export interface LinhaRanking {
  dishId: string;
  nome: string;
  categoria: string;
  capa: string | null;
  temVideo: boolean;
  /** Nem foto nem vídeo: o cliente passa por ele e não vê nada. */
  semMidia: boolean;
  vistas: number;
  quis: number;
  vistasAntes: number;
  quisAntes: number;
}

type Ordem = "vistas" | "desejados" | "taxa" | "pior";

const ORDENS: Array<{ chave: Ordem; rotulo: string }> = [
  { chave: "vistas", rotulo: "Mais visualizados" },
  { chave: "desejados", rotulo: "Mais desejados" },
  { chave: "taxa", rotulo: "Maior taxa de interesse" },
  { chave: "pior", rotulo: "Menor desempenho" },
];

/** Abaixo disto a taxa é ruído: 1 de 3 visualizações não são 33% de nada. */
const MINIMO_PARA_TAXA = 12;

export function RankingPratos({ linhas }: { linhas: readonly LinhaRanking[] }) {
  const [ordem, setOrdem] = useState<Ordem>("vistas");

  const ordenadas = [...linhas].sort((a, b) => {
    switch (ordem) {
      case "desejados":
        return b.quis - a.quis;
      case "taxa": {
        // Pratos com pouquíssima visualização vão para o fim em vez de
        // liderarem com uma taxa que não se sustenta.
        const ta = a.vistas >= MINIMO_PARA_TAXA ? taxaInteresse(a.vistas, a.quis) : -1;
        const tb = b.vistas >= MINIMO_PARA_TAXA ? taxaInteresse(b.vistas, b.quis) : -1;
        return tb - ta;
      }
      case "pior": {
        // "Menor desempenho" é quem é visto e não convence — não quem ninguém
        // viu. Esse outro caso é "pouco descoberto", e tem seção própria.
        const pa = a.vistas >= MINIMO_PARA_TAXA ? taxaInteresse(a.vistas, a.quis) : 999;
        const pb = b.vistas >= MINIMO_PARA_TAXA ? taxaInteresse(b.vistas, b.quis) : 999;
        return pa - pb;
      }
      default:
        return b.vistas - a.vistas;
    }
  });

  const maior = Math.max(1, ...linhas.map((l) => l.vistas));

  return (
    <>
      <div className="ordenar" role="group" aria-label="Ordenar o ranking">
        {ORDENS.map((o) => (
          <button
            key={o.chave}
            type="button"
            className={`chip-ordem${ordem === o.chave ? " chip-ordem--ativo" : ""}`}
            aria-pressed={ordem === o.chave}
            onClick={() => setOrdem(o.chave)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      <ul className="ranking">
        {ordenadas.map((l, i) => {
          const taxa = taxaInteresse(l.vistas, l.quis);
          const delta = variacao(l.quis, l.quisAntes);
          return (
            <li className="ranking__linha" key={l.dishId}>
              <span className="ranking__pos">{i + 1}</span>
              {l.capa
                ? <img className="ranking__foto" src={l.capa} alt="" loading="lazy" />
                : <span className="ranking__foto ranking__foto--vazia" aria-hidden="true" />}

              <span className="ranking__quem">
                <b className="ranking__nome">
                  {l.nome}
                  {l.temVideo ? <span className="selo-video" title="Tem vídeo">vídeo</span> : null}
                  {/* Sem isto, uma taxa de 2% parece defeito do prato. O prato
                      aparece na fila dos stories como um quadro vazio — não há
                      o que desejar, e o número está certo. */}
                  {l.semMidia
                    ? <span className="selo-falta" title="Aparece no cardápio sem foto nem vídeo">sem mídia</span>
                    : null}
                </b>
                <span className="ranking__cat">{l.categoria}</span>
              </span>

              <span className="ranking__numeros">
                <span className="ranking__num">
                  <b>{l.vistas.toLocaleString("pt-BR")}</b>
                  <i>visualizações</i>
                </span>
                <span className="ranking__num">
                  <b>{l.quis.toLocaleString("pt-BR")}</b>
                  <i>“Quero esse”</i>
                </span>
                <span className="ranking__num">
                  <b>{l.vistas >= MINIMO_PARA_TAXA ? `${Math.round(taxa)}%` : "—"}</b>
                  <i>interesse</i>
                </span>
              </span>

              <span className="ranking__barra" aria-hidden="true">
                <span style={{ width: `${Math.round((l.vistas / maior) * 100)}%` }} />
              </span>

              <span className="ranking__delta"><Delta valor={delta} miudo /></span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
