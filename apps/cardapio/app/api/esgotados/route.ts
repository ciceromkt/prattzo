import { NextResponse } from "next/server";
import { createPublicClient } from "@pede-esse/db";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Quais itens acabaram agora, neste instante.
 *
 * O cache da página não é o único jeito de a tela ficar velha: o cliente abre o
 * cardápio, assiste a dez vídeos, conversa, e só então abre o pedido. Nesse
 * meio-tempo a cozinha pode ter acabado com alguma coisa. Esta rota existe para
 * o momento em que isso custa dinheiro — a hora de fechar — e é de propósito
 * minúscula: só os ids esgotados, sem cache, sem o cardápio inteiro de volta.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const client = createPublicClient();
    const { data: rest } = await client
      .from("restaurants").select("id").eq("slug", slug).eq("publicado", true).maybeSingle();
    if (!rest) return NextResponse.json({ ok: false }, { status: 404 });

    const { data } = await client
      .from("dishes")
      .select("id,esgotado_ate")
      .eq("restaurant_id", rest.id)
      .gt("esgotado_ate", new Date().toISOString());

    return NextResponse.json(
      { ok: true, esgotados: (data ?? []).map((d) => d.id) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    log.error("falha_esgotados", { erro: String(erro) });
    // Numa falha, devolve lista vazia: é melhor não avisar do que travar o pedido.
    return NextResponse.json({ ok: false, esgotados: [] });
  }
}
