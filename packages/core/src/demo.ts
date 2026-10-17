/**
 * Modo demonstração: 90 dias de comportamento de cliente, inventados.
 *
 * Para quê: o Prattzo é vendido mostrando o que ele revela sobre o cardápio,
 * e uma casa nova não tem movimento no primeiro dia. Sem isto, a tela que
 * mais vende o produto é a única que o cliente em potencial vê vazia.
 *
 * Duas decisões sustentam tudo o que vem abaixo.
 *
 * A PRIMEIRA é que nada disto é gravado. Não há linha falsa em `events`, em
 * lugar nenhum: os números nascem aqui, na hora da leitura, e morrem quando a
 * página fecha. "Nunca misturar dados fictícios com reais" deixa de ser
 * cuidado de quem programa e passa a ser impossível — não existe o que
 * misturar. O preço é recalcular a cada carregamento, que para 31 pratos e
 * 180 dias é trabalho de milissegundos.
 *
 * A SEGUNDA é que o acaso tem semente fixa. Números sorteados de verdade
 * mudariam a cada F5, e um painel cujos números dançam não demonstra nada —
 * ninguém consegue apontar para a tela e explicar. Aqui a semente é o id do
 * restaurante, o id do prato e a DATA do dia: a mesma terça-feira devolve
 * sempre o mesmo movimento, a janela de 30 dias é sempre o fim da de 90, e a
 * comparação com o período anterior é estável.
 *
 * O que NÃO é inventado: os pratos, as categorias, as fotos, os preços e as
 * harmonizações. Tudo isso é lido do cardápio real da casa. O que se inventa
 * é só o comportamento de quem olhou.
 */

import { harmonizacoes } from "./harmonizacao";
import { temMidia, videoDoPrato } from "./menu";
import type {
  DiaPeriodo, ParPeriodo, PratoPeriodo, Resultados, ResumoPeriodo,
} from "./resultados";
import { RESUMO_ZERO } from "./resultados";
import type {
  Dish, EstiloHarmonizacao, MenuGroup, ModoHarmonizacao, ParCategoria, ParPrato,
} from "./types";

export interface CatalogoDemo {
  restaurantId: string;
  grupos: readonly MenuGroup[];
  paresPrato: readonly ParPrato[];
  paresCategoria: readonly ParCategoria[];
  harmonizacao: { modo: ModoHarmonizacao; max: number; estilo: EstiloHarmonizacao };
}

/** Quantos dias de história o gerador mantém. 90 para ver + 90 para comparar. */
export const DEMO_DIAS = 180;

/** Visitas por dia numa casa como o Gula, em dia comum. */
const VISITAS_BASE = 48;

/* --------------------------------------------------------------- acaso fixo */

/** FNV-1a: texto → inteiro. Pequeno, estável, e não depende de biblioteca. */
function semente(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Um número em [0,1) a partir de uma chave. Mesma chave, mesmo número. */
function sorte(...partes: string[]): number {
  let x = semente(partes.join("|"));
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

/** Ruído em torno de 1, para o número não sair liso demais. */
const oscila = (chave: string, amplitude: number) => 1 + (sorte(chave) - 0.5) * 2 * amplitude;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------- o perfil dos pratos */

interface PerfilPrato {
  prato: Dish;
  /** Quanto o prato atrai, de 0 a 1. */
  apelo: number;
  /** Quantos dos que viram tocam "Quero esse". */
  taxa: number;
  /** Com quem ele harmoniza, segundo a configuração REAL da casa. */
  pares: string[];
  temVideo: boolean;
}

/**
 * O apelo de cada prato.
 *
 * Não é sorteado puro: é sorteio moldado pelo que o cardápio já diz sobre o
 * prato, para a demonstração contar uma história que bate com a tela. Quem
 * tem vídeo aparece mais (é o que entra na fila de stories e prende), quem
 * está no começo do cardápio é visto mais vezes, quem o dono destacou sobe. E
 * quem não tem foto nem vídeo fica perto de zero — não por castigo, mas
 * porque o cardápio do cliente realmente não o mostra. É daí que nascem, com
 * honestidade, as oportunidades de "pouco descoberto" e "sem vídeo".
 *
 * A curva `^1.7` é o que dá a forma pedida — alguns poucos pratos muito
 * acima, a maioria no meio, alguns no fim. Sorteio uniforme deixaria todos
 * parecidos, e aí o ranking não ensina nada.
 */
function perfilar(cat: CatalogoDemo): PerfilPrato[] {
  const ordenados = cat.grupos.flatMap((g) => g.pratos);
  return ordenados.map((prato, posicao) => {
    const comVideo = videoDoPrato(prato) !== null;
    const comMidia = temMidia(prato);

    // O piso de 0.3 é o que impede um prato COM foto de zerar. Sem ele, a
    // curva levava os últimos a frações que arredondam para zero todo dia, e
    // a tela dizia "ninguém viu" de um item que o cardápio mostra — o que é
    // falso, e geraria uma recomendação em cima de uma mentira.
    const bruto = sorte(cat.restaurantId, prato.id, "apelo");
    let apelo = 0.3 + Math.pow(bruto, 1.25) * 0.7;
    if (comVideo) apelo *= 1.9;
    if (prato.destaque) apelo *= 1.4;
    // Quem está no fim do cardápio é visto menos: o cliente cansa antes.
    apelo *= 1 / (1 + posicao * 0.035);

    /**
     * Sem foto nem vídeo o prato É visto — e é aí que está o problema.
     *
     * Chegei a zerá-lo, achando que a fila dos stories só incluía quem tem o
     * que mostrar. Não é verdade: a fila é a categoria inteira, e o prato sem
     * mídia aparece com o aviso "Ainda sem foto nem vídeo". O cliente passa
     * por ele como passa pelos outros.
     *
     * Então ele recebe visualização, perde um pouco (quem cai num quadro vazio
     * acelera ou desiste) e quase não converte: não se deseja o que não se vê.
     * É exatamente esse retrato — muita vista, nenhum toque — que faz a tela
     * acusar o problema de cadastro em vez de escondê-lo num zero.
     */
    if (!comMidia) apelo *= 0.55;

    // Interesse entre 7% e 34%: abaixo disso o painel chamaria tudo de
    // problema, acima soaria propaganda. Vídeo melhora o fim da faixa.
    const taxa = (0.07 + sorte(cat.restaurantId, prato.id, "taxa") * 0.21)
      * (comVideo ? 1.3 : 1)
      * (comMidia ? 1 : 0.12);

    const pares = harmonizacoes({
      grupos: cat.grupos,
      prato,
      paresPrato: cat.paresPrato,
      paresCategoria: cat.paresCategoria,
      modo: cat.harmonizacao.modo,
      max: cat.harmonizacao.max,
      estilo: cat.harmonizacao.estilo,
    }).map((h) => h.prato.id);

    return { prato, apelo, taxa: Math.min(taxa, 0.42), pares, temVideo: comVideo };
  });
}

/* ------------------------------------------------------------- o dia a dia  */

/**
 * O movimento de um dia da semana num bar.
 *
 * Sexta e sábado puxam a casa; segunda é o fundo do poço. Sem isso o gráfico
 * vira uma reta com chiado, e quem olha não reconhece o próprio negócio —
 * que é o primeiro teste de uma demonstração.
 */
const PESO_DIA = [0.62, 0.55, 0.68, 0.84, 1.0, 1.75, 1.45]; // domingo..sábado

interface Dia {
  dia: string;
  visitas: number;
  porPrato: Map<string, { vistas: number; terminou: number; quis: number; compartilhou: number }>;
  porPar: Map<string, { dish_id: string; alvo_id: string; exibicoes: number; cliques: number }>;
  fechados: number;
  sugestoesVistas: number;
  sugestoesAceitas: number;
}

function gerarDia(cat: CatalogoDemo, perfis: PerfilPrato[], data: Date, idade: number): Dia {
  const dia = iso(data);
  const semanaAtras = Math.floor(idade / 7);

  // Tendência: a casa vem crescendo devagar, uns 2% por semana. É o que faz o
  // período anterior ser um pouco menor — e a comparação ter o que dizer.
  const tendencia = Math.pow(1.02, -semanaAtras);
  const visitas = Math.max(
    4,
    Math.round(VISITAS_BASE * PESO_DIA[data.getDay()]! * tendencia * oscila(`${cat.restaurantId}|${dia}|v`, 0.22)),
  );

  const somaApelo = perfis.reduce((s, p) => s + p.apelo, 0) || 1;
  // Cada cliente passa por 5 a 9 pratos antes de decidir.
  const vistasTotais = Math.round(visitas * (5 + sorte(dia, "profundidade") * 4));

  const porPrato = new Map<string, { vistas: number; terminou: number; quis: number; compartilhou: number }>();
  const porPar = new Map<string, { dish_id: string; alvo_id: string; exibicoes: number; cliques: number }>();

  for (const p of perfis) {
    /**
     * Cada prato tem a SUA tendência, entre -3% e +3% por semana.
     *
     * Sem isso só existia a tendência da casa, e ela empurrava todos os pratos
     * para cima na mesma proporção: a seção "quem ganhou e quem perdeu
     * interesse" vinha com a coluna dos que perderam sempre vazia. Num cardápio
     * de verdade há prato subindo e prato caindo ao mesmo tempo, e é dessa
     * diferença que o dono tira decisão.
     */
    const tendenciaPrato = Math.pow(1 + (sorte(p.prato.id, "tendencia") - 0.5) * 0.06, -semanaAtras);
    const fatia = (p.apelo / somaApelo) * tendenciaPrato * oscila(`${p.prato.id}|${dia}`, 0.35);
    const vistas = Math.round(vistasTotais * fatia);
    if (vistas <= 0) {
      porPrato.set(p.prato.id, { vistas: 0, terminou: 0, quis: 0, compartilhou: 0 });
      continue;
    }
    const quis = Math.round(vistas * p.taxa * oscila(`${p.prato.id}|${dia}|q`, 0.3));
    // Terminar o vídeo é outra coisa de ver o prato: 45% a 80% de quem abriu.
    const terminou = p.temVideo
      ? Math.round(vistas * (0.45 + sorte(p.prato.id, "fim") * 0.35))
      : 0;
    // Compartilhar é raro, e quem compartilha é quem quis — mas não tão raro
    // quanto 6 em trinta dias, que não sustenta nem uma linha de leitura.
    const compartilhou = sorte(`${p.prato.id}|${dia}|share`) < 0.5 ? Math.round(quis * 0.12) : 0;

    porPrato.set(p.prato.id, { vistas, terminou, quis, compartilhou });

    // A tira "Harmoniza com" aparece sempre que o prato é aberto e tem par.
    for (const alvo of p.pares) {
      const chave = `${p.prato.id}|${alvo}`;
      const exibicoes = vistas;
      const taxaPar = 0.1 + sorte(chave, "par") * 0.22;
      const cliques = Math.round(exibicoes * taxaPar * oscila(`${chave}|${dia}`, 0.4));
      const atual = porPar.get(chave) ?? { dish_id: p.prato.id, alvo_id: alvo, exibicoes: 0, cliques: 0 };
      atual.exibicoes += exibicoes;
      atual.cliques += cliques;
      porPar.set(chave, atual);
    }
  }

  // Quem fecha o pedido é uma parte de quem entrou; a sugestão do fechamento
  // aparece para esses, e uma parte dela é aceita.
  const fechados = Math.round(visitas * (0.16 + sorte(dia, "fecha") * 0.12));
  const sugestoesVistas = fechados;
  const sugestoesAceitas = Math.round(sugestoesVistas * (0.12 + sorte(dia, "aceita") * 0.18));

  return { dia, visitas, porPrato, porPar, fechados, sugestoesVistas, sugestoesAceitas };
}

/* ------------------------------------------------------------- a montagem   */

function somar(dias: readonly Dia[]): ResumoPeriodo {
  const r: ResumoPeriodo = { ...RESUMO_ZERO };
  for (const d of dias) {
    r.visitas += d.visitas;
    r.pedidos_fechados += d.fechados;
    r.sugestoes_vistas += d.sugestoesVistas;
    r.sugestoes_aceitas += d.sugestoesAceitas;
    for (const p of d.porPrato.values()) {
      r.pratos_vistos += p.vistas;
      r.quero += p.quis;
      r.compartilhamentos += p.compartilhou;
    }
    for (const par of d.porPar.values()) {
      r.harmonizacao_vistas += par.exibicoes;
      r.harmonizacao_cliques += par.cliques;
    }
  }
  return r;
}

function porPrato(dias: readonly Dia[], perfis: readonly PerfilPrato[]): PratoPeriodo[] {
  return perfis.map((perfil) => {
    const linha: PratoPeriodo = {
      dish_id: perfil.prato.id, vistas: 0, terminou: 0, quis: 0, compartilhou: 0, ms_medio: null,
    };
    for (const d of dias) {
      const p = d.porPrato.get(perfil.prato.id);
      if (!p) continue;
      linha.vistas += p.vistas;
      linha.terminou += p.terminou;
      linha.quis += p.quis;
      linha.compartilhou += p.compartilhou;
    }
    /**
     * Atenção média por visualização, em milissegundos.
     *
     * O teto não é estético: o cardápio toca no máximo 15 segundos de vídeo e
     * passa para o próximo prato, e a foto avança sozinha antes disso. Uma
     * demonstração que mostrasse 24 segundos de atenção média estaria
     * descrevendo um cardápio que não é este.
     */
    const base = perfil.temVideo ? 5200 : 2000;
    const teto = perfil.temVideo ? 14000 : 5200;
    linha.ms_medio = linha.vistas > 0
      ? Math.min(teto, Math.round(base * (0.8 + sorte(perfil.prato.id, "atencao") * 1.4)))
      : null;
    return linha;
  });
}

function porPar(dias: readonly Dia[]): ParPeriodo[] {
  const mapa = new Map<string, ParPeriodo>();
  for (const d of dias) {
    for (const [chave, par] of d.porPar) {
      const atual = mapa.get(chave)
        ?? { dish_id: par.dish_id, alvo_id: par.alvo_id, exibicoes: 0, cliques: 0 };
      atual.exibicoes += par.exibicoes;
      atual.cliques += par.cliques;
      mapa.set(chave, atual);
    }
  }
  return [...mapa.values()];
}

function serie(dias: readonly Dia[]): DiaPeriodo[] {
  return dias.map((d) => {
    let vistas = 0; let quero = 0; let harmonizacao = 0;
    for (const p of d.porPrato.values()) { vistas += p.vistas; quero += p.quis; }
    for (const par of d.porPar.values()) harmonizacao += par.cliques;
    return { dia: d.dia, visitas: d.visitas, vistas, quero, harmonizacao };
  });
}

/**
 * Os números do modo demonstração para uma janela.
 *
 * `dias` é a janela pedida (7, 30 ou 90). A história é sempre a mesma: 180
 * dias gerados uma vez, dos quais a janela e a janela anterior são recortes.
 * Por isso 30 dias é literalmente o fim dos 90 — não uma segunda invenção com
 * outros números, que é o que faria o dono perder a confiança na tela.
 */
export function resultadosDemo(cat: CatalogoDemo, dias: number, hoje = new Date()): Resultados {
  const janela = Math.max(1, Math.min(Math.round(dias), 90));
  const perfis = perfilar(cat);

  const todos: Dia[] = [];
  for (let idade = DEMO_DIAS - 1; idade >= 0; idade--) {
    const data = new Date(hoje);
    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() - idade);
    todos.push(gerarDia(cat, perfis, data, idade));
  }

  const fim = todos.length;
  const atual = todos.slice(fim - janela, fim);
  const antes = todos.slice(fim - janela * 2, fim - janela);

  return {
    dias: janela,
    demo: true,
    resumo: somar(atual),
    anterior: somar(antes),
    pratos: porPrato(atual, perfis),
    pratosAnterior: porPrato(antes, perfis),
    pares: porPar(atual),
    paresAnterior: porPar(antes),
    serie: serie(atual),
  };
}
