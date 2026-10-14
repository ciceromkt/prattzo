/**
 * Harmonização: com o que este prato vai bem.
 *
 * O cliente abre o Risoto Terra e Mar e o cardápio diz qual vinho pedir com
 * ele — e, abrindo o vinho, diz qual prato pedir com o vinho. É a pergunta que
 * se faz ao garçom experiente, e o cardápio comum não responde.
 *
 * De onde vem a resposta, e por que não é de um modelo:
 *
 * 1. PAR EXATO, do dono. Ele marcou "Risoto Terra e Mar + Chardonnay" e
 *    escreveu o porquê. Vem primeiro, na ordem dele, e a frase aparece na tela.
 * 2. REGRA DE CATEGORIA, do dono. Ele marcou "Drinks combina com Petiscos".
 *    Completa o que faltou, pegando o que ele destacou dentro da categoria.
 *
 * Nos dois casos quem sabe é a casa: quem harmoniza um prato é quem o cozinhou.
 * Um modelo acertaria o clichê e erraria o cardápio — ofereceria o vinho que
 * não está na carta, ou o espumante com o dadinho de tapioca. E, pior, não
 * saberia dizer por quê. Aqui a sugestão é sempre explicável: ou é a frase do
 * dono, ou é a categoria que ele mesmo casou.
 *
 * O par é guardado sem direção (a_id < b_id no banco), então uma linha serve
 * aos dois sentidos — o dono cadastra uma vez.
 */

import type { Dish, MenuGroup, ParCategoria, ParPrato } from "./types";
import { estaEsgotado, temMidia } from "./menu";
import { hasPrice } from "./price";

export interface Harmonizacao {
  prato: Dish;
  /** Rótulo curto acima do nome: a categoria dele, ou "Harmoniza". */
  motivo: string;
  /** A frase do dono para este par. Vazia quando veio da regra de categoria. */
  nota: string;
}

/** O outro lado do par, qualquer que seja o lado em que `id` esteja. */
function oOutro(par: { a_id: string; b_id: string }, id: string): string | null {
  if (par.a_id === id) return par.b_id;
  if (par.b_id === id) return par.a_id;
  return null;
}

export interface EntradaHarmonizacao {
  grupos: readonly MenuGroup[];
  prato: Dish;
  paresPrato: readonly ParPrato[];
  paresCategoria: readonly ParCategoria[];
  /** O que já está no pedido: não se oferece o que a mesa já separou. */
  pedido?: Readonly<Record<string, number>>;
  max?: number;
  agora?: Date;
}

export function harmonizacoes({
  grupos, prato, paresPrato, paresCategoria, pedido = {}, max = 3, agora = new Date(),
}: EntradaHarmonizacao): Harmonizacao[] {
  const porId = new Map<string, { prato: Dish; categoria: string }>();
  for (const g of grupos) {
    for (const p of g.pratos) porId.set(p.id, { prato: p, categoria: g.categoria.nome });
  }

  /**
   * Os mesmos quatro cortes da sugestão de fechamento, pelos mesmos motivos:
   * sem foto não dá vontade, sem preço ninguém aceita, esgotado irrita, e o que
   * já está no pedido é ruído. Mais um aqui: nunca o próprio prato.
   */
  const serve = (p: Dish) =>
    p.id !== prato.id
    && (pedido[p.id] ?? 0) === 0
    && !estaEsgotado(p, agora)
    && temMidia(p)
    && hasPrice(p);

  const saida: Harmonizacao[] = [];
  const dentro = new Set<string>();

  const juntar = (p: Dish, motivo: string, nota: string) => {
    if (dentro.has(p.id) || !serve(p)) return;
    dentro.add(p.id);
    saida.push({ prato: p, motivo, nota });
  };

  // 1. O que o dono casou prato a prato.
  const explicitos = [...paresPrato].sort((x, y) => x.ordem - y.ordem || x.id.localeCompare(y.id));
  for (const par of explicitos) {
    const outroId = oOutro(par, prato.id);
    if (!outroId) continue;
    const achado = porId.get(outroId);
    // Fora do cardápio público (desativado, ou de outra casa): não existe aqui.
    if (!achado) continue;
    juntar(achado.prato, achado.categoria, par.nota);
  }
  if (saida.length >= max) return saida.slice(0, max);

  // 2. As categorias que o dono casou, na ordem do cardápio. Dentro de cada
  //    uma, o que ele destacou vem na frente — o resto segue a ordem dele.
  const minhaCat = prato.category_id;
  if (minhaCat) {
    const casadas = new Set<string>();
    for (const par of paresCategoria) {
      const outra = oOutro(par, minhaCat);
      if (outra) casadas.add(outra);
    }
    for (const g of grupos) {
      if (!casadas.has(g.categoria.id)) continue;
      // `!dentro.has` antes de escolher, não depois: se o destaque da categoria
      // já entrou pelo par exato, a categoria oferece o próximo — e não fica
      // sem oferecer nada, que foi o que o teste pegou.
      const candidatos = g.pratos.filter((p) => serve(p) && !dentro.has(p.id));
      const escolhido = candidatos.find((p) => p.destaque) ?? candidatos[0];
      if (escolhido) juntar(escolhido, g.categoria.nome, "");
      if (saida.length >= max) break;
    }
  }

  return saida.slice(0, max);
}

/** Pares de prato que tocam este prato — para o painel listar e apagar. */
export function paresDoPrato(pares: readonly ParPrato[], dishId: string): ParPrato[] {
  return pares.filter((p) => p.a_id === dishId || p.b_id === dishId);
}

/**
 * Normaliza o par antes de gravar: o banco exige a_id < b_id para que o mesmo
 * par nunca entre duas vezes, uma em cada ordem. Devolve null para par inválido
 * (mesmo item dos dois lados), que é o que o `check` recusaria no banco.
 */
export function normalizarPar(x: string, y: string): { a_id: string; b_id: string } | null {
  if (!x || !y || x === y) return null;
  return x < y ? { a_id: x, b_id: y } : { a_id: y, b_id: x };
}

/** As categorias casadas com esta, para a tela do dono marcar os botões. */
export function casadasCom(pares: readonly ParCategoria[], categoryId: string): Set<string> {
  const out = new Set<string>();
  for (const par of pares) {
    const outra = oOutro(par, categoryId);
    if (outra) out.add(outra);
  }
  return out;
}
