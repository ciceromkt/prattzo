"use client";

import { useState } from "react";
import type { DiaPeriodo } from "@prattzo/core";

/**
 * Evolução diária: três gráficos pequenos, um por medida.
 *
 * Por que três e não um com três linhas: visitas, toques e cliques em
 * harmonização vivem em escalas diferentes (centenas, dezenas, dezenas). Para
 * caberem juntos seria preciso um segundo eixo à direita — e aí a leitura
 * passa a depender de qual eixo pertence a qual linha, que é o jeito mais
 * comum de um gráfico enganar sem mentir. Separados, cada um tem o seu eixo e
 * ninguém compara o que não é comparável.
 *
 * O eixo do tempo é o MESMO nos três, e é isso que permite a leitura cruzada
 * que interessa: passar o dedo num dia e ver as três medidas daquele dia.
 */

interface Serie {
  chave: "visitas" | "quero" | "harmonizacao";
  titulo: string;
  nota: string;
}

const SERIES: Serie[] = [
  { chave: "visitas", titulo: "Visitas ao cardápio", nota: "sessões por dia" },
  { chave: "quero", titulo: "Toques em “Quero esse”", nota: "interesse declarado" },
  { chave: "harmonizacao", titulo: "Harmonizações acessadas", nota: "cliques na combinação" },
];

const L = 520; // largura do desenho; o SVG escala para a largura do cartão
const A = 88;  // altura
const MARGEM = 4;

function dataCurta(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

export function Evolucao({ serie }: { serie: readonly DiaPeriodo[] }) {
  const [sob, setSob] = useState<number | null>(null);

  if (serie.length < 2) {
    return <p className="vazio-suave">Ainda não há dias suficientes para desenhar a evolução.</p>;
  }

  const passo = (L - MARGEM * 2) / (serie.length - 1);
  const emX = (i: number) => MARGEM + i * passo;

  /** O dia sob o cursor vale para os três gráficos: o eixo do tempo é um só. */
  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    const i = Math.round(frac * (serie.length - 1));
    setSob(Math.max(0, Math.min(serie.length - 1, i)));
  };

  const dia = sob === null ? null : serie[sob]!;

  return (
    <div
      className="evolucao"
      onPointerMove={aoMover}
      onPointerLeave={() => setSob(null)}
    >
      {SERIES.map((s) => {
        const valores = serie.map((d) => d[s.chave]);
        const topo = Math.max(1, ...valores);
        const emY = (v: number) => A - MARGEM - (v / topo) * (A - MARGEM * 2);
        const pontos = valores.map((v, i) => `${emX(i).toFixed(1)},${emY(v).toFixed(1)}`);
        const area = `M ${emX(0).toFixed(1)},${A} L ${pontos.join(" L ")} L ${emX(valores.length - 1).toFixed(1)},${A} Z`;
        const total = valores.reduce((x, y) => x + y, 0);
        const destacado = sob === null ? null : valores[sob]!;

        return (
          <figure className="evolucao__bloco" key={s.chave}>
            <figcaption className="evolucao__cabeca">
              <span className="evolucao__titulo">{s.titulo}</span>
              <b className="evolucao__valor">
                {(destacado ?? total).toLocaleString("pt-BR")}
                <span className="evolucao__unidade">
                  {sob === null ? ` no período` : ` em ${dataCurta(dia!.dia)}`}
                </span>
              </b>
            </figcaption>
            <svg
              className="evolucao__svg"
              viewBox={`0 0 ${L} ${A}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${s.titulo}: ${s.nota}. Total de ${total} no período.`}
            >
              <path className="evolucao__area" d={area} />
              <polyline className="evolucao__linha" points={pontos.join(" ")} />
              {sob !== null ? (
                <>
                  <line
                    className="evolucao__cursor"
                    x1={emX(sob)} y1={0} x2={emX(sob)} y2={A}
                  />
                  <circle
                    className="evolucao__ponto"
                    cx={emX(sob)} cy={emY(valores[sob]!)} r={4.5}
                    /* O SVG é esticado na horizontal pelo preserveAspectRatio;
                       sem desfazer isso aqui, o ponto vira uma elipse. */
                    style={{ transform: `scaleX(${A / L})`, transformOrigin: `${emX(sob)}px ${emY(valores[sob]!)}px` }}
                  />
                </>
              ) : null}
            </svg>
            <span className="evolucao__nota">{s.nota}</span>
          </figure>
        );
      })}

      <div className="evolucao__eixo">
        <span>{dataCurta(serie[0]!.dia)}</span>
        {dia ? <b className="evolucao__dia">{dataCurta(dia.dia)}</b> : <span className="evolucao__dica">passe o cursor para ver um dia</span>}
        <span>{dataCurta(serie[serie.length - 1]!.dia)}</span>
      </div>
    </div>
  );
}
