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
  alvo, nome, valorAtual, rotulo, dica, escuroAtual = false,
}: {
  alvo: "capa" | "logo";
  /** Nome do campo no formulário que recebe a URL. */
  nome: string;
  valorAtual: string;
  rotulo: string;
  dica: string;
  /** Só para o logo: se a arte é escura demais para a capa. */
  escuroAtual?: boolean;
}) {
  const [url, setUrl] = useState(valorAtual);
  const [escuro, setEscuro] = useState(escuroAtual);
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
      if (alvo === "logo") setEscuro(await ehEscuro(file));
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
      {alvo === "logo" ? <input type="hidden" name="logo_escuro" value={escuro ? "true" : "false"} /> : null}

      {alvo === "logo" && url && escuro ? (
        <p className="contagem">
          Logo escuro — feito para papel branco. Na capa do cardápio, que é escura, ele ganha uma
          placa clara atrás para continuar legível. Se tiver uma versão em branco, ela fica melhor.
        </p>
      ) : null}

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

/**
 * O logo é escuro demais para fundo escuro?
 *
 * Mede só os pixels que aparecem — ignorar o transparente é o ponto, porque um
 * PNG de logo é quase todo transparente e a média do arquivo inteiro não diria
 * nada. Lido uma vez, no envio: ler a imagem a cada carregamento do cardápio
 * custaria no celular do cliente e faria a logo piscar.
 */
function ehEscuro(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const n = 64;
        const cv = document.createElement("canvas");
        cv.width = n; cv.height = n;
        const ctx = cv.getContext("2d");
        if (!ctx) return resolve(false);
        ctx.drawImage(img, 0, 0, n, n);
        const { data } = ctx.getImageData(0, 0, n, n);
        let soma = 0, vistos = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3]! < 40) continue; // transparente não conta
          soma += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
          vistos++;
        }
        resolve(vistos > 0 && soma / vistos < 110);
      } catch {
        resolve(false);
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };
    img.onerror = () => resolve(false);
    img.src = URL.createObjectURL(file);
  });
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
