import { describe, expect, it } from "vitest";
import {
  capaDaCategoria, capaDoPrato, diagnosticar, esgotadoAte, estaEsgotado,
  filaDeStories, montarGrupos, opcoesDeCapa, ordenar, proximaOrdem, reordenar,
  sugestoesParaPedido, videoDoPrato,
} from "../src/menu";
import type { Dish } from "../src/types";
import { categoria, midia, prato } from "./fixtures";

describe("esgotado", () => {
  it("vale até as 6h do dia seguinte quando marcado à noite", () => {
    const ate = esgotadoAte(new Date("2026-10-12T23:00:00"));
    expect(ate.getDate()).toBe(13);
    expect(ate.getHours()).toBe(6);
  });

  it("vale até as 6h de hoje quando marcado de madrugada", () => {
    const ate = esgotadoAte(new Date("2026-10-13T02:00:00"));
    expect(ate.getDate()).toBe(13);
  });

  it("volta sozinho depois do prazo — ninguém precisa lembrar de desmarcar", () => {
    const agora = new Date("2026-10-13T19:00:00");
    expect(estaEsgotado({ esgotado_ate: "2026-10-13T06:00:00" }, agora)).toBe(false);
    expect(estaEsgotado({ esgotado_ate: "2026-10-14T06:00:00" }, agora)).toBe(true);
    expect(estaEsgotado({ esgotado_ate: null }, agora)).toBe(false);
  });
});

describe("ordem", () => {
  it("ordena por posição e desempata pelo nome em português", () => {
    const itens = [
      { id: "a", ordem: 1, nome: "Água" },
      { id: "b", ordem: 0, nome: "Zabaione" },
      { id: "c", ordem: 1, nome: "Açaí" },
    ];
    expect(ordenar(itens).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("proximaOrdem joga o novo para o fim", () => {
    expect(proximaOrdem([{ ordem: 0 }, { ordem: 4 }])).toBe(5);
    expect(proximaOrdem([])).toBe(1);
  });

  it("reordenar troca o item com o vizinho", () => {
    const itens = [
      { id: "a", ordem: 0, nome: "A" },
      { id: "b", ordem: 1, nome: "B" },
      { id: "c", ordem: 2, nome: "C" },
    ];
    expect(reordenar(itens, "c", "cima")).toEqual([{ id: "c", ordem: 1 }, { id: "b", ordem: 2 }]);
    expect(reordenar(itens, "a", "cima")).toEqual([]);
    expect(reordenar(itens, "c", "baixo")).toEqual([]);
  });

  it("reordenar funciona mesmo com ordens repetidas vindas do banco", () => {
    const itens = [
      { id: "a", ordem: 0, nome: "A" },
      { id: "b", ordem: 0, nome: "B" },
    ];
    expect(reordenar(itens, "b", "cima")).toEqual([{ id: "b", ordem: 0 }, { id: "a", ordem: 1 }]);
  });
});

describe("capas", () => {
  it("prefere o quadro do vídeo à foto", () => {
    const p = prato({
      midias: [
        midia({ id: "m1", tipo: "foto", url: "f.jpg", ordem: 1 }),
        midia({ id: "m2", tipo: "video", url: "v.mp4", poster_url: "v.jpg", ordem: 0 }),
      ],
    });
    expect(capaDoPrato(p)).toBe("v.jpg");
    expect(videoDoPrato(p)?.url).toBe("v.mp4");
  });

  it("cai para a foto quando não há vídeo", () => {
    expect(capaDoPrato(prato({ midias: [midia({ url: "f.jpg" })] }))).toBe("f.jpg");
    expect(capaDoPrato(prato({ midias: [] }))).toBeNull();
  });

  it("a escolha do dono vence a sugestão automática", () => {
    const grupo = {
      categoria: categoria({ capa_url: "escolhida.jpg" }),
      pratos: [prato({ midias: [midia({ url: "primeira.jpg" })] })],
    };
    expect(capaDaCategoria(grupo)).toBe("escolhida.jpg");
    expect(capaDaCategoria({ ...grupo, categoria: categoria() })).toBe("primeira.jpg");
  });

  it("lista cada imagem uma vez só como opção de capa", () => {
    const grupo = {
      categoria: categoria(),
      pratos: [
        prato({ id: "d1", nome: "Panceta", midias: [midia({ url: "a.jpg" }), midia({ id: "m2", url: "a.jpg" })] }),
        prato({ id: "d2", nome: "Coxinha", midias: [midia({ id: "m3", url: "b.jpg" })] }),
      ],
    };
    expect(opcoesDeCapa(grupo).map((o) => o.url)).toEqual(["a.jpg", "b.jpg"]);
  });
});

describe("montarGrupos", () => {
  const cats = [categoria({ id: "c2", nome: "Comidas", ordem: 1 }), categoria({ id: "c1", nome: "Entradas", ordem: 0 })];

  it("agrupa e ordena categorias e pratos", () => {
    const pratos = [
      prato({ id: "d2", category_id: "c1", nome: "Coxinha", ordem: 1 }),
      prato({ id: "d1", category_id: "c1", nome: "Panceta", ordem: 0 }),
      prato({ id: "d3", category_id: "c2", nome: "Picanha", ordem: 0 }),
    ];
    const g = montarGrupos(cats, pratos);
    expect(g.map((x) => x.categoria.nome)).toEqual(["Entradas", "Comidas"]);
    expect(g[0]!.pratos.map((p) => p.id)).toEqual(["d1", "d2"]);
    expect(filaDeStories(g).map((p) => p.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("esconde do cliente o item e a categoria desativados", () => {
    const pratos = [prato({ id: "d1", category_id: "c1" }), prato({ id: "d2", category_id: "c1", ativo: false })];
    expect(montarGrupos(cats, pratos)[0]!.pratos.map((p) => p.id)).toEqual(["d1"]);
    expect(montarGrupos(cats, pratos, false)[0]!.pratos).toHaveLength(2);
  });

  it("some com categoria vazia no cliente, mas mostra no painel", () => {
    expect(montarGrupos(cats, [prato({ category_id: "c1" })]).map((g) => g.categoria.nome)).toEqual(["Entradas"]);
    expect(montarGrupos(cats, [prato({ category_id: "c1" })], false)).toHaveLength(2);
  });

  it("recolhe prato sem categoria em Outros, no fim", () => {
    const g = montarGrupos(cats, [prato({ id: "d9", category_id: null })]);
    expect(g[g.length - 1]!.categoria.nome).toBe("Outros");
  });
});

describe("diagnosticar", () => {
  it("conta exatamente o que falta cadastrar", () => {
    const grupos = montarGrupos(
      [categoria({ id: "c1", nome: "Entradas" })],
      [
        prato({ id: "d1", midias: [midia({ tipo: "video", url: "v.mp4", poster_url: "v.jpg" })] }),
        prato({ id: "d2", nome: "Sem preço", preco_min_centavos: 0, midias: [midia()] }),
        prato({ id: "d3", nome: "Curta", descricao: "Gostoso.", midias: [] }),
      ],
    );
    const d = diagnosticar(grupos);
    expect(d.totalItens).toBe(3);
    expect(d.comMidia).toBe(2);
    expect(d.comVideo).toBe(1);
    expect(d.semPreco).toBe(1);
    expect(d.descricaoCurta).toBe(1);
    // Ordem igual desempata pelo nome, então "Curta" vem antes de "Sem preço".
    expect(d.pendencias.map((p) => p.nome)).toEqual(["Curta", "Sem preço"]);
    expect(d.pendencias[0]!.faltas).toEqual(["descrição curta", "sem foto nem vídeo"]);
    expect(d.pendencias[1]!.faltas).toEqual(["sem preço"]);
  });

  it("aponta categoria sem capa possível", () => {
    const grupos = montarGrupos([categoria({ nome: "Caipirinhas" })], [prato({ midias: [] })]);
    expect(diagnosticar(grupos).categoriasSemCapa).toEqual(["Caipirinhas"]);
  });

  it("não acusa item completo", () => {
    const grupos = montarGrupos([categoria()], [prato({ midias: [midia()] })]);
    expect(diagnosticar(grupos).pendencias).toEqual([]);
  });
});

describe("sugestoesParaPedido", () => {
  const cardapio = (over: Record<string, Partial<Dish>[]> = {}) =>
    montarGrupos(
      [
        categoria({ id: "c1", nome: "Comidas", ordem: 0 }),
        categoria({ id: "c2", nome: "Drinks", ordem: 1 }),
        categoria({ id: "c3", nome: "Sobremesas", ordem: 2 }),
      ],
      [
        prato({ id: "comida1", category_id: "c1", nome: "Picanha", midias: [midia()], ...(over.comida1?.[0] ?? {}) }),
        prato({ id: "comida2", category_id: "c1", nome: "Peixe", midias: [midia()] }),
        prato({ id: "drink1", category_id: "c2", nome: "Caipirinha", midias: [midia()], ...(over.drink1?.[0] ?? {}) }),
        prato({ id: "doce1", category_id: "c3", nome: "Pudim", midias: [midia()], ...(over.doce1?.[0] ?? {}) }),
      ],
    );

  it("oferece o que falta na mesa, não mais do mesmo", () => {
    const s = sugestoesParaPedido(cardapio(), { comida1: 1 });
    expect(s.map((x) => x.prato.id)).toEqual(["drink1", "doce1"]);
    expect(s[0]!.motivo).toBe("Drinks");
  });

  it("não repete item que já está no pedido", () => {
    const s = sugestoesParaPedido(cardapio(), { comida1: 1, drink1: 2 });
    expect(s.map((x) => x.prato.id)).toEqual(["doce1"]);
  });

  it("não oferece item esgotado — pior que não oferecer", () => {
    const amanha = new Date(Date.now() + 3600_000).toISOString();
    const s = sugestoesParaPedido(cardapio({ drink1: [{ esgotado_ate: amanha }] }), { comida1: 1 });
    expect(s.map((x) => x.prato.id)).toEqual(["doce1"]);
  });

  it("não oferece item sem imagem — sem foto não dá vontade", () => {
    const s = sugestoesParaPedido(cardapio({ drink1: [{ midias: [] }] }), { comida1: 1 });
    expect(s.map((x) => x.prato.id)).toEqual(["doce1"]);
  });

  it("não oferece item sem preço — ninguém aceita o que não sabe quanto custa", () => {
    const s = sugestoesParaPedido(cardapio({ drink1: [{ preco_min_centavos: 0 }] }), { comida1: 1 });
    expect(s.map((x) => x.prato.id)).toEqual(["doce1"]);
  });

  it("o destaque do dono passa à frente dentro da categoria dele", () => {
    const grupos = montarGrupos(
      [categoria({ id: "c1", nome: "Drinks" })],
      [
        prato({ id: "a", category_id: "c1", nome: "A", ordem: 0, midias: [midia()] }),
        prato({ id: "b", category_id: "c1", nome: "B", ordem: 1, midias: [midia()], destaque: true }),
      ],
    );
    expect(sugestoesParaPedido(grupos, {})[0]!.prato.id).toBe("b");
  });

  it("respeita o teto pedido", () => {
    expect(sugestoesParaPedido(cardapio(), {}, 2)).toHaveLength(2);
  });

  it("não sugere nada quando o cliente já passou por todas as categorias", () => {
    expect(sugestoesParaPedido(cardapio(), { comida1: 1, drink1: 1, doce1: 1 })).toEqual([]);
  });
});

describe("esgotadoAte no fuso do restaurante", () => {
  // O servidor da Vercel roda em UTC. Estes testes fixam o cenário real:
  // o gerente marca "acabou" às 22h em São Paulo, que já é o dia seguinte em UTC.
  const emSaoPaulo = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d);

  it("volta às 6h do dia seguinte NO FUSO DO RESTAURANTE, não no do servidor", () => {
    const marcou = new Date("2026-10-13T22:00:00-03:00");
    expect(emSaoPaulo(esgotadoAte(marcou, "America/Sao_Paulo"))).toBe("14/10, 06:00");
  });

  it("continua esgotado durante a madrugada, com o salão aberto", () => {
    const ate = esgotadoAte(new Date("2026-10-13T22:00:00-03:00"), "America/Sao_Paulo").toISOString();
    // 00h30 e 03h de São Paulo: o rooftop fecha às 2h, e 3h era quando o bug devolvia o item.
    expect(estaEsgotado({ esgotado_ate: ate }, new Date("2026-10-14T00:30:00-03:00"))).toBe(true);
    expect(estaEsgotado({ esgotado_ate: ate }, new Date("2026-10-14T03:00:00-03:00"))).toBe(true);
    // Às 7h já é outro serviço: o item volta.
    expect(estaEsgotado({ esgotado_ate: ate }, new Date("2026-10-14T07:00:00-03:00"))).toBe(false);
  });

  it("marcado de madrugada, antes das 6h, vale só até as 6h do mesmo dia", () => {
    const marcou = new Date("2026-10-14T01:30:00-03:00");
    expect(emSaoPaulo(esgotadoAte(marcou, "America/Sao_Paulo"))).toBe("14/10, 06:00");
  });

  it("funciona em outro fuso — o produto não é só de São Paulo", () => {
    const marcou = new Date("2026-10-13T22:00:00-03:00"); // 19h em Manaus
    const ate = esgotadoAte(marcou, "America/Manaus");
    const emManaus = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(ate);
    expect(emManaus).toBe("14/10, 06:00");
  });
});
