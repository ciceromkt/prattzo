import { NextResponse } from "next/server";
import { createAdminClient } from "@pede-esse/db";
import { rateLimit } from "@/lib/ratelimit";
import { log, reportError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direito de exclusão (LGPD, art. 18).
 * Apaga eventos, sessões e consentimentos ligados à sessão anônima informada.
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { sessao?: unknown } | null;
    const sessao = typeof body?.sessao === "string" && body.sessao.length >= 8 && body.sessao.length <= 64 ? body.sessao : null;
    if (!sessao) {
      return NextResponse.json({ erro: "Sessão inválida." }, { status: 400 });
    }

    const limite = rateLimit(`lgpd:${sessao}`, 5, 60_000);
    if (!limite.ok) {
      return NextResponse.json({ erro: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("apagar_dados_sessao", { p_sessao: sessao });
    if (error) throw new Error(error.message);

    log.info("dados_sessao_apagados", { sessao: `${sessao.slice(0, 4)}…` });
    return NextResponse.json({ ok: true, mensagem: "Seus dados desta visita foram apagados." });
  } catch (err) {
    await reportError("erro_rota_privacidade", err);
    return NextResponse.json({ erro: "Não conseguimos apagar agora. Tente novamente." }, { status: 500 });
  }
}
