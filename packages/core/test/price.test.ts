import { describe, expect, it } from "vitest";
import { formatCents, hasPrice, isRange, orderTotal, parsePriceToCents, priceLabel, SEM_PRECO } from "../src/price";
import { prato } from "./fixtures";

describe("formatCents", () => {
  it("formata no padrão brasileiro", () => {
    expect(formatCents(5900)).toBe("R$ 59,00");
    expect(formatCents(0)).toBe("R$ 0,00");
  });

  it("separa o milhar", () => {
    expect(formatCents(140000)).toBe("R$ 1.400,00");
    expect(formatCents(1234567)).toBe("R$ 12.345,67");
  });
});

describe("parsePriceToCents", () => {
  it("aceita o que o dono digita de verdade", () => {
    expect(parsePriceToCents("59,00")).toBe(5900);
    expect(parsePriceToCents("R$ 126,80")).toBe(12680);
    expect(parsePriceToCents("1.400,00")).toBe(140000);
    expect(parsePriceToCents("32.90")).toBe(3290);
  });

  it("rejeita o que não é preço", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("abc")).toBeNull();
  });
});

describe("priceLabel", () => {
  it("diz em voz alta quando falta preço, em vez de mostrar R$ 0,00", () => {
    expect(priceLabel(prato({ preco_min_centavos: 0 }))).toBe(SEM_PRECO);
    expect(hasPrice(prato({ preco_min_centavos: 0 }))).toBe(false);
  });

  it("mostra faixa quando o teto é maior", () => {
    const p = prato({ preco_min_centavos: 12680, preco_max_centavos: 16490 });
    expect(isRange(p)).toBe(true);
    expect(priceLabel(p)).toBe("R$ 126,80 até R$ 164,90");
  });

  it("ignora teto igual ou menor que o piso", () => {
    expect(priceLabel(prato({ preco_min_centavos: 5900, preco_max_centavos: 5900 }))).toBe("R$ 59,00");
  });
});

describe("orderTotal", () => {
  it("soma pelo valor base e multiplica pela quantidade", () => {
    const t = orderTotal([
      { dish: prato({ preco_min_centavos: 5900 }), quantidade: 2 },
      { dish: prato({ preco_min_centavos: 3200 }), quantidade: 1 },
    ]);
    expect(t.centavos).toBe(15000);
    expect(t.aproximado).toBe(false);
  });

  it("marca aproximado quando algum item tem faixa — o total é piso, nunca teto", () => {
    const t = orderTotal([
      { dish: prato({ preco_min_centavos: 12680, preco_max_centavos: 16490 }), quantidade: 1 },
    ]);
    expect(t.centavos).toBe(12680);
    expect(t.aproximado).toBe(true);
  });

  it("não conta linha zerada", () => {
    expect(orderTotal([{ dish: prato(), quantidade: 0 }]).centavos).toBe(0);
  });
});
