/** Formato das linhas como vêm do Postgres. */

export interface RestaurantRow {
  id: string;
  owner_id: string;
  nome: string;
  slug: string;
  descricao: string;
  logo_url: string | null;
  video_capa_url: string | null;
  horario_texto: string;
  fuso: string;
  link_google: string | null;
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
  criado_em: string;
  atualizado_em: string;
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
