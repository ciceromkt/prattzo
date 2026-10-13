import { NextResponse } from "next/server";
import { createAdminClient, createPublicClient, getPublicMenu, registrarPedido } from "@prattzo/db";
import { rateLimit } from "@/lib/ratelimit";
import { log } from "@/lib/log";

interface Linha { dish_id: string; nome: string; quantidade: number; preco_centavos: number }

/**
 * Guarda o que o cliente separou. Nada é enviado para a cozinha — isto existe
 * para o dono comparar desejo (o que foi separado) com venda (o que saiu no PDV).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      slug?: string; totalCentavos?: number; aproximado?: boolean; linhas?: Linha[];
    };
    const { slug, linhas } = body;
    if (!slug || !Array.isArray(linhas) || linhas.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const menu = await getPublicMenu(createPublicClient(), slug);
    if (!menu) return NextResponse.json({ ok: false }, { status: 404 });

    const sessao = req.headers.get("x-sessao") ?? "anon";
    if (!rateLimit(`ped:${sessao}`, 10, 60_000).ok) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    // Só aceita prato que existe no cardápio publicado.
    const validos = new Map(menu.grupos.flatMap((g) => g.pratos).map((p) => [p.id, p]));
    const limpas = linhas
      .filter((l) => validos.has(l.dish_id) && l.quantidade > 0 && l.quantidade < 100)
      .slice(0, 60)
      .map((l) => ({
        dish_id: l.dish_id,
        nome: validos.get(l.dish_id)!.nome,
        quantidade: Math.round(l.quantidade),
        preco_centavos: validos.get(l.dish_id)!.preco_min_centavos,
      }));
    if (limpas.length === 0) return NextResponse.json({ ok: false }, { status: 400 });

    const id = await registrarPedido(createAdminClient(), {
      restaurantId: menu.restaurant.id,
      sessao,
      totalCentavos: limpas.reduce((n, l) => n + l.preco_centavos * l.quantidade, 0),
      aproximado: Boolean(body.aproximado),
      linhas: limpas,
    });
    return NextResponse.json({ ok: Boolean(id) });
  } catch (erro) {
    log.error("falha_pedido", { erro: String(erro) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
