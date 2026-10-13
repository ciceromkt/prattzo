import { NextResponse } from "next/server";
import { mediaPath } from "@prattzo/core";
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
 * O arquivo nunca passa por aqui. A política do bucket só aceita escrita
 * dentro da pasta do próprio restaurante.
 */
export async function POST(req: Request) {
  try {
    const { client, restaurant } = await requireRestaurant();
    const { dishId, tipo, contentType } = (await req.json()) as {
      dishId?: string; tipo?: "foto" | "video"; contentType?: string;
    };

    if (!dishId || !tipo || !contentType || !EXT[contentType]) {
      return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
    }

    // Confere que o prato é mesmo deste restaurante antes de liberar escrita.
    const { data: prato } = await client
      .from("dishes").select("id").eq("id", dishId).eq("restaurant_id", restaurant.id).maybeSingle();
    if (!prato) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });

    const path = mediaPath(restaurant.id, dishId, tipo, EXT[contentType]!);
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
