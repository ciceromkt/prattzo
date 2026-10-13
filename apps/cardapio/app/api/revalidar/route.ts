import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Limpa o cache de um cardápio a pedido do painel.
 *
 * Por que isto existe: o painel e o cardápio são dois apps separados, cada um
 * com o seu cache. O `revalidatePath` do painel só limpa o cache do painel —
 * nunca alcança o do cardápio. Sem esta rota, o dono marca um item como
 * esgotado e o cliente continua vendo o item disponível pelo tempo do
 * `revalidate` da página. Numa casa cheia isso é pedido de coisa que não tem.
 *
 * O segredo é obrigatório: sem ele qualquer pessoa poderia furar o cache de
 * qualquer cardápio em laço e transformar a página em consulta ao banco.
 */
export async function POST(req: Request) {
  const esperado = process.env.REVALIDAR_SEGREDO;
  if (!esperado) {
    log.warn("revalidar_sem_segredo");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (req.headers.get("x-revalidar-segredo") !== esperado) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { slug } = (await req.json().catch(() => ({}))) as { slug?: string };
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  revalidatePath(`/r/${slug}`);
  log.info("revalidado", { slug });
  return NextResponse.json({ ok: true });
}
