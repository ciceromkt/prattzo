/** Formato das linhas como vêm do Postgres. */

export interface RestaurantRow {
  id: string;
  owner_id: string;
  nome: string;
  slug: string;
  descricao: string;
  logo_url: string | null;
  logo_escuro: boolean;
  video_capa_url: string | null;
  horario_texto: string;
  /** jsonb: validar com `lerExpedientes` antes de usar. */
  horarios: unknown;
  fuso: string;
  link_google: string | null;
  harmonizacao_modo: string | null;
  harmonizacao_max: number | null;
  publicado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface CategoryRow {
  id: string;
  restaurant_id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  capa_url: string | null;
  criado_em: string;
}

export interface DishRow {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  nome: string;
  descricao: string;
  preco_min_centavos: number;
  preco_max_centavos: number | null;
  ordem: number;
  ativo: boolean;
  esgotado_ate: string | null;
  destaque: boolean;
  versao: number;
  ingredientes: string[] | null;
  serve: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Par de harmonização. Guardado sem direção: a_id é sempre o menor dos ids. */
export interface ParPratoRow {
  id: string;
  restaurant_id: string;
  a_id: string;
  b_id: string;
  nota: string;
  ordem: number;
}

export interface ParCategoriaRow {
  id: string;
  restaurant_id: string;
  a_id: string;
  b_id: string;
}

export interface MediaRow {
  id: string;
  dish_id: string;
  restaurant_id: string;
  tipo: "foto" | "video";
  url: string;
  poster_url: string | null;
  duracao_s: number | null;
  ordem: number;
  criado_em: string;
}

export type EventType =
  | "abriu_cardapio"
  | "abriu_categoria"
  | "viu_prato"
  | "terminou_video"
  | "adicionou_pedido"
  | "fechou_pedido"
  | "compartilhou"
  | "viu_sugestao"
  | "aceitou_sugestao";

export interface AtencaoRow {
  dish_id: string;
  restaurant_id: string;
  nome: string;
  vistas: number;
  terminou: number;
  quis: number;
  ms_medio: number | null;
}

export interface ResumoRow {
  restaurant_id: string;
  clientes: number;
  pratos_vistos: number;
  adicoes: number;
  pedidos_fechados: number;
  compartilhamentos: number;
  sugestoes_vistas: number;
  sugestoes_aceitas: number;
}
