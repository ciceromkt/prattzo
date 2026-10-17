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
  /** O que vem nele, um por posição. Vazio = o dono ainda não cadastrou. */
  ingredientes: string[];
  /** "Serve 2 pessoas", "350 ml". Texto livre: cada casa mede do seu jeito. */
  serve: string;
  midias: MediaItem[];
}

/**
 * Par de harmonização, guardado sem direção: `a_id` é sempre o menor dos dois
 * ids. Uma linha responde "o que bebo com o risoto" e "o que como com o
 * vinho" — o dono cadastra uma vez só.
 */
export interface ParPrato {
  id: string;
  a_id: string;
  b_id: string;
  /** A frase do dono. Aparece na tela do cliente, nos dois sentidos. */
  nota: string;
  ordem: number;
}

export interface ParCategoria {
  id: string;
  a_id: string;
  b_id: string;
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
  /** Arte escura demais para a capa: a tela põe uma placa clara atrás. */
  logo_escuro: boolean;
  video_capa_url: string | null;
  /** Frase livre no topo do cardápio. Fica abaixo do horário calculado. */
  horario_texto: string;
  /** Expedientes por dia da semana. Validar com `lerExpedientes` antes de usar. */
  horarios: unknown;
  /** Fuso IANA do salão, ex.: "America/Sao_Paulo". */
  fuso: string;
  link_google: string | null;
  /** Quem escolhe o que harmoniza com o quê. Ver `harmonizacoes`. */
  harmonizacao_modo: ModoHarmonizacao;
  /** Quantas sugestões aparecem dentro do prato: 1 ou 2. */
  harmonizacao_max: number;
  /** Cartão com foto, ou só a frase. Decide também se o par precisa de mídia. */
  harmonizacao_estilo: EstiloHarmonizacao;
  /** Resultados mostrando dados simulados. Só para contas autorizadas. */
  demo_resultados: boolean;
  publicado: boolean;
}

/**
 * - `curado`: só os pares que o dono escreveu, um a um. Sem par, sem sugestão.
 * - `misto`: os pares do dono primeiro, e as categorias que ele casou completam.
 * - `automatico`: só a regra de categoria — ele marca uma vez e não pensa mais.
 */
export type ModoHarmonizacao = "curado" | "misto" | "automatico";

/**
 * Como a sugestão aparece dentro do prato.
 *
 * "cartao": miniatura, nome e preço — vende pelo olho, e por isso só aceita
 * item COM foto. "texto": a frase do dono em uma linha, que funciona sem foto
 * nenhuma e ocupa um quarto da altura sobre o vídeo.
 */
export type EstiloHarmonizacao = "cartao" | "texto";

export interface MenuGroup {
  categoria: Category;
  pratos: Dish[];
}

/** Cardápio público, já ordenado e sem o que o cliente não deve ver. */
export interface PublicMenu {
  restaurant: Restaurant;
  grupos: MenuGroup[];
  paresPrato: ParPrato[];
  paresCategoria: ParCategoria[];
}

/** Uma linha do pedido que o cliente monta. */
export interface OrderLine {
  dish_id: string;
  nome: string;
  quantidade: number;
}
