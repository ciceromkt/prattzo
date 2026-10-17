/**
 * A forma dos números de Resultados.
 *
 * O ponto destes tipos é que existe UMA forma só. O caminho real (funções no
 * banco) e o modo demonstração (gerador determinístico, nada gravado)
 * produzem exatamente isto — então a tela não sabe de onde veio o número e
 * não tem um ramo "se for demo". É o que torna "nunca misturar fictício com
 * real" uma propriedade da arquitetura em vez de uma disciplina: os dois
 * nunca se somam porque nunca estão na mesma consulta.
 */

export interface ResumoPeriodo {
  /** Sessões que abriram o cardápio. */
  visitas: number;
  /** Visualizações qualificadas de prato (o cliente parou nele). */
  pratos_vistos: number;
  /** Toques em "Quero esse". */
  quero: number;
  harmonizacao_vistas: number;
  harmonizacao_cliques: number;
  compartilhamentos: number;
  pedidos_fechados: number;
  /** Sugestão do fechamento do pedido — outra tela, não a harmonização. */
  sugestoes_vistas: number;
  sugestoes_aceitas: number;
}

export interface PratoPeriodo {
  dish_id: string;
  vistas: number;
  terminou: number;
  quis: number;
  compartilhou: number;
  ms_medio: number | null;
}

export interface ParPeriodo {
  /** O prato aberto, de onde a oferta partiu. */
  dish_id: string;
  /** O prato oferecido. */
  alvo_id: string;
  exibicoes: number;
  cliques: number;
}

export interface DiaPeriodo {
  /** AAAA-MM-DD. */
  dia: string;
  visitas: number;
  vistas: number;
  quero: number;
  harmonizacao: number;
}

/**
 * Tudo que a tela precisa, para uma janela e para a janela anterior de mesma
 * largura. O "anterior" vem junto porque todo indicador mostra a variação, e
 * calcular os dois no mesmo lugar é o que garante que medem a mesma coisa.
 */
export interface Resultados {
  dias: number;
  demo: boolean;
  resumo: ResumoPeriodo;
  anterior: ResumoPeriodo;
  pratos: PratoPeriodo[];
  pratosAnterior: PratoPeriodo[];
  pares: ParPeriodo[];
  paresAnterior: ParPeriodo[];
  serie: DiaPeriodo[];
}

export const RESUMO_ZERO: ResumoPeriodo = {
  visitas: 0, pratos_vistos: 0, quero: 0,
  harmonizacao_vistas: 0, harmonizacao_cliques: 0,
  compartilhamentos: 0, pedidos_fechados: 0,
  sugestoes_vistas: 0, sugestoes_aceitas: 0,
};

/** Percentual de visualizações que viraram "Quero esse". */
export function taxaInteresse(vistas: number, quero: number): number {
  return vistas > 0 ? (quero / vistas) * 100 : 0;
}

/**
 * Base mínima para uma variação significar alguma coisa.
 *
 * De 2 para 7 são "+250%", o que é aritmeticamente correto e, numa tela de
 * decisão, mentira: são cinco toques de diferença, dentro do acaso de
 * qualquer semana. Abaixo deste piso a tela prefere não dizer nada a dizer um
 * número que parece resultado.
 */
export const BASE_MINIMA_VARIACAO = 8;

/**
 * Variação contra o período anterior, em pontos percentuais do valor antigo.
 *
 * Devolve null quando não havia base — "subiu 100%" partindo de zero é um
 * número verdadeiro e inútil.
 */
export function variacao(agora: number, antes: number): number | null {
  if (antes < BASE_MINIMA_VARIACAO) return null;
  return ((agora - antes) / antes) * 100;
}
