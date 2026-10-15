"use client";

import { useRef, useState } from "react";
import type { MediaItem } from "@prattzo/core";
import {
  MAX_FOTO_ESCOLHIDA_BYTES, MAX_VIDEO_BYTES, VIDEO_SEGUNDOS_EXIBIDOS, validatePhoto, validateVideo,
} from "@prattzo/core";
import { excluirMidia, moverMidia, registrarMidia, substituirMidia } from "@/lib/actions";
import { RecorteFoto } from "./RecorteFoto";

/** O que está aberto na tela de recorte: foto nova ou foto que já está no ar. */
type EmRecorte =
  | { modo: "nova"; src: string; arquivo: File }
  | { modo: "trocar"; src: string; midiaId: string };

/**
 * Envia direto do navegador para o Storage, por URL assinada: o arquivo não
 * passa pelo servidor do painel. Vídeo é validado antes (vertical, até 15s).
 */
export function UploadMidia({ dishId, midias }: { dishId: string; midias: MediaItem[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState<null | "foto" | "video">(null);
  const [progresso, setProgresso] = useState(0);
  const [feito, setFeito] = useState<string | null>(null);
  const [recorte, setRecorte] = useState<EmRecorte | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  /**
   * Sobe um arquivo para o Storage e devolve a URL pública.
   *
   * Vai por XMLHttpRequest, e não por fetch, só por causa de uma coisa: ele
   * avisa quanto já subiu. Um vídeo de 18 MB no wi-fi do salão leva perto de um
   * minuto, e sem o número na tela o dono acha que não funcionou e tenta de
   * novo no meio do caminho — foi exatamente o que aconteceu.
   */
  function subir(corpo: Blob, tipo: "foto" | "video", contentType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      void (async () => {
        const r = await fetch("/api/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dishId, tipo, contentType }),
        });
        const { uploadUrl, token, publicUrl } = (await r.json()) as {
          uploadUrl?: string; token?: string; publicUrl?: string; erro?: string;
        };
        if (!uploadUrl || !publicUrl) return reject(new Error("upload não autorizado"));

        const req = new XMLHttpRequest();
        req.open("PUT", uploadUrl);
        req.setRequestHeader("content-type", contentType);
        if (token) req.setRequestHeader("authorization", `Bearer ${token}`);
        req.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgresso(Math.round((e.loaded / e.total) * 100));
        };
        req.onload = () => (req.status >= 200 && req.status < 300
          ? resolve(publicUrl)
          : reject(new Error(`falha no envio (${req.status})`)));
        req.onerror = () => reject(new Error("falha de rede"));
        req.send(corpo);
      })().catch(reject);
    });
  }

  async function escolher(file: File) {
    setErro(null);
    setAvisos([]);
    setFeito(null);
    const ehVideo = file.type.startsWith("video/");

    const medidas: { durationSeconds?: number; width?: number; height?: number } =
      ehVideo ? await medirVideo(file) : await medirImagem(file);
    const check = ehVideo
      ? validateVideo({ type: file.type, size: file.size, ...medidas }, { exibidoAte: VIDEO_SEGUNDOS_EXIBIDOS })
      : validatePhoto({ type: file.type, size: file.size, ...medidas },
          { maxBytes: MAX_FOTO_ESCOLHIDA_BYTES });

    if (!check.ok) {
      // Limpa o campo junto com o aviso: com o nome do arquivo ainda na tela,
      // o recusado parecia aceito, e o dono ficava esperando ele aparecer.
      if (input.current) input.current.value = "";
      return setErro(check.errors.join(" "));
    }
    setAvisos(check.warnings);

    // Foto passa pelo enquadramento antes de subir; vídeo vai direto, porque
    // cortar vídeo no navegador do dono é outra conversa.
    if (ehVideo) return enviarVideo(file, medidas.durationSeconds ?? null);
    setRecorte({ modo: "nova", src: URL.createObjectURL(file), arquivo: file });
  }

  async function enviarVideo(file: File, duracaoS: number | null) {
    setEnviando("video");
    setProgresso(0);
    try {
      const publicUrl = await subir(file, "video", file.type);
      const ok = await registrarMidia({
        dishId, tipo: "video", url: publicUrl, posterUrl: publicUrl, duracaoS,
      });
      if (!ok.ok) throw new Error("não gravou");
      if (input.current) input.current.value = "";
      setFeito("Vídeo no cardápio.");
    } catch {
      setErro("Não deu para enviar. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  /** Volta do recorte com a foto já no enquadramento escolhido. */
  async function receberRecorte(blob: Blob) {
    const alvo = recorte;
    setRecorte(null);
    if (alvo?.modo === "nova") URL.revokeObjectURL(alvo.src);
    if (!alvo) return;

    setEnviando("foto");
    setProgresso(0);
    try {
      const publicUrl = await subir(blob, "foto", "image/jpeg");
      const ok = alvo.modo === "nova"
        ? await registrarMidia({ dishId, tipo: "foto", url: publicUrl, posterUrl: null, duracaoS: null })
        : await substituirMidia({ id: alvo.midiaId, url: publicUrl });
      if (!ok.ok) throw new Error("não gravou");
      if (input.current) input.current.value = "";
      setFeito(alvo.modo === "nova" ? "Foto no cardápio." : "Foto reenquadrada.");
    } catch {
      setErro("Não deu para enviar. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(null);
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
                {/* Reenquadrar o que já está no ar: as fotos antigas entraram
                    com o corte automático, e recadastrar jogaria a capa do
                    prato para o fim da fila. */}
                {m.tipo === "foto" ? (
                  <button
                    type="button"
                    className="bt bt--mini"
                    onClick={() => setRecorte({ modo: "trocar", src: m.url, midiaId: m.id })}
                    aria-label="Reenquadrar esta foto"
                  >
                    ⤢
                  </button>
                ) : null}
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
        disabled={Boolean(enviando)}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void escolher(f);
        }}
      />
      <p className="contagem">
        Vídeo vertical até {Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB — o cardápio mostra os
        primeiros {VIDEO_SEGUNDOS_EXIBIDOS}s. Foto direto do celular serve: você escolhe o
        enquadramento e ela sobe já reduzida.
      </p>

      {/* O vídeo do salão leva perto de um minuto no wi-fi de lá. Sem a barra o
          dono achava que não tinha funcionado e tentava de novo no meio. */}
      {enviando ? (
        <div className="envio" role="status">
          <p className="contagem">
            Enviando {enviando === "video" ? "o vídeo" : "a foto"}… {progresso}%
            {progresso >= 100 ? " — gravando no cardápio" : null}
          </p>
          <span className="envio__trilho"><span className="envio__barra" style={{ width: `${progresso}%` }} /></span>
        </div>
      ) : null}
      {feito && !enviando ? <p className="contagem contagem--ok">✓ {feito}</p> : null}
      {erro ? <p className="contagem contagem--curta">{erro}</p> : null}
      {avisos.map((a) => (
        <p className="contagem contagem--curta" key={a}>{a}</p>
      ))}

      {recorte ? (
        <RecorteFoto
          src={recorte.src}
          remoto={recorte.modo === "trocar"}
          titulo={recorte.modo === "trocar" ? "Reenquadrar foto" : "Enquadrar foto"}
          onPronto={(blob) => void receberRecorte(blob)}
          onCancelar={() => {
            if (recorte.modo === "nova") URL.revokeObjectURL(recorte.src);
            setRecorte(null);
            if (input.current) input.current.value = "";
          }}
        />
      ) : null}
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
