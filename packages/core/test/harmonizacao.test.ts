import { describe, expect, it } from "vitest";
import { casadasCom, harmonizacoes, normalizarPar, paresDoPrato } from "../src/harmonizacao";
import type { MenuGroup, ParCategoria, ParPrato } from "../src/types";
import { categoria, midia, prato } from "./fixtures";

/** Ids crescentes de propósito: o par é guardado com a_id < b_id. */
const RISOTO = "d-risoto";
const DADINHO = "d-dadinho";
const CHARDONNAY = "d-vinho-chard";
const NEGRONI = "d-negroni";

const COMIDA = "c-1-comida";
const BEBIDA = "c-2-bebida";
const SOBREMESA = "c-3-sobremesa";

function comFoto(over: Parameters<typeof prato>[0] = {}) {
  return prato({ midias: [midia({ id: `m-${over.id ?? "x"}` })], ...over });
}

function cardapio(): MenuGroup[] {
  return [
    {
      categoria: categoria({ id: COMIDA, nome: "Pratos", ordem: 0 }),
      pratos: [
        comFoto({ id: RISOTO, category_id: COMIDA, nome: "Risoto Terra e Mar", ordem: 0 }),
        comFoto({ id: DADINHO, category_id: COMIDA, nome: "Dadinho de tapioca", ordem: 1 }),
      ],
    },
    {
      categoria: categoria({ id: BEBIDA, nome: "Drinks e vinhos", ordem: 1 }),
      pratos: [
        comFoto({ id: NEGRONI, category_id: BEBIDA, nome: "Negroni", ordem: 0 }),
        comFoto({ id: CHARDONNAY, category_id: BEBIDA, nome: "Chardonnay", ordem: 1, destaque: true }),
      ],
    },
  ];
}

const par = (a: string, b: string, nota = "", ordem = 0): ParPrato => ({
  id: `p-${a}-${b}`, a_id: a < b ? a : b, b_id: a < b ? b : a, nota, ordem,
});
const parCat = (a: string, b: string): ParCategoria => ({ id: `pc-${a}-${b}`, a_id: a, b_id: b });

function pedir(grupos: MenuGroup[], id: string, extra: Partial<Parameters<typeof harmonizacoes>[0]> = {}) {
  const alvo = grupos.flatMap((g) => g.pratos).find((p) => p.id === id)!;
  return harmonizacoes({ grupos, prato: alvo, paresPrato: [], paresCategoria: [], ...extra });
}

describe("par exato do dono", () => {
  it("o risoto sugere o vinho que o dono casou com ele, com a frase dele", () => {
    const r = pedir(cardapio(), RISOTO, {
      paresPrato: [par(RISOTO, CHARDONNAY, "A acidez corta a manteiga do risoto.")],
    });
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY]);
    expect(r[0]!.nota).toBe("A acidez corta a manteiga do risoto.");
    expect(r[0]!.motivo).toBe("Drinks e vinhos");
  });

  it("vale nos dois sentidos: abrindo o vinho, ele sugere o prato", () => {
    const pares = [par(RISOTO, CHARDONNAY, "A acidez corta a manteiga do risoto.")];
    const r = pedir(cardapio(), CHARDONNAY, { paresPrato: pares });
    expect(r.map((h) => h.prato.id)).toEqual([RISOTO]);
    expect(r[0]!.nota).toBe("A acidez corta a manteiga do risoto.");
  });

  it("respeita a ordem que o dono deu aos pares", () => {
    const r = pedir(cardapio(), RISOTO, {
      max: 2,
      paresPrato: [par(RISOTO, NEGRONI, "", 2), par(RISOTO, CHARDONNAY, "", 1)],
    });
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY, NEGRONI]);
  });

  it("par com item fora do cardápio público simplesmente não aparece", () => {
    const r = pedir(cardapio(), RISOTO, { paresPrato: [par(RISOTO, "d-nao-existe", "sumiu")] });
    expect(r).toEqual([]);
  });
});

describe("regra de categoria", () => {
  it("sem par exato, usa a categoria que o dono casou e prefere o destaque dele", () => {
    const r = pedir(cardapio(), DADINHO, { paresCategoria: [parCat(BEBIDA, COMIDA)] });
    // Chardonnay está marcado como destaque, embora venha depois do Negroni.
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY]);
    expect(r[0]!.nota).toBe("");
  });

  it("categoria não casada não entra — nada de oferecer sobremesa com drink por conta própria", () => {
    const grupos = cardapio();
    grupos.push({
      categoria: categoria({ id: SOBREMESA, nome: "Sobremesas", ordem: 2 }),
      pratos: [comFoto({ id: "d-pudim", category_id: SOBREMESA, nome: "Pudim", ordem: 0 })],
    });
    const r = pedir(grupos, DADINHO, { paresCategoria: [parCat(BEBIDA, COMIDA)] });
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY]);
  });

  it("par exato vem antes da categoria, e nada se repete", () => {
    const r = pedir(cardapio(), RISOTO, {
      paresPrato: [par(RISOTO, CHARDONNAY, "o par certo")],
      paresCategoria: [parCat(BEBIDA, COMIDA)],
      max: 3,
    });
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY, NEGRONI]);
    expect(r[0]!.nota).toBe("o par certo");
    expect(r[1]!.nota).toBe("");
  });

  it("prato sem categoria não ganha sugestão por regra", () => {
    const grupos = cardapio();
    grupos[0]!.pratos[1]!.category_id = null;
    const r = pedir(grupos, DADINHO, { paresCategoria: [parCat(BEBIDA, COMIDA)] });
    expect(r).toEqual([]);
  });
});

describe("o que nunca é oferecido", () => {
  it("o próprio prato, mesmo que o dono tenha casado a categoria com ela mesma", () => {
    const r = pedir(cardapio(), RISOTO, { paresCategoria: [parCat(BEBIDA, COMIDA), parCat(COMIDA, COMIDA)] });
    expect(r.every((h) => h.prato.id !== RISOTO)).toBe(true);
  });

  it("item esgotado — oferecer o que acabou é pior que não oferecer", () => {
    const grupos = cardapio();
    grupos[1]!.pratos[1]!.esgotado_ate = "2026-10-14T06:00:00Z";
    const r = pedir(grupos, RISOTO, {
      paresPrato: [par(RISOTO, CHARDONNAY, "x")],
      agora: new Date("2026-10-13T21:00:00Z"),
    });
    expect(r).toEqual([]);
  });

  it("item sem foto nem vídeo: sem imagem não dá vontade", () => {
    const grupos = cardapio();
    grupos[1]!.pratos[1]!.midias = [];
    const r = pedir(grupos, RISOTO, { paresPrato: [par(RISOTO, CHARDONNAY)] });
    expect(r).toEqual([]);
  });

  it("item sem preço: ninguém aceita o que não sabe quanto custa", () => {
    const grupos = cardapio();
    grupos[1]!.pratos[1]!.preco_min_centavos = 0;
    const r = pedir(grupos, RISOTO, { paresPrato: [par(RISOTO, CHARDONNAY)] });
    expect(r).toEqual([]);
  });

  it("o que já está no pedido — a mesa já separou", () => {
    const r = pedir(cardapio(), RISOTO, {
      paresPrato: [par(RISOTO, CHARDONNAY), par(RISOTO, NEGRONI, "", 1)],
      pedido: { [CHARDONNAY]: 2 },
    });
    expect(r.map((h) => h.prato.id)).toEqual([NEGRONI]);
  });

  it("nunca passa do máximo pedido", () => {
    const r = pedir(cardapio(), RISOTO, {
      paresPrato: [par(RISOTO, CHARDONNAY), par(RISOTO, NEGRONI, "", 1), par(RISOTO, DADINHO, "", 2)],
      max: 2,
    });
    expect(r).toHaveLength(2);
  });
});

describe("utilidades do painel", () => {
  it("normaliza o par para a ordem que o banco exige, venha como vier", () => {
    // "d-risoto" < "d-vinho-chard": o menor vai para a_id, venha em que ordem vier.
    expect(normalizarPar(CHARDONNAY, RISOTO)).toEqual({ a_id: RISOTO, b_id: CHARDONNAY });
    expect(normalizarPar(RISOTO, CHARDONNAY)).toEqual({ a_id: RISOTO, b_id: CHARDONNAY });
  });

  it("recusa par do item com ele mesmo e par incompleto", () => {
    expect(normalizarPar(RISOTO, RISOTO)).toBeNull();
    expect(normalizarPar("", RISOTO)).toBeNull();
  });

  it("lista os pares que tocam um prato, de qualquer lado", () => {
    const pares = [par(RISOTO, CHARDONNAY), par(DADINHO, NEGRONI)];
    expect(paresDoPrato(pares, RISOTO)).toHaveLength(1);
    expect(paresDoPrato(pares, NEGRONI)).toHaveLength(1);
  });

  it("devolve as categorias casadas com uma, para a tela marcar os botões", () => {
    const set = casadasCom([parCat(BEBIDA, COMIDA), parCat(BEBIDA, SOBREMESA)], BEBIDA);
    expect([...set].sort()).toEqual([COMIDA, SOBREMESA]);
    expect(casadasCom([parCat(BEBIDA, COMIDA)], SOBREMESA).size).toBe(0);
  });
});

describe("quem escolhe: o modo da casa", () => {
  it("curado: só o que o dono escreveu — prato sem par não sugere nada", () => {
    const comPar = pedir(cardapio(), RISOTO, {
      modo: "curado",
      paresPrato: [par(RISOTO, CHARDONNAY, "o par da casa")],
      paresCategoria: [parCat(BEBIDA, COMIDA)],
    });
    expect(comPar.map((h) => h.prato.id)).toEqual([CHARDONNAY]);

    const semPar = pedir(cardapio(), DADINHO, {
      modo: "curado",
      paresPrato: [par(RISOTO, CHARDONNAY)],
      paresCategoria: [parCat(BEBIDA, COMIDA)],
    });
    expect(semPar).toEqual([]);
  });

  it("automatico: só a regra de categoria — o par exato é ignorado", () => {
    const r = pedir(cardapio(), RISOTO, {
      modo: "automatico",
      max: 2,
      // O dono casou o risoto com o Negroni, mas pediu para o cardápio decidir:
      // vem o destaque da categoria (Chardonnay), não o par escrito.
      paresPrato: [par(RISOTO, NEGRONI, "ignorado neste modo")],
      paresCategoria: [parCat(BEBIDA, COMIDA)],
    });
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY]);
    expect(r[0]!.nota).toBe("");
  });

  it("misto é o padrão: par exato primeiro, categoria completando", () => {
    const r = pedir(cardapio(), RISOTO, {
      max: 2,
      paresPrato: [par(RISOTO, CHARDONNAY, "o par certo")],
      paresCategoria: [parCat(BEBIDA, COMIDA)],
    });
    expect(r.map((h) => h.prato.id)).toEqual([CHARDONNAY, NEGRONI]);
  });

  it("uma sugestão é o padrão", () => {
    const r = pedir(cardapio(), RISOTO, {
      paresPrato: [par(RISOTO, CHARDONNAY), par(RISOTO, NEGRONI, "", 1)],
    });
    expect(r).toHaveLength(1);
  });
});
