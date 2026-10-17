import { describe, expect, it } from "vitest";
import { resultadosDemo, type CatalogoDemo } from "../src/demo";
import { oportunidades, resumoEscrito } from "../src/oportunidades";
import { taxaInteresse } from "../src/resultados";
import { harmonizacoes } from "../src/harmonizacao";
import { categoria, midia, prato } from "./fixtures";
import type { MenuGroup } from "../src/types";

/** Um cardápio parecido com o do piloto: categorias, vídeo em alguns, foto em
 *  outros, um item sem mídia nenhuma. */
function catalogo(): CatalogoDemo {
  const comVideo = (id: string, nome: string, cat: string, ordem: number) =>
    prato({
      id, nome, category_id: cat, ordem, preco_min_centavos: 4500,
      midias: [midia({ id: `${id}-v`, dish_id: id, tipo: "video", duracao_s: 12 })],
    });
  const comFoto = (id: string, nome: string, cat: string, ordem: number) =>
    prato({
      id, nome, category_id: cat, ordem, preco_min_centavos: 3200,
      midias: [midia({ id: `${id}-f`, dish_id: id })],
    });

  const grupos: MenuGroup[] = [
    {
      categoria: categoria({ id: "c-entradas", nome: "Entradas", ordem: 0 }),
      pratos: [
        comVideo("d-panceta", "Panceta do Gula", "c-entradas", 0),
        comFoto("d-dadinho", "Dadinho de Tapioca", "c-entradas", 1),
        // Sem mídia: o cardápio do cliente não o mostra.
        prato({ id: "d-pao", nome: "Pão de Alho", category_id: "c-entradas", ordem: 2, midias: [] }),
      ],
    },
    {
      categoria: categoria({ id: "c-pratos", nome: "Pratos Especiais", ordem: 1 }),
      pratos: [
        comVideo("d-picanha", "Picanha na Chapa", "c-pratos", 0),
        comFoto("d-risoto", "Risoto Terra e Mar", "c-pratos", 1),
      ],
    },
    {
      categoria: categoria({ id: "c-drinks", nome: "Drinks", ordem: 2 }),
      pratos: [
        comVideo("d-caipira", "Caipirinha da Casa", "c-drinks", 0),
        comFoto("d-gin", "Gin Tônica de Pêssego", "c-drinks", 1),
      ],
    },
  ];

  return {
    restaurantId: "r-gula",
    grupos,
    paresPrato: [{ a_id: "d-picanha", b_id: "d-caipira", nota: "O limão corta a gordura.", ordem: 0 }] as never,
    paresCategoria: [{ a_id: "c-pratos", b_id: "c-drinks", ordem: 0 }] as never,
    harmonizacao: { modo: "misto", max: 1 },
  };
}

const HOJE = new Date("2026-10-16T21:00:00-03:00");

describe("modo demonstração — o acaso tem semente fixa", () => {
  it("duas chamadas iguais devolvem exatamente os mesmos números", () => {
    const a = resultadosDemo(catalogo(), 30, HOJE);
    const b = resultadosDemo(catalogo(), 30, HOJE);
    expect(b).toEqual(a);
  });

  it("a janela de 30 dias é o FIM da de 90, não outra invenção", () => {
    const noventa = resultadosDemo(catalogo(), 90, HOJE);
    const trinta = resultadosDemo(catalogo(), 30, HOJE);
    const ultimos30 = noventa.serie.slice(-30);
    expect(trinta.serie).toEqual(ultimos30);
    // E o somatório bate com o recorte, não com um número solto.
    const visitasDoRecorte = ultimos30.reduce((s, d) => s + d.visitas, 0);
    expect(trinta.resumo.visitas).toBe(visitasDoRecorte);
  });

  it("7 dias também é o fim da mesma série", () => {
    const sete = resultadosDemo(catalogo(), 7, HOJE);
    const noventa = resultadosDemo(catalogo(), 90, HOJE);
    expect(sete.serie).toEqual(noventa.serie.slice(-7));
  });

  it("o período anterior é a janela de mesma largura logo antes", () => {
    const r = resultadosDemo(catalogo(), 7, HOJE);
    expect(r.serie).toHaveLength(7);
    // Com a casa crescendo devagar, o período anterior é menor — mas existe.
    expect(r.anterior.visitas).toBeGreaterThan(0);
    expect(r.anterior.visitas).toBeLessThan(r.resumo.visitas * 1.5);
  });
});

describe("modo demonstração — os números têm de ser críveis", () => {
  const r = resultadosDemo(catalogo(), 30, HOJE);

  it("gera movimento de verdade em 30 dias", () => {
    expect(r.resumo.visitas).toBeGreaterThan(500);
    expect(r.resumo.pratos_vistos).toBeGreaterThan(r.resumo.visitas);
    expect(r.resumo.quero).toBeGreaterThan(0);
  });

  it("ninguém toca em “Quero esse” sem ter visto o prato", () => {
    for (const p of r.pratos) expect(p.quis).toBeLessThanOrEqual(p.vistas);
  });

  it("a taxa de interesse fica numa faixa que um dono reconhece", () => {
    const taxa = taxaInteresse(r.resumo.pratos_vistos, r.resumo.quero);
    expect(taxa).toBeGreaterThan(5);
    expect(taxa).toBeLessThan(40);
  });

  it("espalha o desempenho: tem prato muito acima e prato muito abaixo", () => {
    const vistas = r.pratos.map((p) => p.vistas).sort((a, b) => b - a);
    expect(vistas[0]!).toBeGreaterThan(vistas[vistas.length - 1]! * 3);
  });

  it("prato sem foto nem vídeo É visto — e quase ninguém o quer", () => {
    // A fila dos stories é a categoria inteira: o prato sem mídia aparece com
    // o aviso "Ainda sem foto nem vídeo". O defeito dele não é invisibilidade,
    // é não converter — e é isso que a tela precisa mostrar.
    const pao = r.pratos.find((p) => p.dish_id === "d-pao")!;
    const picanha = r.pratos.find((p) => p.dish_id === "d-picanha")!;
    expect(pao.vistas).toBeGreaterThan(0);
    expect(pao.vistas).toBeGreaterThan(picanha.vistas * 0.1);
    expect(taxaInteresse(pao.vistas, pao.quis)).toBeLessThan(6);
    expect(taxaInteresse(pao.vistas, pao.quis))
      .toBeLessThan(taxaInteresse(picanha.vistas, picanha.quis) / 3);
  });

  it("fim de semana tem mais movimento que segunda-feira", () => {
    const noventa = resultadosDemo(catalogo(), 90, HOJE);
    const media = (d: number) => {
      const dias = noventa.serie.filter((x) => new Date(`${x.dia}T12:00:00Z`).getUTCDay() === d);
      return dias.reduce((s, x) => s + x.visitas, 0) / dias.length;
    };
    expect(media(6)).toBeGreaterThan(media(1)); // sábado > segunda
  });

  it("só harmoniza quem a casa configurou — e o par existe no cardápio", () => {
    const ids = new Set(catalogo().grupos.flatMap((g) => g.pratos.map((p) => p.id)));
    expect(r.pares.length).toBeGreaterThan(0);
    for (const par of r.pares) {
      expect(ids.has(par.dish_id)).toBe(true);
      expect(ids.has(par.alvo_id)).toBe(true);
      expect(par.dish_id).not.toBe(par.alvo_id);
      expect(par.cliques).toBeLessThanOrEqual(par.exibicoes);
    }
  });

  it("usa os pratos REAIS do catálogo, não inventa item nenhum", () => {
    const ids = new Set(catalogo().grupos.flatMap((g) => g.pratos.map((p) => p.id)));
    expect(r.pratos).toHaveLength(ids.size);
    for (const p of r.pratos) expect(ids.has(p.dish_id)).toBe(true);
  });

  it("vem marcado como demonstração", () => {
    expect(r.demo).toBe(true);
  });
});

describe("oportunidades", () => {
  const cat = catalogo();
  const r = resultadosDemo(cat, 30, HOJE);
  const paresExibidos = new Map(
    cat.grupos.flatMap((g) => g.pratos).map((p) => [
      p.id,
      harmonizacoes({
        grupos: cat.grupos, prato: p,
        paresPrato: cat.paresPrato as never, paresCategoria: cat.paresCategoria as never,
        modo: cat.harmonizacao.modo, max: cat.harmonizacao.max,
      }).map((h) => h.prato.id),
    ]),
  );
  const ops = oportunidades({ resultados: r, grupos: cat.grupos, paresExibidos });

  it("gera recomendações a partir dos dados", () => {
    expect(ops.length).toBeGreaterThan(0);
  });

  it("cada uma aponta para um prato que existe e traz os números", () => {
    const ids = new Set(cat.grupos.flatMap((g) => g.pratos.map((p) => p.id)));
    for (const o of ops) {
      expect(ids.has(o.dishId)).toBe(true);
      expect(o.dados).toMatch(/\d/);
      expect(o.acao.length).toBeGreaterThan(10);
      expect(o.destino.href).toMatch(/^\//);
    }
  });

  it("não repete o mesmo prato em duas recomendações", () => {
    const vistos = ops.filter((o) => o.tipo !== "par_promissor").map((o) => o.dishId);
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it("não promete venda nem faturamento — o cardápio não mede isso", () => {
    const texto = ops.map((o) => `${o.titulo} ${o.porque} ${o.acao} ${o.dados}`).join(" ").toLowerCase();
    expect(texto).not.toMatch(/faturamento|aumentou as vendas|vendeu mais|receita/);
  });

  it("o prato sem vídeo mas com atenção vira teste de vídeo", () => {
    const r2 = resultadosDemo(cat, 90, HOJE);
    const todas = oportunidades({ resultados: r2, grupos: cat.grupos, paresExibidos, max: 20 });
    const semVideo = todas.filter((o) => o.tipo === "sem_video");
    for (const o of semVideo) {
      const p = cat.grupos.flatMap((g) => g.pratos).find((x) => x.id === o.dishId)!;
      expect(p.midias.some((m) => m.tipo === "video")).toBe(false);
    }
  });

  it("o resumo escrito cita números e não fala em venda", () => {
    const texto = resumoEscrito({ resultados: r, grupos: cat.grupos, oportunidades: ops });
    expect(texto).toMatch(/\d/);
    expect(texto.toLowerCase()).not.toMatch(/faturamento|venda/);
    expect(texto).toContain("30 dias");
  });

  it("sem movimento, o resumo diz isso em vez de inventar", () => {
    const vazio = {
      ...r,
      resumo: { ...r.resumo, visitas: 0, pratos_vistos: 0 },
      pratos: r.pratos.map((p) => ({ ...p, vistas: 0, quis: 0 })),
    };
    const texto = resumoEscrito({ resultados: vazio, grupos: cat.grupos, oportunidades: [] });
    expect(texto).toContain("não registrou movimento");
  });
});
