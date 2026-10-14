"use client";

import { useRef, useState } from "react";
import type { MediaItem } from "@prattzo/core";
import {
  MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, validatePhoto, validateVideo,
} from "@prattzo/core";
import { excluirMidia, moverMidia, registrarMidia } from "@/lib/actions";

/**
 * Envia direto do navegador para o Storage, por URL assinada: o arquivo não
 * passa pelo servidor do painel. Vídeo é validado antes (vertical, até 15s).
 */
export function UploadMidia({ dishId, midias }: { dishId: string; midias: MediaItem[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  async function enviar(file: File) {
    setErro(null);
    setAvisos([]);
    const ehVideo = file.type.startsWith("video/");

    const medidas: { durationSeconds?: number; width?: number; height?: number } =
      ehVideo ? await medirVideo(file) : await medirImagem(file);
    const check = ehVideo
      ? validateVideo({ type: file.type, size: file.size, ...medidas })
      : validatePhoto({ type: file.type, size: file.size, ...medidas });

    if (!check.ok) {
      // Limpa o campo junto com o aviso: com o nome do arquivo ainda na tela,
      // o recusado parecia aceito, e o dono ficava esperando ele aparecer.
      if (input.current) input.current.value = "";
      return setErro(check.errors.join(" "));
    }
    setAvisos(check.warnings);

    setEnviando(true);
    try {
      const r = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dishId, tipo: ehVideo ? "video" : "foto", contentType: file.type }),
      });
      const { uploadUrl, token, path, publicUrl } = (await r.json()) as {
        uploadUrl?: string; token?: string; path?: string; publicUrl?: string; erro?: string;
      };
      if (!uploadUrl || !publicUrl) throw new Error("upload não autorizado");

      const envio = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: file,
      });
      if (!envio.ok) throw new Error("falha no envio");

      await registrarMidia({
        dishId,
        tipo: ehVideo ? "video" : "foto",
        url: publicUrl,
        posterUrl: ehVideo ? publicUrl : null,
        duracaoS: medidas.durationSeconds ?? null,
      });
      if (input.current) input.current.value = "";
      void path;
    } catch {
      setErro("Não deu para enviar. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="midia-bloco">
      <p className="editor-form__secao">
        Fotos e vídeo
        {/* O dono precisa saber disto ANTES de procurar um botão de salvar. */}
        <span className="selo-auto">grava sozinho</span>
      </p>

      {midias.length > 0 ? (
        <div className="midia-lista">
          {midias.map((m, i) => (
            <div className="midia-item" key={m.id}>
              <img src={m.tipo === "video" ? m.poster_url ?? m.url : m.url} alt="" />
              {m.tipo === "video" ? <span className="midia-item__selo">vídeo</span> : null}
              <span className="midia-item__acoes">
                {(["cima", "baixo"] as const).map((dir) => (
                  <form action={moverMidia} key={dir}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="dish_id" value={dishId} />
                    <input type="hidden" name="direcao" value={dir} />
                    <button
                      type="submit"
                      className="bt bt--mini"
                      disabled={dir === "cima" ? i === 0 : i === midias.length - 1}
                      aria-label={dir === "cima" ? "Antes" : "Depois"}
                    >
                      {dir === "cima" ? "←" : "→"}
                    </button>
                  </form>
                ))}
                <form action={excluirMidia}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="bt bt--mini bt--perigo" aria-label="Remover">✕</button>
                </form>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="contagem">
        {midias.length > 0
          ? "Já no cardápio. A primeira imagem é a capa do item; use as setas para reordenar."
          : "O que você enviar aqui entra no cardápio na hora."}
      </p>

      <input
        ref={input}
        className="campo"
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        disabled={enviando}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />
      <p className="contagem">
        Vídeo vertical de até {MAX_VIDEO_SECONDS}s e {Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.
        Foto de até {Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB.
      </p>
      {enviando ? <p className="contagem">Enviando…</p> : null}
      {erro ? <p className="contagem contagem--curta">{erro}</p> : null}
      {avisos.map((a) => (
        <p className="contagem contagem--curta" key={a}>{a}</p>
      ))}
    </div>
  );
}

function medirVideo(file: File): Promise<{ durationSeconds?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve({ durationSeconds: el.duration, width: el.videoWidth, height: el.videoHeight });
      URL.revokeObjectURL(el.src);
    };
    el.onerror = () => resolve({});
    el.src = URL.createObjectURL(file);
  });
}

function medirImagem(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({});
    img.src = URL.createObjectURL(file);
  });
}
