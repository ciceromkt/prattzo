"use client";

/**
 * Pergunta ao servidor o que acabou agora.
 *
 * Fica num módulo próprio por dois motivos: a página do cliente é cacheada e
 * esta consulta não pode ser, e a demonstração troca este arquivo por um dublê
 * que lê do store em memória — assim ela mostra o mesmo comportamento sem
 * precisar de servidor.
 *
 * Nunca lança: se não der para perguntar, o pedido segue com o que está na tela.
 */
export async function consultarEsgotados(slug: string): Promise<Record<string, true>> {
  try {
    const r = await fetch(`/api/esgotados?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const { esgotados } = (await r.json()) as { esgotados?: string[] };
    const mapa: Record<string, true> = {};
    for (const id of esgotados ?? []) mapa[id] = true;
    return mapa;
  } catch {
    return {};
  }
}
