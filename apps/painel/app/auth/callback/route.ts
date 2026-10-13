import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { reportError } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Troca o código do magic link / confirmação de e-mail por uma sessão. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destino = url.searchParams.get("de") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?erro=Link%20inv%C3%A1lido%20ou%20expirado.", url.origin));
  }

  try {
    const { error } = await serverClient().auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    return NextResponse.redirect(new URL(destino.startsWith("/") ? destino : "/", url.origin));
  } catch (err) {
    await reportError("falha_callback_auth", err);
    return NextResponse.redirect(
      new URL("/entrar?erro=N%C3%A3o%20conseguimos%20confirmar%20o%20link.%20Tente%20de%20novo.", url.origin),
    );
  }
}
