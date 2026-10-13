/**
 * Preço. O cardápio do Gula tem itens de valor único ("R$ 59,00") e itens com
 * faixa ("R$ 126,80 até R$ 164,90", porque muda com o tamanho). Os dois casos
 * moram aqui, e item sem preço é dito em voz alta em vez de virar "R$ 0,00".
 */

export const SEM_PRECO = "Preço a confirmar";

export function formatCents(cents: number): string {
  const v = Math.max(0, Math.round(cents)) / 100;
  return `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d)\,)/g, ".")}`;
}

/** Converte "32,90", "R$ 1.400,00" ou "32.90" em centavos. null se inválido. */
export function parsePriceToCents(input: string): number | null {
  const clean = String(input).replace(/[^\d,.]/g, "").trim();
  if (!clean) return null;
  // Com vírgula, o ponto é separador de milhar. Sem vírgula, o ponto é decimal.
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export interface PriceLike {
  preco_min_centavos: number;
  preco_max_centavos?: number | null;
}

export function hasPrice(d: PriceLike): boolean {
  return d.preco_min_centavos > 0;
}

export function isRange(d: PriceLike): boolean {
  return hasPrice(d) && typeof d.preco_max_centavos === "number" && d.preco_max_centavos > d.preco_min_centavos;
}

/** O que o cliente lê na lista e no vídeo. */
export function priceLabel(d: PriceLike): string {
  if (!hasPrice(d)) return SEM_PRECO;
  if (isRange(d)) return `${formatCents(d.preco_min_centavos)} até ${formatCents(d.preco_max_centavos as number)}`;
  return formatCents(d.preco_min_centavos);
}

export interface OrderTotal {
  centavos: number;
  /** Algum item tem faixa de preço, então o total é um piso. */
  aproximado: boolean;
}

/**
 * Soma pelo valor base. Nunca pelo teto: o cliente não pode receber uma conta
 * menor do que a tela mostrou, mas pode receber uma maior do que o piso — e aí
 * `aproximado` manda a tela dizer "a partir de".
 */
export function orderTotal(linhas: ReadonlyArray<{ dish: PriceLike; quantidade: number }>): OrderTotal {
  let centavos = 0;
  let aproximado = false;
  for (const { dish, quantidade } of linhas) {
    if (quantidade <= 0) continue;
    centavos += dish.preco_min_centavos * quantidade;
    if (isRange(dish)) aproximado = true;
  }
  return { centavos, aproximado };
}
