/**
 * Montagem do cardápio: ordem, capas, esgotado e o diagnóstico de cadastro.
 * Tudo determinístico e testado — é o que decide o que o cliente vê.
 */

import type { Category, Dish, MediaItem, MenuGroup } from "./types";
import { hasPrice } from "./price";

/** Descrição curta vende pouco. O painel avisa abaixo disso. */
export const DESCRICAO_MINIMA = 40;

/** Fuso usado quando o restaurante não tem um cadastrado. */
export const FUSO_PADRAO = "America/Sao_Paulo";

/** Hora da virada do serviço: às 6h o que esgotou ontem volta ao cardápio. */
const HORA_VIRADA = 6;

function partesNoFuso(d: Date, fuso: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const p: Record<string, string> = {};
  for (const parte of f.formatToParts(d)) p[parte.type] = parte.value;
  return {
    ano: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    hora: Number(p.hour) % 24, min: Number(p.minute), seg: Number(p.second),
  };
}

/** Deslocamento do fuso, em ms, no instante dado (lida com horário de verão). */
function deslocamentoMs(d: Date, fuso: string): number {
  const p = partesNoFuso(d, fuso);
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.min, p.seg) - d.getTime();
}

/**
 * Até quando vale o "acabou", no fuso do restaurante.
 *
 * O servidor roda em UTC. Usar a hora local dele faz o item voltar às 3h da
 * manhã em São Paulo — com o rooftop ainda aberto, servindo o que acabou. Por
 * isso a virada é calculada no fuso do restaurante, não no do servidor.
 */
export function esgotadoAte(agora: Date = new Date(), fuso: string = FUSO_PADRAO): Date {
  const p = partesNoFuso(agora, fuso);
  const dia = p.hora >= HORA_VIRADA ? p.dia + 1 : p.dia;
  const alvoComoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, dia, HORA_VIRADA, 0, 0);
  // Primeiro chute e correção: o deslocamento pode mudar entre hoje e o alvo.
  const chute = new Date(alvoComoSeFosseUtc - deslocamentoMs(agora, fuso));
  return new Date(alvoComoSeFosseUtc - deslocamentoMs(chute, fuso));
}

export function estaEsgotado(d: Pick<Dish, "esgotado_ate">, agora: Date = new Date()): boolean {
  if (!d.esgotado_ate) return false;
  const ate = new Date(d.esgotado_ate);
  return Number.isFinite(ate.getTime()) && ate > agora;
}

export function ordenar<T extends { ordem: number; nome: string }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function capaDoPrato(d: Pick<Dish, "midias">): string | null {
  const m = ordenar(d.midias.map((x, i) => ({ ...x, ordem: x.ordem, nome: String(i) })));
  const video = m.find((x) => x.tipo === "video" && x.poster_url);
  if (video?.poster_url) return video.poster_url;
  const foto = m.find((x) => x.tipo === "foto");
  return foto?.url ?? null;
}

export function videoDoPrato(d: Pick<Dish, "midias">): MediaItem | null {
  return ordenar(d.midias.map((x, i) => ({ ...x, nome: String(i) }))).find((x) => x.tipo === "video") ?? null;
}

/**
 * Todas as mídias do prato, na ordem em que o cliente as percorre.
 *
 * Vídeo primeiro, foto depois, cada grupo na ordem do dono. O vídeo na frente
 * não é preferência estética: é o que `capaDoPrato` já mostra na lista e na
 * capa da categoria, então é o que o cliente esperava ver ao tocar. Começar
 * pela foto faria o toque parecer ter aberto outro item.
 */
export function midiasDoPrato(d: Pick<Dish, "midias">): MediaItem[] {
  const lista = ordenar(d.midias.map((x, i) => ({ ...x, nome: String(i) })));
  return [...lista.filter((m) => m.tipo === "video"), ...lista.filter((m) => m.tipo === "foto")];
}

export function temMidia(d: Pick<Dish, "midias">): boolean {
  return d.midias.length > 0;
}

/** Todas as imagens da categoria que podem virar capa dela. */
export function opcoesDeCapa(grupo: MenuGroup): Array<{ url: string; rotulo: string }> {
  const out: Array<{ url: string; rotulo: string }> = [];
  for (const p of grupo.pratos) {
    for (const m of ordenar(p.midias.map((x, i) => ({ ...x, nome: String(i) })))) {
      const url = m.tipo === "video" ? m.poster_url : m.url;
      if (!url || out.some((o) => o.url === url)) continue;
      out.push({ url, rotulo: m.tipo === "video" ? `${p.nome} · vídeo` : p.nome });
    }
  }
  return out;
}

/** A capa escolhida pelo dono; sem escolha, a primeira imagem da categoria. */
export function capaDaCategoria(grupo: MenuGroup): string | null {
  if (grupo.categoria.capa_url) return grupo.categoria.capa_url;
  return opcoesDeCapa(grupo)[0]?.url ?? null;
}

/** Agrupa e ordena. `somentePublico` tira o que o cliente não deve ver. */
export function montarGrupos(
  categorias: readonly Category[],
  pratos: readonly Dish[],
  somentePublico = true,
): MenuGroup[] {
  const cats = ordenar(categorias).filter((c) => (somentePublico ? c.ativa : true));
  const grupos = cats.map((categoria) => ({
    categoria,
    pratos: ordenar(pratos.filter((p) => p.category_id === categoria.id && (somentePublico ? p.ativo : true))),
  }));
  const soltos = ordenar(pratos.filter((p) => !p.category_id && (somentePublico ? p.ativo : true)));
  if (soltos.length > 0) {
    grupos.push({
      categoria: {
        id: "sem-categoria",
        restaurant_id: soltos[0]!.restaurant_id,
        nome: "Outros",
        ordem: 9999,
        ativa: true,
        capa_url: null,
      },
      pratos: soltos,
    });
  }
  // Categoria vazia não vira buraco na grade do cliente.
  return somentePublico ? grupos.filter((g) => g.pratos.length > 0) : grupos;
}

/** Fila dos stories: só o que tem o que mostrar, na ordem do cardápio. */
export function filaDeStories(grupos: readonly MenuGroup[]): Dish[] {
  return grupos.flatMap((g) => g.pratos);
}

export interface Pendencia {
  dish_id: string;
  nome: string;
  categoria: string;
  faltas: string[];
}

export interface DiagnosticoCardapio {
  totalItens: number;
  comMidia: number;
  comVideo: number;
  semPreco: number;
  descricaoCurta: number;
  categoriasSemCapa: string[];
  pendencias: Pendencia[];
}

/**
 * O que falta cadastrar. Substitui a antiga "auditoria por IA": são fatos
 * contáveis, não opinião de modelo — e por isso dá para confiar e agir.
 */
export function diagnosticar(grupos: readonly MenuGroup[]): DiagnosticoCardapio {
  const pendencias: Pendencia[] = [];
  const categoriasSemCapa: string[] = [];
  let comMidia = 0;
  let comVideo = 0;
  let semPreco = 0;
  let descricaoCurta = 0;
  let totalItens = 0;

  for (const g of grupos) {
    if (!capaDaCategoria(g)) categoriasSemCapa.push(g.categoria.nome);
    for (const p of g.pratos) {
      totalItens++;
      const faltas: string[] = [];
      if (!hasPrice(p)) { semPreco++; faltas.push("sem preço"); }
      if (!p.descricao.trim()) faltas.push("sem descrição");
      else if (p.descricao.trim().length < DESCRICAO_MINIMA) { descricaoCurta++; faltas.push("descrição curta"); }
      if (temMidia(p)) comMidia++; else faltas.push("sem foto nem vídeo");
      if (videoDoPrato(p)) comVideo++;
      if (faltas.length > 0) {
        pendencias.push({ dish_id: p.id, nome: p.nome, categoria: g.categoria.nome, faltas });
      }
    }
  }

  return { totalItens, comMidia, comVideo, semPreco, descricaoCurta, categoriasSemCapa, pendencias };
}

/** Próxima posição livre, para item ou categoria novos irem para o fim. */
export function proximaOrdem(itens: readonly { ordem: number }[]): number {
  return itens.reduce((max, i) => Math.max(max, i.ordem), 0) + 1;
}

/** Move um item uma casa e devolve os pares (id, ordem) que mudaram. */
export function reordenar<T extends { id: string; ordem: number; nome: string }>(
  itens: readonly T[],
  id: string,
  direcao: "cima" | "baixo",
): Array<{ id: string; ordem: number }> {
  const lista = ordenar(itens);
  const i = lista.findIndex((x) => x.id === id);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return [];
  const a = lista[i]!;
  const b = lista[j]!;
  // Reescreve as duas posições por índice: ordens iguais ou repetidas não travam a troca.
  return [{ id: a.id, ordem: j }, { id: b.id, ordem: i }];
}

/**
 * Tira o item da posição `de` e encaixa em `para`, empurrando o resto.
 *
 * É o que o arrasto faz na tela: não é uma TROCA entre dois (isso é o `↑`),
 * é mudar de lugar. Levar o primeiro para o fim com trocas inverteria a lista
 * toda pelo caminho; aqui os outros só andam uma casa.
 */
export function moverNaLista<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || de >= lista.length) return [...lista];
  const destino = Math.max(0, Math.min(lista.length - 1, para));
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(destino, 0, item as T);
  return copia;
}

export interface Sugestao {
  prato: Dish;
  /** Rótulo curto sobre o item: a categoria que faltou, ou "Sugestão da casa". */
  motivo: string;
}

/**
 * O que oferecer na hora de fechar o pedido.
 *
 * A regra é a do salão, não a da loja online: o garçom experiente olha a mesa e
 * vê o que está faltando. Mesa que pediu comida e nenhuma bebida; que pediu
 * tudo e nenhuma sobremesa. Por isso a sugestão vem de categoria que o cliente
 * ainda não tocou — nunca "mais do mesmo", que é o que irrita.
 *
 * Quatro limites de propósito:
 * - item sem foto nem vídeo não entra: sem imagem não dá vontade, só atrapalha;
 * - item sem preço não entra: ninguém aceita o que não sabe quanto custa;
 * - item esgotado não entra, porque oferecer o que acabou é pior que não oferecer;
 * - item já no pedido não entra.
 *
 * O dono pode marcar `destaque` em um item para ele passar à frente dentro da
 * categoria dele. Não fura a regra: só ordena.
 */
export function sugestoesParaPedido(
  grupos: readonly MenuGroup[],
  pedido: Readonly<Record<string, number>>,
  max = 3,
  agora: Date = new Date(),
): Sugestao[] {
  const noPedido = (p: Dish) => (pedido[p.id] ?? 0) > 0;
  const elegivel = (p: Dish) => !noPedido(p) && !estaEsgotado(p, agora) && temMidia(p) && hasPrice(p);

  const categoriasTocadas = new Set(
    grupos.filter((g) => g.pratos.some(noPedido)).map((g) => g.categoria.id),
  );

  // Categoria intocada primeiro, na ordem do cardápio; dentro dela, destaque na frente.
  const deCategoriaNova = grupos
    .filter((g) => !categoriasTocadas.has(g.categoria.id))
    .map((g) => {
      const candidatos = g.pratos.filter(elegivel);
      const escolhido = candidatos.find((p) => p.destaque) ?? candidatos[0];
      return escolhido ? { prato: escolhido, motivo: g.categoria.nome } : null;
    })
    .filter((x): x is Sugestao => x !== null);

  if (deCategoriaNova.length >= max) return deCategoriaNova.slice(0, max);

  // Completa com o que o dono destacou, sem repetir o que já entrou.
  const jaEscolhidos = new Set(deCategoriaNova.map((s) => s.prato.id));
  const destaques = grupos
    .flatMap((g) => g.pratos.filter((p) => p.destaque && elegivel(p) && !jaEscolhidos.has(p.id))
      .map((p) => ({ prato: p, motivo: "Sugestão da casa" })));

  return [...deCategoriaNova, ...destaques].slice(0, max);
}
