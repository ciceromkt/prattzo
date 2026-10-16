import { NextResponse } from "next/server";
import { brandingPath, mediaPath, rascunhoPath } from "@prattzo/core";
import { requireRestaurant } from "@/lib/supabase";
import { reportError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const BUCKET = "midia";

/**
 * Devolve uma URL assinada para o navegador enviar direto ao Storage.
 * O arquivo nunca passa por aqui — o painel só autoriza.
 *
 * Dois destinos: a mídia de um prato (`dishId`) e a mídia da casa (`alvo`),
 * que é o vídeo de ambiente da capa e o logo. Nos dois casos o caminho começa
 * pelo id do restaurante, que é o que a política do Storage confere.
 */
export async function POST(req: Request) {
  try {
    const { client, restaurant } = await requireRestaurant();
    const { dishId, tipo, contentType, alvo } = (await req.json()) as {
      dishId?: string;
      tipo?: "foto" | "video";
      contentType?: string;
      alvo?: "capa" | "logo" | "categoria" | "rascunho";
    };

    if (!contentType || !EXT[contentType]) {
      return NextResponse.json({ erro: "Formato não aceito." }, { status: 400 });
    }

    let path: string;

    if (alvo === "rascunho") {
      // Item que ainda não existe: não há dishId para conferir, e não precisa —
      // a pasta começa pelo id do restaurante, que é o que o Storage valida.
      if (!tipo) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
      path = rascunhoPath(restaurant.id, tipo, EXT[contentType]!);
    } else if (alvo === "capa" || alvo === "logo" || alvo === "categoria") {
      // Logo e capa de categoria são imagem; a capa da casa é vídeo. Trocar um
      // pelo outro quebraria a tela.
      const ehVideo = contentType.startsWith("video/");
      if (alvo === "capa" && !ehVideo) {
        return NextResponse.json({ erro: "A capa é um vídeo." }, { status: 400 });
      }
      if (alvo !== "capa" && ehVideo) {
        return NextResponse.json({ erro: "Esta capa é uma imagem." }, { status: 400 });
      }
      path = brandingPath(restaurant.id, alvo, EXT[contentType]!);
    } else {
      if (!dishId || !tipo) {
        return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
      }
      // Confere que o prato é mesmo deste restaurante antes de liberar escrita.
      const { data: prato } = await client
        .from("dishes").select("id").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
      if (!prato) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
      path = mediaPath(restaurant.id, dishId, tipo, EXT[contentType]!);
    }

    const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      reportError("falha_url_upload", error);
      return NextResponse.json({ erro: "Não deu para autorizar o envio." }, { status: 500 });
    }

    const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl: pub.publicUrl,
    });
  } catch (erro) {
    reportError("falha_upload", erro);
    return NextResponse.json({ erro: "Erro no servidor." }, { status: 500 });
  }
}
