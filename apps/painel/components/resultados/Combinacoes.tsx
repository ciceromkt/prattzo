import { variacao } from "@prattzo/core";
import { Delta } from "./Indicadores";

export interface LinhaPar {
  chave: string;
  de: string;
  para: string;
  exibicoes: number;
  cliques: number;
  cliquesAntes: number;
}

/**
 * Desempenho das harmonizações.
 *
 * A pergunta que esta seção responde é só uma: a oferta que o cardápio faz
 * dentro do prato está sendo aceita? Por isso a coluna que manda é a taxa, e
 * não o volume — um par exibido 2.000 vezes com 8% convence menos que um
 * exibido 300 com 30%, e é o segundo que o salão deveria repetir na boca.
 */
export function Combinacoes({
  linhas, maisPuxados,
}: {
  linhas: readonly LinhaPar[];
  maisPuxados: ReadonlyArray<{ nome: string; cliques: number }>;
}) {
  if (linhas.length === 0) {
    return (
      <p className="vazio-suave">
        Nenhuma combinação foi exibida no período. As harmonizações aparecem dentro do prato, para
        quem abre um item que tem par configurado.
      </p>
    );
  }

  /**
   * Par com menos de 20 exibições fica de fora.
   *
   * Não é para enfeitar a lista: com 6 exibições e 0 interações, "0%" não é
   * um desempenho ruim, é a ausência de amostra — e o selo "rende pouco" ao
   * lado viraria uma acusação sem prova. A linha no rodapé diz quantos
   * ficaram de fora, para ninguém achar que sumiram.
   */
  const MINIMO = 20;
  const bastante = linhas.filter((l) => l.exibicoes >= MINIMO);
  const poucas = linhas.length - bastante.length;
  if (bastante.length === 0) {
    return (
      <p className="vazio-suave">
        As combinações apareceram pouco no período — menos de {MINIMO} exibições cada. Ainda não dá
        para dizer se funcionam.
      </p>
    );
  }

  const ordenadas = [...bastante].sort((a, b) => b.cliques / b.exibicoes - a.cliques / a.exibicoes);
  const media = bastante.reduce((s, l) => s + l.cliques, 0) / Math.max(1, bastante.reduce((s, l) => s + l.exibicoes, 0));
  const maiorExib = Math.max(1, ...bastante.map((l) => l.exibicoes));

  return (
    <>
      <ul className="pares">
        {ordenadas.map((l) => {
          const taxa = l.cliques / l.exibicoes;
          // "Fraca" é relativo à própria casa, não a um número universal: cada
          // cardápio tem o seu patamar, e comparar com o de fora não ajuda.
          const fraca = taxa < media * 0.6;
          return (
            <li className={`pares__linha${fraca ? " pares__linha--fraca" : ""}`} key={l.chave}>
              <span className="pares__quem">
                <b>{l.de}</b>
                <span className="pares__mais" aria-hidden="true">+</span>
                <b>{l.para}</b>
                {fraca ? <span className="pares__selo">rende pouco</span> : null}
              </span>
              <span className="pares__nums">
                {l.exibicoes.toLocaleString("pt-BR")} exibições · {l.cliques.toLocaleString("pt-BR")} interações
              </span>
              <span className="pares__barra" aria-hidden="true">
                <span style={{ width: `${Math.round((l.exibicoes / maiorExib) * 100)}%` }} />
              </span>
              <b className="pares__taxa">{Math.round(taxa * 100)}%</b>
              <span className="pares__delta"><Delta valor={variacao(l.cliques, l.cliquesAntes)} miudo /></span>
            </li>
          );
        })}
      </ul>

      {poucas > 0 ? (
        <p className="dica">
          {poucas === 1 ? "Uma combinação apareceu" : `${poucas} combinações apareceram`} menos de{" "}
          {MINIMO} vezes no período e {poucas === 1 ? "ficou" : "ficaram"} de fora: com tão poucas
          exibições, a taxa ainda não diz nada.
        </p>
      ) : null}

      {maisPuxados.length > 0 ? (
        <p className="dica">
          <b>Quem mais é puxado por uma sugestão:</b>{" "}
          {maisPuxados.map((p, i) => (
            <span key={p.nome}>
              {i > 0 ? ", " : ""}{p.nome} ({p.cliques.toLocaleString("pt-BR")})
            </span>
          ))}
          . São os itens que entram no pedido por causa de outro prato — o efeito que a
          harmonização existe para produzir.
        </p>
      ) : null}
    </>
  );
}
