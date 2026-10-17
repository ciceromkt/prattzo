import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Category, DiaPeriodo, Dish, MediaItem, ParCategoria, ParPeriodo, ParPrato,
  PratoPeriodo, PublicMenu, Restaurant, Resultados, ResumoPeriodo,
} from "@prattzo/core";
import { montarGrupos } from "@prattzo/core";
import type {
  AtencaoRow, CategoryRow, DishRow, EventType, MediaRow, ParCategoriaRow, ParPratoRow,
  RestaurantRow, ResumoRow,
} from "./schema";

function toRestaurant(r: RestaurantRow): Restaurant {
  return {
    id: r.id, owner_id: r.owner_id, nome: r.nome, slug: r.slug, descricao: r.descricao,
    logo_url: r.logo_url, logo_escuro: Boolean(r.logo_escuro),
    video_capa_url: r.video_capa_url, horario_texto: r.horario_texto,
    horarios: r.horarios ?? [], fuso: r.fuso,
    link_google: r.link_google,
    // Coluna nova: banco que ainda não rodou a migração devolve nulo aqui, e a
    // tela do cliente não pode quebrar por causa disso.
    harmonizacao_modo: r.harmonizacao_modo === "curado" || r.harmonizacao_modo === "automatico"
      ? r.harmonizacao_modo : "misto",
    harmonizacao_max: r.harmonizacao_max === 2 ? 2 : 1,
    demo_resultados: Boolean(r.demo_resultados),
    publicado: r.publicado,
  };
}

function toCategory(c: CategoryRow): Category {
  return { id: c.id, restaurant_id: c.restaurant_id, nome: c.nome, ordem: c.ordem, ativa: c.ativa, capa_url: c.capa_url };
}

function toMedia(m: MediaRow): MediaItem {
  return {
    id: m.id, dish_id: m.dish_id, tipo: m.tipo, url: m.url,
    poster_url: m.poster_url, duracao_s: m.duracao_s, ordem: m.ordem,
  };
}

function toDish(d: DishRow, midias: MediaRow[]): Dish {
  return {
    id: d.id, restaurant_id: d.restaurant_id, category_id: d.category_id,
    nome: d.nome, descricao: d.descricao,
    preco_min_centavos: d.preco_min_centavos, preco_max_centavos: d.preco_max_centavos,
    ordem: d.ordem, ativo: d.ativo, esgotado_ate: d.esgotado_ate, destaque: d.destaque, versao: d.versao,
    // Colunas novas: o banco de um cliente que ainda não rodou a migração
    // devolve undefined aqui, e a tela não pode quebrar por causa disso.
    ingredientes: Array.isArray(d.ingredientes) ? d.ingredientes.filter((i) => Boolean(i?.trim())) : [],
    serve: (d.serve ?? "").trim(),
    midias: midias.filter((m) => m.dish_id === d.id).map(toMedia),
  };
}

function toParPrato(p: ParPratoRow): ParPrato {
  return { id: p.id, a_id: p.a_id, b_id: p.b_id, nota: p.nota ?? "", ordem: p.ordem ?? 0 };
}

function toParCategoria(p: ParCategoriaRow): ParCategoria {
  return { id: p.id, a_id: p.a_id, b_id: p.b_id };
}

export interface MenuData {
  restaurant: Restaurant;
  categorias: Category[];
  pratos: Dish[];
  paresPrato: ParPrato[];
  paresCategoria: ParCategoria[];
}

/** Carrega tudo de um restaurante por id (painel) ou slug (cliente). */
async function carregar(
  db: SupabaseClient,
  chave: { id: string } | { slug: string },
): Promise<MenuData | null> {
  const q = db.from("restaurants").select("*");
  const { data: rest } = "id" in chave
    ? await q.eq("id", chave.id).maybeSingle<RestaurantRow>()
    : await q.eq("slug", chave.slug).maybeSingle<RestaurantRow>();
  if (!rest) return null;

  const [{ data: cats }, { data: pratos }, { data: midias }, { data: paresP }, { data: paresC }] =
    await Promise.all([
      db.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("ordem"),
      db.from("dishes").select("*").eq("restaurant_id", rest.id).order("ordem"),
      db.from("dish_media").select("*").eq("restaurant_id", rest.id).order("ordem"),
      db.from("dish_pairings").select("*").eq("restaurant_id", rest.id).order("ordem"),
      db.from("category_pairings").select("*").eq("restaurant_id", rest.id),
    ]);

  const rowsMidia = (midias ?? []) as MediaRow[];
  return {
    restaurant: toRestaurant(rest),
    categorias: ((cats ?? []) as CategoryRow[]).map(toCategory),
    pratos: ((pratos ?? []) as DishRow[]).map((d) => toDish(d, rowsMidia)),
    paresPrato: ((paresP ?? []) as ParPratoRow[]).map(toParPrato),
    paresCategoria: ((paresC ?? []) as ParCategoriaRow[]).map(toParCategoria),
  };
}

/** Cardápio público pelo slug. RLS garante que rascunho não aparece. */
export async function getPublicMenu(db: SupabaseClient, slug: string): Promise<PublicMenu | null> {
  const dados = await carregar(db, { slug });
  if (!dados || !dados.restaurant.publicado) return null;
  return {
    restaurant: dados.restaurant,
    grupos: montarGrupos(dados.categorias, dados.pratos, true),
    paresPrato: dados.paresPrato,
    paresCategoria: dados.paresCategoria,
  };
}

/** Cardápio completo do dono, incluindo o que está desativado. */
export async function getMenuDoDono(db: SupabaseClient, restaurantId: string): Promise<MenuData | null> {
  return carregar(db, { id: restaurantId });
}

export async function getRestaurantDoUsuario(db: SupabaseClient, userId: string): Promise<Restaurant | null> {
  const { data } = await db
    .from("restaurants").select("*").eq("owner_id", userId)
    .order("criado_em").limit(1).maybeSingle<RestaurantRow>();
  return data ? toRestaurant(data) : null;
}

export async function getAtencao(db: SupabaseClient, restaurantId: string): Promise<AtencaoRow[]> {
  const { data } = await db
    .from("v_atencao_pratos").select("*").eq("restaurant_id", restaurantId)
    .order("vistas", { ascending: false });
  return (data ?? []) as AtencaoRow[];
}

export async function getResumo(db: SupabaseClient, restaurantId: string): Promise<ResumoRow | null> {
  const { data } = await db
    .from("v_resumo").select("*").eq("restaurant_id", restaurantId).maybeSingle<ResumoRow>();
  return data ?? null;
}

export interface PedidoRegistrado {
  restaurantId: string;
  sessao: string;
  totalCentavos: number;
  aproximado: boolean;
  linhas: Array<{ dish_id: string; nome: string; quantidade: number; preco_centavos: number }>;
}

/**
 * Guarda o que o cliente separou. Não vai para a cozinha: é a medida de
 * desejo, para comparar com o que de fato saiu no PDV.
 */
export async function registrarPedido(db: SupabaseClient, p: PedidoRegistrado): Promise<string | null> {
  const { data, error } = await db
    .from("orders")
    .insert({
      restaurant_id: p.restaurantId,
      sessao: p.sessao,
      total_centavos: p.totalCentavos,
      aproximado: p.aproximado,
    })
    .select("id").single<{ id: string }>();
  if (error || !data) return null;

  if (p.linhas.length > 0) {
    await db.from("order_items").insert(p.linhas.map((l) => ({ order_id: data.id, ...l })));
  }
  return data.id;
}

export interface EventoEntrada {
  restaurantId: string;
  sessao: string;
  tipo: EventType;
  dishId?: string | null;
  /** O outro lado do par, nos eventos de harmonização. */
  alvoId?: string | null;
  ms?: number | null;
}

export async function registrarEventos(db: SupabaseClient, eventos: readonly EventoEntrada[]): Promise<void> {
  if (eventos.length === 0) return;
  await db.from("events").insert(
    eventos.map((e) => ({
      restaurant_id: e.restaurantId,
      sessao: e.sessao,
      tipo: e.tipo,
      dish_id: e.dishId ?? null,
      alvo_id: e.alvoId ?? null,
      ms: e.ms ?? null,
    })),
  );
}

export async function apagarDadosSessao(db: SupabaseClient, sessao: string): Promise<void> {
  await db.rpc("apagar_dados_sessao", { p_sessao: sessao });
}

/* ------------------------------------------------------------- Resultados */

/**
 * Os números reais de uma janela, na MESMA forma que o modo demonstração
 * devolve — ver `resultadosDemo` em @prattzo/core.
 *
 * As sete chamadas vão juntas de propósito: são independentes, e em série
 * somariam sete idas ao banco na frente do dono esperando a tela.
 *
 * O período anterior é a mesma função com `p_desloc = dias`. Um só lugar
 * define o recorte, então os dois lados da comparação nunca medem coisas
 * diferentes — que é o jeito clássico de um painel mentir sem querer.
 */
export async function getResultados(
  db: SupabaseClient, restaurantId: string, dias: number,
): Promise<Resultados> {
  const janela = Math.max(1, Math.min(Math.round(dias), 90));
  const chamar = <T>(fn: string, args: Record<string, unknown>) =>
    db.rpc(fn, args).then(({ data }) => (data ?? []) as T[]);

  const [resumo, anterior, pratos, pratosAnterior, pares, paresAnterior, serie] = await Promise.all([
    chamar<ResumoPeriodo>("resumo_periodo", { p_restaurant: restaurantId, p_dias: janela, p_desloc: 0 }),
    chamar<ResumoPeriodo>("resumo_periodo", { p_restaurant: restaurantId, p_dias: janela, p_desloc: janela }),
    chamar<PratoPeriodo>("pratos_periodo", { p_restaurant: restaurantId, p_dias: janela, p_desloc: 0 }),
    chamar<PratoPeriodo>("pratos_periodo", { p_restaurant: restaurantId, p_dias: janela, p_desloc: janela }),
    chamar<ParPeriodo>("pares_periodo", { p_restaurant: restaurantId, p_dias: janela, p_desloc: 0 }),
    chamar<ParPeriodo>("pares_periodo", { p_restaurant: restaurantId, p_dias: janela, p_desloc: janela }),
    chamar<DiaPeriodo>("serie_periodo", { p_restaurant: restaurantId, p_dias: janela }),
  ]);

  const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
  // O Postgres devolve bigint como texto no JSON: sem isto, "12" + "5" = "125"
  // em qualquer soma feita na tela.
  const limpaResumo = (r?: ResumoPeriodo): ResumoPeriodo => ({
    visitas: n(r?.visitas), pratos_vistos: n(r?.pratos_vistos), quero: n(r?.quero),
    harmonizacao_vistas: n(r?.harmonizacao_vistas), harmonizacao_cliques: n(r?.harmonizacao_cliques),
    compartilhamentos: n(r?.compartilhamentos), pedidos_fechados: n(r?.pedidos_fechados),
    sugestoes_vistas: n(r?.sugestoes_vistas), sugestoes_aceitas: n(r?.sugestoes_aceitas),
  });
  const limpaPratos = (ps: PratoPeriodo[]): PratoPeriodo[] => ps.map((p) => ({
    dish_id: p.dish_id, vistas: n(p.vistas), terminou: n(p.terminou),
    quis: n(p.quis), compartilhou: n(p.compartilhou),
    ms_medio: p.ms_medio == null ? null : n(p.ms_medio),
  }));
  const limpaPares = (ps: ParPeriodo[]): ParPeriodo[] => ps.map((p) => ({
    dish_id: p.dish_id, alvo_id: p.alvo_id, exibicoes: n(p.exibicoes), cliques: n(p.cliques),
  }));

  return {
    dias: janela,
    demo: false,
    resumo: limpaResumo(resumo[0]),
    anterior: limpaResumo(anterior[0]),
    pratos: limpaPratos(pratos),
    pratosAnterior: limpaPratos(pratosAnterior),
    pares: limpaPares(pares),
    paresAnterior: limpaPares(paresAnterior),
    serie: serie.map((d) => ({
      dia: String(d.dia), visitas: n(d.visitas), vistas: n(d.vistas),
      quero: n(d.quero), harmonizacao: n(d.harmonizacao),
    })),
  };
}
