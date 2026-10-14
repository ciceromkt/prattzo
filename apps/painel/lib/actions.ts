"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  esgotadoAte, FUSO_PADRAO, lerExpedientes, normalizarPar, parsePriceToCents, proximaOrdem, slugify,
} from "@prattzo/core";
import { reordenar as reordenarLocal } from "@prattzo/core";
import { requireRestaurant, requireUser } from "./supabase";
import { reportError } from "./log";

export interface ActionState {
  erro?: string;
  ok?: string;
}

const texto = (fd: FormData, campo: string): string => (fd.get(campo)?.toString() ?? "").trim();
const marcado = (fd: FormData, campo: string): boolean => fd.get(campo) === "on" || fd.get(campo) === "true";

/**
 * Ingredientes: uma linha, um ingrediente.
 *
 * O dono digita como ele fala, e cada casa pontua do seu jeito — por isso a
 * quebra de linha é o separador, não a vírgula: "molho de ervas, alho e limão"
 * é UM ingrediente, e vírgula partiria em três.
 */
const listaDeLinhas = (fd: FormData, campo: string, max = 24): string[] =>
  texto(fd, campo)
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter((l) => l.length > 0 && l.length <= 60)
    .slice(0, max);

/**
 * Limpa o cache dos dois lados depois de qualquer mudança no cardápio.
 *
 * O `revalidatePath` só vale para este app. O cardápio do cliente é outro app,
 * com outro cache, e não tem como ser alcançado de dentro daqui — por isso a
 * chamada HTTP. Sem ela o dono marca "acabou" e o cliente segue vendo o item
 * disponível até o cache vencer sozinho.
 *
 * É esperado, e não falha: o `revalidate` da página do cliente continua sendo
 * a rede de segurança se esta chamada não chegar. Mas é aguardada, porque em
 * serverless o que não é aguardado é cortado quando a resposta sai.
 */
async function atualiza(slug?: string) {
  revalidatePath("/");
  revalidatePath("/cardapio");

  const base = process.env.NEXT_PUBLIC_CARDAPIO_URL;
  const segredo = process.env.REVALIDAR_SEGREDO;
  if (!slug || !base || !segredo) return;
  try {
    await fetch(`${base}/api/revalidar`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidar-segredo": segredo },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (erro) {
    reportError("falha_revalidar_cardapio", erro, { slug });
  }
}

// ------------------------------------------------------------------ restaurante

export async function criarRestaurante(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, user } = await requireUser();
  const nome = texto(fd, "nome");
  if (nome.length < 2) return { erro: "Informe o nome do restaurante." };

  const base = slugify(texto(fd, "slug") || nome);
  if (!base) return { erro: "Não foi possível gerar o endereço. Use letras e números no nome." };

  let slug = base;
  for (let i = 2; i < 40; i++) {
    const { data } = await client.from("restaurants").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { error } = await client.from("restaurants").insert({
    owner_id: user.id,
    nome,
    slug,
    descricao: texto(fd, "descricao"),
    horario_texto: texto(fd, "horario_texto"),
  });
  if (error) {
    reportError("falha_criar_restaurante", error);
    return { erro: "Não deu para criar agora. Tente de novo." };
  }
  redirect("/");
}

export async function salvarRestaurante(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();
  const nome = texto(fd, "nome");
  if (nome.length < 2) return { erro: "Informe o nome." };

  const { error } = await client
    .from("restaurants")
    .update({
      nome,
      descricao: texto(fd, "descricao"),
      horario_texto: texto(fd, "horario_texto"),
      fuso: texto(fd, "fuso") || FUSO_PADRAO,
      logo_url: texto(fd, "logo_url") || null,
      logo_escuro: marcado(fd, "logo_escuro"),
      video_capa_url: texto(fd, "video_capa_url") || null,
    })
    .eq("id", restaurant.id);
  if (error) {
    reportError("falha_salvar_restaurante", error);
    return { erro: "Não deu para salvar." };
  }
  // `atualiza` em vez de só revalidar aqui: nome, horário e vídeo de capa
  // aparecem no cardápio do cliente, que é outro app, com outro cache.
  await atualiza(restaurant.slug);
  return { ok: "Salvo." };
}

/** Dias e horários. Chega como JSON pronto do formulário e é validado aqui. */
export async function salvarHorarios(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();

  let bruto: unknown = [];
  try {
    bruto = JSON.parse(texto(fd, "horarios") || "[]");
  } catch {
    return { erro: "Horários em formato inesperado." };
  }

  // Nunca grava o que veio do navegador sem passar pelo mesmo validador que o
  // cardápio usa para ler: assim o banco não guarda o que a tela não entende.
  const limpos = lerExpedientes(bruto);

  const { error } = await client
    .from("restaurants").update({ horarios: limpos }).eq("id", restaurant.id);
  if (error) {
    reportError("falha_salvar_horarios", error);
    return { erro: "Não deu para salvar os horários." };
  }
  await atualiza(restaurant.slug);
  return { ok: limpos.length === 0 ? "Salvo. Nenhum dia marcado como aberto." : "Horários salvos." };
}

/** Marketing: o que serve para trazer e trazer de volta o cliente. */
export async function salvarMarketing(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();

  const link = texto(fd, "link_google");
  if (link && !/^https?:\/\//i.test(link)) {
    return { erro: "O link do Google precisa começar com https://" };
  }

  const { error } = await client
    .from("restaurants").update({ link_google: link || null }).eq("id", restaurant.id);
  if (error) {
    reportError("falha_salvar_marketing", error);
    return { erro: "Não deu para salvar." };
  }
  await atualiza(restaurant.slug);
  return { ok: "Salvo." };
}

/**
 * Publicar é um passo separado de propósito: enquanto o cardápio está em
 * rascunho, o dono pode digitar um preço pela metade sem que o cliente veja.
 */
export async function alternarPublicado(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("restaurants").update({ publicado: marcado(fd, "publicar") }).eq("id", restaurant.id);
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

// ------------------------------------------------------------------ categorias

export async function criarCategoria(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();
  const nome = texto(fd, "nome");
  if (nome.length < 2) return { erro: "Dê um nome à categoria." };

  const { data: atuais } = await client
    .from("menu_categories").select("ordem").eq("restaurant_id", restaurant.id);

  const { error } = await client.from("menu_categories").insert({
    restaurant_id: restaurant.id,
    nome,
    ordem: proximaOrdem(atuais ?? []),
  });
  if (error) {
    reportError("falha_criar_categoria", error);
    return { erro: "Não deu para criar a categoria." };
  }
  await atualiza(restaurant.slug);
  return { ok: `“${nome}” criada.` };
}

export async function renomearCategoria(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  const nome = texto(fd, "nome");
  if (nome.length < 2) return;
  await client.from("menu_categories").update({ nome })
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

export async function excluirCategoria(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  // Os pratos não somem junto: ficam sem categoria, em "Outros".
  await client.from("menu_categories").delete()
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

export async function moverCategoria(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  // Uma chamada, uma transação: ver supabase/migrations/..._ordem_atomica.sql
  await client.rpc("mover_categoria", {
    p_id: texto(fd, "id"),
    p_direcao: texto(fd, "direcao") === "cima" ? "cima" : "baixo",
  });
  await atualiza(restaurant.slug);
}

export async function definirCapaCategoria(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("menu_categories")
    .update({ capa_url: texto(fd, "capa_url") || null })
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

// ---------------------------------------------------------------------- pratos

function precos(fd: FormData): { min: number; max: number | null } | string {
  const minTexto = texto(fd, "preco_min");
  const maxTexto = texto(fd, "preco_max");
  const min = minTexto ? parsePriceToCents(minTexto) : 0;
  if (min === null) return "Preço inválido. Use o formato 59,00.";
  if (!maxTexto) return { min: min ?? 0, max: null };
  const max = parsePriceToCents(maxTexto);
  if (max === null) return "Preço máximo inválido.";
  if (max < (min ?? 0)) return "O preço máximo não pode ser menor que o mínimo.";
  return { min: min ?? 0, max };
}

export async function criarPrato(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();
  const nome = texto(fd, "nome");
  if (nome.length < 2) return { erro: "Dê um nome ao item." };

  const p = precos(fd);
  if (typeof p === "string") return { erro: p };

  const categoryId = texto(fd, "category_id") || null;
  const { data: irmaos } = await client
    .from("dishes").select("ordem").eq("restaurant_id", restaurant.id)
    .eq("category_id", categoryId ?? "");

  const { error } = await client.from("dishes").insert({
    restaurant_id: restaurant.id,
    category_id: categoryId,
    nome,
    descricao: texto(fd, "descricao"),
    ingredientes: listaDeLinhas(fd, "ingredientes"),
    serve: texto(fd, "serve").slice(0, 40),
    preco_min_centavos: p.min,
    preco_max_centavos: p.max,
    ordem: proximaOrdem(irmaos ?? []),
  });
  if (error) {
    reportError("falha_criar_prato", error);
    return { erro: "Não deu para criar o item." };
  }
  await atualiza(restaurant.slug);
  return { ok: `“${nome}” adicionado.` };
}

/**
 * Salvar com trava otimista.
 *
 * O formulário leva a versão que foi carregada (`atualizado_em`). Se alguém
 * salvou no meio do caminho, o update não encontra a linha e o usuário é
 * avisado — em vez de apagar o trabalho do colega em silêncio, que foi o que
 * aconteceu no teste: o gerente salvou o preço e o marketing devolveu o antigo.
 */
export async function salvarPrato(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();
  const nome = texto(fd, "nome");
  if (nome.length < 2) return { erro: "Dê um nome ao item." };

  const p = precos(fd);
  if (typeof p === "string") return { erro: p };

  const versao = texto(fd, "versao");
  const q = client.from("dishes").update({
    nome,
    descricao: texto(fd, "descricao"),
    ingredientes: listaDeLinhas(fd, "ingredientes"),
    serve: texto(fd, "serve").slice(0, 40),
    preco_min_centavos: p.min,
    preco_max_centavos: p.max,
    category_id: texto(fd, "category_id") || null,
  }).eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);

  const { data, error } = await (versao ? q.eq("versao", Number(versao)) : q).select("id");
  if (error) {
    reportError("falha_salvar_prato", error);
    return { erro: "Não deu para salvar." };
  }
  if (versao && (!data || data.length === 0)) {
    return { erro: "Outra pessoa editou este item enquanto você digitava. Recarregue a página para ver o que mudou antes de salvar de novo." };
  }
  await atualiza(restaurant.slug);
  return { ok: "Salvo." };
}

export async function excluirPrato(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("dishes").delete()
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

export async function moverPrato(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.rpc("mover_prato", {
    p_id: texto(fd, "id"),
    p_direcao: texto(fd, "direcao") === "cima" ? "cima" : "baixo",
  });
  await atualiza(restaurant.slug);
}

export async function alternarAtivo(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("dishes").update({ ativo: marcado(fd, "ativo") })
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

/**
 * Esgotado é o botão mais usado num restaurante: acabou a picanha às 21h.
 * Vale até as 6h do dia seguinte e volta sozinho — ninguém lembra de desmarcar
 * no dia seguinte, e um item some do cardápio por uma semana por causa disso.
 */
/** Marca o item para passar à frente na sugestão de fechamento de pedido. */
export async function alternarDestaque(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("dishes").update({ destaque: marcado(fd, "destaque") })
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

export async function alternarEsgotado(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  const marcar = marcado(fd, "esgotar");
  // O fuso vem do salão: o servidor roda em UTC e devolveria o item às 3h da manhã.
  const { data } = await client
    .from("restaurants").select("fuso").eq("id", restaurant.id).maybeSingle<{ fuso: string }>();
  await client.from("dishes")
    .update({ esgotado_ate: marcar ? esgotadoAte(new Date(), data?.fuso ?? FUSO_PADRAO).toISOString() : null })
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

// ---------------------------------------------------------------- harmonização

/**
 * As combinações por categoria, salvas de uma vez.
 *
 * O formulário manda os pares marcados como "idA|idB". Aqui eles são
 * normalizados (menor id primeiro, como o banco exige), deduplicados, e a
 * tabela do restaurante é reescrita: é a operação que a tela representa — um
 * quadro de marcações, não uma fila de alterações. Reescrever evita o estado
 * meio-salvo de quem desmarcou três e marcou duas.
 */
export async function salvarParesCategoria(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();

  const { data: minhas } = await client
    .from("menu_categories").select("id").eq("restaurant_id", restaurant.id);
  const validas = new Set((minhas ?? []).map((c: { id: string }) => c.id));

  const vistos = new Set<string>();
  const linhas: Array<{ restaurant_id: string; a_id: string; b_id: string }> = [];
  for (const bruto of fd.getAll("par").map((v) => v.toString())) {
    const [x, y] = bruto.split("|");
    const par = normalizarPar(x ?? "", y ?? "");
    // Categoria de outro restaurante jamais entra, mesmo se vier no formulário.
    if (!par || !validas.has(par.a_id) || !validas.has(par.b_id)) continue;
    const chave = `${par.a_id}|${par.b_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push({ restaurant_id: restaurant.id, ...par });
  }

  const { error: eApagar } = await client
    .from("category_pairings").delete().eq("restaurant_id", restaurant.id);
  if (eApagar) {
    reportError("falha_limpar_pares_categoria", eApagar);
    return { erro: "Não deu para salvar as combinações." };
  }
  if (linhas.length > 0) {
    const { error } = await client.from("category_pairings").insert(linhas);
    if (error) {
      reportError("falha_salvar_pares_categoria", error);
      return { erro: "Não deu para salvar as combinações." };
    }
  }

  await atualiza(restaurant.slug);
  return {
    ok: linhas.length === 0
      ? "Salvo. Nenhuma combinação marcada — o cardápio não vai sugerir nada por categoria."
      : `Salvo. ${linhas.length} ${linhas.length === 1 ? "combinação" : "combinações"}.`,
  };
}

/**
 * Quem escolhe a harmonização, e quantas sugestões aparecem.
 *
 * É a única configuração do produto que muda o COMPORTAMENTO do cardápio, e
 * não o conteúdo dele — por isso mora junto da harmonização e não em
 * Configurações, onde viraria mais um campo que ninguém lê.
 */
export async function salvarModoHarmonizacao(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();

  const modo = texto(fd, "modo");
  if (!["curado", "misto", "automatico"].includes(modo)) return { erro: "Modo inválido." };
  const max = Number(texto(fd, "max")) === 2 ? 2 : 1;

  const { error } = await client
    .from("restaurants").update({ harmonizacao_modo: modo, harmonizacao_max: max })
    .eq("id", restaurant.id);
  if (error) {
    reportError("falha_salvar_modo_harmonizacao", error);
    return { erro: "Não deu para salvar." };
  }
  await atualiza(restaurant.slug);
  return { ok: `Salvo. ${max === 1 ? "Uma sugestão" : "Duas sugestões"} por prato.` };
}

/** Par exato entre dois pratos, com a frase do dono. */
export async function criarParPrato(_e: ActionState, fd: FormData): Promise<ActionState> {
  const { client, restaurant } = await requireRestaurant();
  const par = normalizarPar(texto(fd, "a_id"), texto(fd, "b_id"));
  if (!par) return { erro: "Escolha dois itens diferentes." };

  // Os dois têm que ser desta casa: o id vem de um select, mas select é HTML.
  const { data: achados } = await client
    .from("dishes").select("id").eq("restaurant_id", restaurant.id).in("id", [par.a_id, par.b_id]);
  if ((achados ?? []).length !== 2) return { erro: "Item não encontrado no seu cardápio." };

  const { data: atuais } = await client
    .from("dish_pairings").select("ordem").eq("restaurant_id", restaurant.id);

  const { error } = await client.from("dish_pairings").insert({
    restaurant_id: restaurant.id,
    ...par,
    nota: texto(fd, "nota").slice(0, 140),
    ordem: proximaOrdem(atuais ?? []),
  });
  if (error) {
    // 23505 = índice único: o par já existe, em uma ordem ou na outra.
    if ((error as { code?: string }).code === "23505") {
      return { erro: "Esses dois já estão combinados." };
    }
    reportError("falha_criar_par_prato", error);
    return { erro: "Não deu para salvar o par." };
  }
  await atualiza(restaurant.slug);
  return { ok: "Par salvo." };
}

export async function excluirParPrato(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("dish_pairings").delete()
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

// ----------------------------------------------------------------------- mídia

export async function excluirMidia(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  await client.from("dish_media").delete()
    .eq("id", texto(fd, "id")).eq("restaurant_id", restaurant.id);
  await atualiza(restaurant.slug);
}

/**
 * Troca o arquivo de uma mídia que já está no cardápio, mantendo o lugar dela.
 *
 * É o reenquadrar: a foto volta recortada do jeito que o dono escolheu, e
 * precisa entrar no MESMO item, na MESMA posição — recadastrar jogaria a capa
 * do prato para o fim da fila. O arquivo antigo é apagado do Storage porque
 * ninguém mais aponta para ele; se a remoção falhar, o cardápio já está certo e
 * o que sobra é um arquivo órfão, não um erro para o dono.
 */
export async function substituirMidia(input: { id: string; url: string }): Promise<{ ok: boolean }> {
  const { client, restaurant } = await requireRestaurant();

  const { data: antiga } = await client
    .from("dish_media").select("url, tipo").eq("id", input.id)
    .eq("restaurant_id", restaurant.id).maybeSingle<{ url: string; tipo: string }>();
  if (!antiga) return { ok: false };

  const { error } = await client
    .from("dish_media")
    .update({ url: input.url, poster_url: antiga.tipo === "video" ? input.url : null })
    .eq("id", input.id).eq("restaurant_id", restaurant.id);
  if (error) {
    reportError("falha_substituir_midia", error);
    return { ok: false };
  }

  const caminho = antiga.url.split("/object/public/midia/")[1];
  if (caminho && caminho !== input.url.split("/object/public/midia/")[1]) {
    const { error: eRemover } = await client.storage.from("midia").remove([decodeURIComponent(caminho)]);
    if (eRemover) reportError("falha_remover_midia_antiga", eRemover, { caminho });
  }

  await atualiza(restaurant.slug);
  return { ok: true };
}

export async function moverMidia(fd: FormData): Promise<void> {
  const { client, restaurant } = await requireRestaurant();
  const { data } = await client
    .from("dish_media").select("id, ordem, url").eq("dish_id", texto(fd, "dish_id"))
    .eq("restaurant_id", restaurant.id);
  const lista = (data ?? []).map((m) => ({ id: m.id, ordem: m.ordem, nome: m.url }));
  const mudancas = reordenarLocal(lista, texto(fd, "id"), texto(fd, "direcao") === "cima" ? "cima" : "baixo");
  for (const m of mudancas) {
    await client.from("dish_media").update({ ordem: m.ordem })
      .eq("id", m.id).eq("restaurant_id", restaurant.id);
  }
  await atualiza(restaurant.slug);
}

/** Chamado pelo navegador depois que o arquivo chega no Storage. */
export async function registrarMidia(input: {
  dishId: string;
  tipo: "foto" | "video";
  url: string;
  posterUrl?: string | null;
  duracaoS?: number | null;
}): Promise<{ ok: boolean }> {
  const { client, restaurant } = await requireRestaurant();
  const { data: existentes } = await client
    .from("dish_media").select("ordem").eq("dish_id", input.dishId);

  const { error } = await client.from("dish_media").insert({
    dish_id: input.dishId,
    restaurant_id: restaurant.id,
    tipo: input.tipo,
    url: input.url,
    poster_url: input.tipo === "video" ? (input.posterUrl ?? input.url) : null,
    duracao_s: input.duracaoS ?? null,
    ordem: proximaOrdem(existentes ?? []),
  });
  if (error) {
    reportError("falha_registrar_midia", error);
    return { ok: false };
  }
  await atualiza(restaurant.slug);
  return { ok: true };
}

export async function sair(): Promise<void> {
  const { client } = await requireUser();
  await client.auth.signOut();
  redirect("/entrar");
}

