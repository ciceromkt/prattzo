"use client";

import { useRef, useState } from "react";
import {
  MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, validatePhoto, validateVideo,
} from "@prattzo/core";

/**
 * Enviar um arquivo do computador e sair com uma URL hospedada.
 *
 * Antes isto era um campo de texto pedindo uma URL, o que empurrava o problema
 * para o dono do restaurante: ele teria que hospedar o vídeo em algum lugar e
 * colar o endereço. Aqui ele escolhe o arquivo e acabou — o campo escondido é
 * preenchido sozinho e vai junto no "Salvar" do formulário.
 */
export function UploadCasa({
  alvo, nome, valorAtual, rotulo, dica,
}: {
  alvo: "capa" | "logo";
  /** Nome do campo no formulário que recebe a URL. */
  nome: string;
  valorAtual: string;
  rotulo: string;
  dica: string;
}) {
  const [url, setUrl] = useState(valorAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  async function enviar(file: File) {
    setErro(null);
    setAvisos([]);
    const ehVideo = file.type.startsWith("video/");

    const medidas = ehVideo ? await medirVideo(file) : await medirImagem(file);
    const check = ehVideo
      ? validateVideo({ type: file.type, size: file.size, ...medidas })
      : validatePhoto({ type: file.type, size: file.size, ...medidas });
    if (!check.ok) return setErro(check.errors.join(" "));
    // O aviso de "não é vertical" vale para o vídeo do prato, que ocupa a tela
    // inteira. A capa é fundo atrás do nome da casa, recortado: avisar ali
    // seria alarme falso.
    setAvisos(alvo === "capa" ? [] : check.warnings);

    setEnviando(true);
    try {
      const r = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alvo, contentType: file.type }),
      });
      const { uploadUrl, token, publicUrl, erro: msg } = (await r.json()) as {
        uploadUrl?: string; token?: string; publicUrl?: string; erro?: string;
      };
      if (!uploadUrl || !publicUrl) throw new Error(msg ?? "upload não autorizado");

      const envio = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: file,
      });
      if (!envio.ok) throw new Error("falha no envio");

      setUrl(publicUrl);
      if (input.current) input.current.value = "";
    } catch {
      setErro("Não deu para enviar. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="campo-grupo">
      <span className="campo-rotulo">{rotulo}</span>

      {url ? (
        <div className="previa-casa">
          {alvo === "capa"
            ? <video className="previa-casa__midia" src={url} muted playsInline preload="metadata" />
            : <img className="previa-casa__midia previa-casa__midia--logo" src={url} alt="" />}
          <div className="previa-casa__acoes">
            <span className="contagem">Enviado e hospedado.</span>
            <button type="button" className="bt bt--mini bt--perigo" onClick={() => setUrl("")}>
              Remover
            </button>
          </div>
        </div>
      ) : null}

      {/* O formulário salva a URL; o dono nunca precisa vê-la nem digitá-la. */}
      <input type="hidden" name={nome} value={url} />

      <input
        ref={input}
        className="campo"
        type="file"
        accept={alvo === "capa"
          ? "video/mp4,video/quicktime,video/webm"
          : "image/jpeg,image/png,image/webp"}
        disabled={enviando}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
        }}
      />

      <p className="contagem">
        {dica}{" "}
        {alvo === "capa"
          ? `Até ${MAX_VIDEO_SECONDS}s e ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB.`
          : `Até ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB.`}
      </p>

      {enviando ? <p className="contagem">Enviando…</p> : null}
      {erro ? <p className="contagem contagem--curta">{erro}</p> : null}
      {avisos.map((a) => <p className="contagem contagem--curta" key={a}>{a}</p>)}
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
