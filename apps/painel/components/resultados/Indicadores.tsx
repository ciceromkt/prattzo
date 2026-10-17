import type { Resultados } from "@prattzo/core";
import { taxaInteresse, variacao } from "@prattzo/core";

/**
 * Os seis números que o dono lê em dois segundos.
 *
 * Cada um vem com a variação contra o período anterior de mesma largura,
 * porque um número solto não diz nada: 1.445 visitas é bom ou ruim? Só a
 * comparação responde. Quando não havia base — primeiro mês, ou o período
 * anterior zerado — a variação não aparece, em vez de exibir "+100%", que é
 * verdadeiro e enganoso ao mesmo tempo.
 */
export function Indicadores({ r }: { r: Resultados }) {
  const n = (v: number) => v.toLocaleString("pt-BR");
  const taxa = taxaInteresse(r.resumo.pratos_vistos, r.resumo.quero);
  const taxaAntes = taxaInteresse(r.anterior.pratos_vistos, r.anterior.quero);

  return (
    <div className="indicadores">
      <Indicador
        valor={n(r.resumo.visitas)} rotulo="Visitas ao cardápio"
        nota="Sessões que abriram o cardápio"
        delta={variacao(r.resumo.visitas, r.anterior.visitas)}
      />
      <Indicador
        valor={n(r.resumo.pratos_vistos)} rotulo="Pratos visualizados"
        nota="Quando o cliente para no prato"
        delta={variacao(r.resumo.pratos_vistos, r.anterior.pratos_vistos)}
      />
      <Indicador
        valor={n(r.resumo.quero)} rotulo="Toques em “Quero esse”"
        nota="Interesse declarado, não venda"
        delta={variacao(r.resumo.quero, r.anterior.quero)}
      />
      <Indicador
        valor={`${taxa.toFixed(1).replace(".", ",")}%`} rotulo="Taxa de interesse"
        nota="De cada 100 visualizações"
        delta={variacao(taxa, taxaAntes)}
      />
      <Indicador
        valor={n(r.resumo.harmonizacao_cliques)} rotulo="Harmonizações acessadas"
        nota={r.resumo.harmonizacao_vistas > 0
          ? `De ${n(r.resumo.harmonizacao_vistas)} exibições`
          : "Nenhuma combinação exibida"}
        delta={variacao(r.resumo.harmonizacao_cliques, r.anterior.harmonizacao_cliques)}
      />
      <Indicador
        valor={n(r.resumo.compartilhamentos)} rotulo="Compartilhamentos"
        nota="Cliente mandou o prato para alguém"
        delta={variacao(r.resumo.compartilhamentos, r.anterior.compartilhamentos)}
      />
    </div>
  );
}

function Indicador({
  valor, rotulo, nota, delta,
}: {
  valor: string; rotulo: string; nota: string; delta: number | null;
}) {
  return (
    <div className="indicador">
      <b className="indicador__valor">{valor}</b>
      <span className="indicador__rotulo">{rotulo}</span>
      <Delta valor={delta} />
      <i className="indicador__nota">{nota}</i>
    </div>
  );
}

/**
 * A variação.
 *
 * A seta e o sinal fazem o trabalho; a cor só reforça. É de propósito: o par
 * de cores de subida e descida é indistinguível para boa parte dos
 * daltonismos, e um painel que só muda de cor deixa essa pessoa sem a
 * informação. Com "+12%" escrito, a cor vira enfeite.
 */
export function Delta({ valor, miudo = false }: { valor: number | null; miudo?: boolean }) {
  if (valor === null) {
    return <span className={`delta delta--sem${miudo ? " delta--miudo" : ""}`}>sem base anterior</span>;
  }
  const arredondado = Math.round(valor);
  if (arredondado === 0) {
    return <span className={`delta delta--igual${miudo ? " delta--miudo" : ""}`}>igual ao período anterior</span>;
  }
  const sobe = arredondado > 0;
  return (
    <span
      className={`delta ${sobe ? "delta--sobe" : "delta--desce"}${miudo ? " delta--miudo" : ""}`}
      title="Comparado com o período anterior de mesma duração"
    >
      <span aria-hidden="true">{sobe ? "↑" : "↓"}</span>
      {sobe ? "+" : "−"}{Math.abs(arredondado)}%
      {miudo ? null : <span className="delta__ref"> vs. período anterior</span>}
    </span>
  );
}
