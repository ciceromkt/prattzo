import { NextResponse } from "next/server";
import { createAdminClient, registrarEventos } from "@prattzo/db";
import { rateLimit } from "@/lib/ratelimit";
import { log } from "@/lib/log";

const TIPOS = new Set([
  "abriu_cardapio", "abriu_categoria", "viu_prato", "terminou_video",
  "adicionou_pedido", "fechou_pedido", "compartilhou", "viu_sugestao", "aceitou_sugestao",
]);

export async function POST(req: Request) {
  try {
    const { restaurantId, sessao, events } = (await req.json()) as {
      restaurantId?: string; sessao?: string; events?: unknown[];
    };
    if (!restaurantId || !sessao || !Array.isArray(events)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!rateLimit(`ev:${sessao}`, 60, 60_000).ok) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const limpos = events
      .slice(0, 50)
      .map((e) => e as { tipo?: string; dishId?: string; ms?: number })
      .filter((e) => e.tipo && TIPOS.has(e.tipo))
      .map((e) => ({
        restaurantId,
        sessao,
        tipo: e.tipo as never,
        dishId: e.dishId ?? null,
        ms: typeof e.ms === "number" && e.ms >= 0 && e.ms < 600_000 ? Math.round(e.ms) : null,
      }));

    if (limpos.length > 0) await registrarEventos(createAdminClient(), limpos);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    log.error("falha_eventos", { erro: String(erro) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
