/**
 * De número para recomendação.
 *
 * Esta é a parte do Prattzo que não é um cardápio: o dono não quer saber que
 * a Panceta teve 412 visualizações, quer saber o que fazer com isso na
 * segunda-feira. Toda oportunidade aqui nasce de uma REGRA sobre números que
 * estão na tela, e carrega os números junto — se o dono discordar, ele
 * consegue conferir a conta. Nada é "o sistema achou".
 *
 * O que estas regras nunca dizem: que algo aumentou a VENDA. O cardápio mede
 * interesse — quem olhou, quem tocou em "Quero esse". Venda sai no caixa, e
 * enquanto não houver integração com o PDV, afirmar isso seria inventar.
 */

import { videoDoPrato } from "./menu";
import type { ParPeriodo, PratoPeriodo, Resultados } from "./resultados";
import { taxaInteresse } from "./resultados";
import type { Dish, MenuGroup } from "./types";

export type TipoOportunidade =
  | "alto_interesse"
  | "baixo_desempenho"
  | "pouco_descoberto"
  | "sem_harmonizacao"
  | "sem_video"
  | "par_promissor";

export interface Oportunidade {
  tipo: TipoOportunidade;
  titulo: string;
  /** O prato de que se fala. Em pares, o prato de onde a oferta parte. */
  dishId: string;
  alvoId?: string;
  nome: string;
  /** Os números que sustentam a recomendação, na linguagem do dono. */
  dados: string;
  /** Por que isso é uma oportunidade, em uma frase. */
  porque: string;
  acao: string;
  destino: { href: string; rotulo: string };
  /** Quanto vale olhar primeiro. Só ordena. */
  peso: number;
}

export interface EntradaOportunidades {
  resultados: Resultados;
  grupos: readonly MenuGroup[];
  /** Para cada prato, com quem ele está harmonizando HOJE na tela do cliente. */
  paresExibidos: ReadonlyMap<string, readonly string[]>;
  /** Teto de recomendações. Lista longa não é lida. */
  max?: number;
}

/** Abaixo disto o número é pequeno demais para sustentar conclusão. */
const MINIMO_VISTAS = 12;
const MINIMO_EXIBICOES_PAR = 20;

const mediana = (ns: number[]): number => {
  if (ns.length === 0) return 0;
  const o = [...ns].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2;
};

const pct = (n: number) => `${Math.round(n)}%`;

export function oportunidades({
  resultados, grupos, paresExibidos, max = 6,
}: EntradaOportunidades): Oportunidade[] {
  const pratos = new Map<string, Dish>();
  for (const g of grupos) for (const p of g.pratos) pratos.set(p.id, p);

  const porId = new Map<string, PratoPeriodo>(resultados.pratos.map((p) => [p.dish_id, p]));
  const comMovimento = resultados.pratos.filter((p) => p.vistas >= MINIMO_VISTAS);
  const medianaVistas = mediana(resultados.pratos.map((p) => p.vistas));
  const taxaMedia = taxaInteresse(resultados.resumo.pratos_vistos, resultados.resumo.quero);

  const saida: Oportunidade[] = [];
  const jaFalou = new Set<string>();

  /** Um prato rende UMA recomendação: a mais forte. Repetir vira ruído. */
  const propor = (o: Oportunidade) => {
    if (jaFalou.has(o.dishId)) return;
    jaFalou.add(o.dishId);
    saida.push(o);
  };

  /* 1. Alto interesse — o que já está funcionando, e que o dono pode usar
        para puxar o resto do cardápio. */
  for (const p of [...comMovimento].sort((a, b) => b.quis - a.quis)) {
    const prato = pratos.get(p.dish_id);
    if (!prato) continue;
    const taxa = taxaInteresse(p.vistas, p.quis);
    if (taxa < Math.max(22, taxaMedia * 1.3)) continue;
    propor({
      tipo: "alto_interesse",
      titulo: `${prato.nome} está puxando o cardápio`,
      dishId: p.dish_id,
      nome: prato.nome,
      dados: `${p.vistas} visualizações e ${p.quis} toques em “Quero esse” — ${pct(taxa)} de interesse, contra ${pct(taxaMedia)} do cardápio.`,
      porque: "Quem vê este prato quer este prato. É o item com mais chance de levar outro junto.",
      acao: paresExibidos.get(p.dish_id)?.length
        ? "Mantenha a harmonização dele e considere pôr o prato mais cedo no cardápio."
        : "Crie uma harmonização a partir dele: a oferta aparece no momento em que o cliente já está decidido.",
      destino: paresExibidos.get(p.dish_id)?.length
        ? { href: "/cardapio", rotulo: "Ver no cardápio" }
        : { href: "/harmonizacao", rotulo: "Criar harmonização" },
      peso: 100 + taxa,
    });
  }

  /* 2. Baixo desempenho — muita gente vê, quase ninguém quer. É o sinal mais
        acionável do painel: o prato não está se vendendo como se mostra. */
  for (const p of comMovimento) {
    const prato = pratos.get(p.dish_id);
    if (!prato || prato.midias.length === 0) continue;
    const taxa = taxaInteresse(p.vistas, p.quis);
    if (p.vistas < medianaVistas || taxa >= Math.min(10, taxaMedia * 0.6)) continue;
    propor({
      tipo: "baixo_desempenho",
      titulo: `${prato.nome} é visto, mas não é desejado`,
      dishId: p.dish_id,
      nome: prato.nome,
      dados: `${p.vistas} visualizações e só ${p.quis} toques em “Quero esse” — ${pct(taxa)}, contra ${pct(taxaMedia)} do cardápio.`,
      porque: "Atenção ele tem. O que não está convencendo é como o prato aparece: foto parada, vídeo fraco ou descrição que não dá vontade.",
      acao: "Troque a foto ou o vídeo e reescreva a descrição. Em duas semanas dá para comparar a taxa com a de hoje.",
      destino: { href: "/cardapio", rotulo: "Editar o item" },
      peso: 90 + (medianaVistas > 0 ? (p.vistas / medianaVistas) * 5 : 0),
    });
  }

  /* 3. Pouco descoberto — tem foto e preço, e mesmo assim ninguém chega. Em
        geral é posição no cardápio, não o prato. */
  for (const p of resultados.pratos) {
    const prato = pratos.get(p.dish_id);
    if (!prato || !prato.ativo) continue;
    const temAlgo = prato.midias.length > 0;
    if (!temAlgo || medianaVistas <= 0 || p.vistas > medianaVistas * 0.45) continue;
    propor({
      tipo: "pouco_descoberto",
      titulo: `${prato.nome} quase não é visto`,
      dishId: p.dish_id,
      nome: prato.nome,
      dados: `${p.vistas} visualizações no período, contra ${Math.round(medianaVistas)} da mediana do cardápio.`,
      porque: "O prato tem foto e preço, então não é falta de cadastro: o cliente está cansando antes de chegar nele.",
      acao: "Suba a categoria dele — ou o item dentro dela — para mais perto do começo e compare no próximo período.",
      destino: { href: "/cardapio", rotulo: "Reordenar o cardápio" },
      peso: 60,
    });
  }

  /* 4. Prato popular sem harmonização: oferta que não está sendo feita. */
  for (const p of [...comMovimento].sort((a, b) => b.vistas - a.vistas).slice(0, 8)) {
    const prato = pratos.get(p.dish_id);
    // Sem foto nem vídeo o prato nem aparece para o cliente: harmonizar não é
    // o conselho, cadastrar a mídia é — e disso o editor já avisa.
    if (!prato || prato.midias.length === 0) continue;
    if (p.vistas < medianaVistas * 0.4) continue;
    if ((paresExibidos.get(p.dish_id)?.length ?? 0) > 0) continue;
    propor({
      tipo: "sem_harmonizacao",
      titulo: `${prato.nome} não sugere nada junto`,
      dishId: p.dish_id,
      nome: prato.nome,
      dados: `${p.vistas} visualizações no período e nenhuma harmonização configurada.`,
      porque: "Toda vez que alguém abre este prato, a tela perde a chance de oferecer a bebida ou o acompanhamento que combina.",
      acao: "Escolha uma bebida ou acompanhamento para ele. A sugestão aparece dentro do prato, antes de o cliente sair.",
      destino: { href: "/harmonizacao", rotulo: "Harmonizar este prato" },
      peso: 80,
    });
  }

  /* 5. Recebe atenção e não tem vídeo. O vídeo é a aposta do produto — aqui
        ela vira um teste que o dono pode medir. */
  for (const p of comMovimento) {
    const prato = pratos.get(p.dish_id);
    if (!prato || prato.midias.length === 0 || videoDoPrato(prato)) continue;
    if (p.vistas < medianaVistas * 0.6) continue;
    propor({
      tipo: "sem_video",
      titulo: `${prato.nome} só tem foto`,
      dishId: p.dish_id,
      nome: prato.nome,
      dados: `${p.vistas} visualizações no período, ${pct(taxaInteresse(p.vistas, p.quis))} de interesse, nenhum vídeo.`,
      porque: "Prato que já recebe atenção é o melhor lugar para testar vídeo: a comparação fica limpa, porque o público é o mesmo.",
      acao: "Grave 10 a 15 segundos do prato saindo e compare a taxa de interesse com a de agora.",
      destino: { href: "/cardapio", rotulo: "Enviar vídeo" },
      peso: 70,
    });
  }

  /* 6. Combinação promissora: o par que converte acima dos outros merece
        aparecer mais. */
  const comExibicao = resultados.pares.filter((x) => x.exibicoes >= MINIMO_EXIBICOES_PAR);
  const taxaParMedia = comExibicao.length > 0
    ? (comExibicao.reduce((s, x) => s + x.cliques, 0) / comExibicao.reduce((s, x) => s + x.exibicoes, 0)) * 100
    : 0;
  for (const par of [...comExibicao].sort((a, b) => b.cliques / b.exibicoes - a.cliques / a.exibicoes)) {
    const de = pratos.get(par.dish_id);
    const para = pratos.get(par.alvo_id);
    if (!de || !para) continue;
    const taxa = (par.cliques / par.exibicoes) * 100;
    if (taxa < taxaParMedia * 1.15) continue;
    const chave = `${par.dish_id}|${par.alvo_id}`;
    if (jaFalou.has(chave)) continue;
    jaFalou.add(chave);
    saida.push({
      tipo: "par_promissor",
      titulo: `${de.nome} + ${para.nome} está funcionando`,
      dishId: par.dish_id,
      alvoId: par.alvo_id,
      nome: `${de.nome} + ${para.nome}`,
      dados: `${par.exibicoes} exibições e ${par.cliques} interações — ${pct(taxa)}, contra ${pct(taxaParMedia)} das outras combinações.`,
      porque: "Esta dupla convence mais que a média. É uma combinação que o salão pode repetir na boca também.",
      acao: "Escreva o motivo dela na harmonização e use a mesma dupla na comunicação da casa.",
      destino: { href: "/harmonizacao", rotulo: "Ver a combinação" },
      peso: 85 + taxa,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as Oportunidade);
    break;
  }

  /**
   * Um de cada tipo primeiro, depois os melhores que sobraram.
   *
   * Por peso puro a lista enchia de "alto interesse" — são os números
   * maiores. Mas o dono que abre esta seção precisa ver a largura do que o
   * painel enxerga: o que está indo bem, o que não convence, o que ninguém
   * acha, o que falta harmonizar. Seis recomendações do mesmo tipo são uma
   * recomendação repetida seis vezes.
   */
  const ordenada = saida.sort((a, b) => b.peso - a.peso);
  const primeiroDeCada: Oportunidade[] = [];
  const tiposUsados = new Set<TipoOportunidade>();
  for (const o of ordenada) {
    if (tiposUsados.has(o.tipo)) continue;
    tiposUsados.add(o.tipo);
    primeiroDeCada.push(o);
  }
  // E no preenchimento, no máximo DOIS de cada tipo: três cartões seguidos
  // dizendo "está funcionando" são um cartão repetido três vezes.
  const quantos = new Map<TipoOportunidade, number>(primeiroDeCada.map((o) => [o.tipo, 1]));
  const resto: Oportunidade[] = [];
  for (const o of ordenada) {
    if (primeiroDeCada.includes(o)) continue;
    const n = quantos.get(o.tipo) ?? 0;
    if (n >= 2) continue;
    quantos.set(o.tipo, n + 1);
    resto.push(o);
  }
  return [...primeiroDeCada, ...resto].slice(0, max).sort((a, b) => b.peso - a.peso);
}

/**
 * "Resumo do seu cardápio": os mesmos números, em prosa.
 *
 * Existe porque a maioria dos donos não lê tabela. A frase diz o que
 * aconteceu e nada além — nenhuma conclusão sobre faturamento, que o cardápio
 * não tem como saber.
 */
export function resumoEscrito({
  resultados, grupos, oportunidades: ops,
}: {
  resultados: Resultados;
  grupos: readonly MenuGroup[];
  oportunidades: readonly Oportunidade[];
}): string {
  const { resumo, dias } = resultados;
  const nomes = new Map<string, string>();
  for (const g of grupos) for (const p of g.pratos) nomes.set(p.id, p.nome);

  if (resumo.visitas === 0 && resumo.pratos_vistos === 0) {
    return `Nos últimos ${dias} dias o cardápio não registrou movimento. Os números aparecem depois que os primeiros clientes abrirem o cardápio pelo QR Code da mesa.`;
  }

  const frases: string[] = [
    `Nos últimos ${dias} dias, seu cardápio recebeu ${resumo.visitas.toLocaleString("pt-BR")} ${resumo.visitas === 1 ? "visita" : "visitas"} e ${resumo.pratos_vistos.toLocaleString("pt-BR")} visualizações de pratos.`,
  ];

  const maisVisto = [...resultados.pratos].sort((a, b) => b.vistas - a.vistas)[0];
  if (maisVisto && maisVisto.vistas > 0) {
    frases.push(`${nomes.get(maisVisto.dish_id) ?? "Um item"} foi o prato mais visto.`);
  }

  const melhorTaxa = [...resultados.pratos]
    .filter((p) => p.vistas >= MINIMO_VISTAS)
    .sort((a, b) => taxaInteresse(b.vistas, b.quis) - taxaInteresse(a.vistas, a.quis))[0];
  if (melhorTaxa && melhorTaxa.dish_id !== maisVisto?.dish_id) {
    frases.push(
      `${nomes.get(melhorTaxa.dish_id) ?? "Outro"} teve a maior taxa de interesse, ${pct(taxaInteresse(melhorTaxa.vistas, melhorTaxa.quis))} de quem o viu.`,
    );
  }

  if (resumo.harmonizacao_vistas > 0) {
    const taxaPar = (resumo.harmonizacao_cliques / resumo.harmonizacao_vistas) * 100;
    frases.push(
      `As harmonizações apareceram ${resumo.harmonizacao_vistas.toLocaleString("pt-BR")} vezes e receberam ${pct(taxaPar)} de interação.`,
    );
  }

  if (ops.length > 0) {
    frases.push(
      ops.length === 1
        ? "Identificamos uma oportunidade para melhorar a apresentação dos seus produtos."
        : `Identificamos ${ops.length} oportunidades para melhorar a apresentação dos seus produtos.`,
    );
  }

  return frases.join(" ");
}
