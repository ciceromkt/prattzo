/**
 * Tipos do domínio. O produto é cardápio com vídeo e pedido montado pelo cliente:
 * não há recomendação, não há IA, não há restrição alimentar calculada por máquina.
 */

export type MediaKind = "foto" | "video";

export interface MediaItem {
  id: string;
  dish_id: string;
  tipo: MediaKind;
  url: string;
  /** Quadro de capa do vídeo. Para foto, é a própria url. */
  poster_url: string | null;
  duracao_s: number | null;
  ordem: number;
}

export interface Dish {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  nome: string;
  descricao: string;
  /** Preço base, em centavos. 0 = ainda não cadastrado. */
  preco_min_centavos: number;
  /** Teto da faixa ("R$ 23,00 até R$ 31,00"). null = preço único. */
  preco_max_centavos: number | null;
  ordem: number;
  ativo: boolean;
  /** Marcado como esgotado até este instante. Passou, volta sozinho. */
  esgotado_ate: string | null;
  /** O dono quer este item à frente na sugestão de fechamento. */
  destaque: boolean;
  /** Versão da linha: inteiro que o banco incrementa a cada alteração. */
  versao: number;
  midias: MediaItem[];
}

export interface Category {
  id: string;
  restaurant_id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  /** Capa escolhida pelo dono. null = o cardápio sugere a primeira mídia. */
  capa_url: string | null;
}

export interface Restaurant {
  id: string;
  owner_id: string;
  nome: string;
  slug: string;
  descricao: string;
  logo_url: string | null;
  video_capa_url: string | null;
  /** Frase livre no topo do cardápio. Fica abaixo do horário calculado. */
  horario_texto: string;
  /** Expedientes por dia da semana. Validar com `lerExpedientes` antes de usar. */
  horarios: unknown;
  /** Fuso IANA do salão, ex.: "America/Sao_Paulo". */
  fuso: string;
  link_google: string | null;
  publicado: boolean;
}

export interface MenuGroup {
  categoria: Category;
  pratos: Dish[];
}

/** Cardápio público, já ordenado e sem o que o cliente não deve ver. */
export interface PublicMenu {
  restaurant: Restaurant;
  grupos: MenuGroup[];
}

/** Uma linha do pedido que o cliente monta. */
export interface OrderLine {
  dish_id: string;
  nome: string;
  quantidade: number;
}
