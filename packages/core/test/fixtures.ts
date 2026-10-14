import type { Category, Dish, MediaItem } from "../src/types";

export function midia(over: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "m1", dish_id: "d1", tipo: "foto", url: "https://cdn/f.jpg",
    poster_url: null, duracao_s: null, ordem: 0, ...over,
  };
}

export function prato(over: Partial<Dish> = {}): Dish {
  return {
    id: "d1", restaurant_id: "r1", category_id: "c1",
    nome: "Panceta do Gula",
    descricao: "Crocante por fora e macia por dentro, servida com limão e maionese verde.",
    preco_min_centavos: 5900, preco_max_centavos: null,
    ordem: 0, ativo: true, esgotado_ate: null, destaque: false, versao: 1,
    ingredientes: [], serve: "", midias: [], ...over,
  };
}

export function categoria(over: Partial<Category> = {}): Category {
  return { id: "c1", restaurant_id: "r1", nome: "Entradas", ordem: 0, ativa: true, capa_url: null, ...over };
}
