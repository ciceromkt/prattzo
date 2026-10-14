"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RECORTE_ALTURA, RECORTE_LARGURA } from "@prattzo/core";

/**
 * O dono escolhe o enquadramento da foto, em vez de o cardápio escolher por ele.
 *
 * O problema que isto resolve: a foto de restaurante chega deitada, quase
 * sempre, e a tela do prato é a tela do celular inteira, em pé. Encaixar uma na
 * outra por conta própria (o `object-fit: cover` do navegador) é cortar pelo
 * centro — e o centro de uma foto deitada de mesa posta costuma ser o arroz, a
 * borda do prato ou o garfo. Foi assim que a picanha virou uma foto de risoto.
 *
 * Duas saídas, e as duas ficam a um toque:
 *
 * - PREENCHER: a foto ocupa a tela toda e o dono arrasta até o pedaço certo.
 *   É o que já acontecia, com a diferença de que agora quem escolhe é ele.
 * - MOSTRAR TUDO: a foto inteira cabe, e as sobras viram um fundo desfocado da
 *   própria foto. Para prato deitado que não sobrevive a corte nenhum, é a
 *   única resposta honesta — melhor a foto inteira com moldura do que meio
 *   prato em tela cheia.
 *
 * O recorte é feito aqui no navegador e o que sobe é só o resultado: nada de
 * guardar coordenadas para a tela do cliente ter que aplicar depois.
 */
export function RecorteFoto({
  src, remoto = false, titulo = "Enquadrar foto", onPronto, onCancelar,
}: {
  src: string;
  /** Foto que já está no Storage: precisa de crossOrigin para entrar no canvas. */
  remoto?: boolean;
  titulo?: string;
  onPronto: (blob: Blob) => void;
  onCancelar: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [quadro, setQuadro] = useState({ w: 0, h: 0 });
  const [escala, setEscala] = useState(1);
  /** Ponto da foto (em pixels dela) que fica no centro do quadro. */
  const [centro, setCentro] = useState({ x: 0, y: 0 });
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement | null>(null);
  const arrasto = useRef<{ px: number; py: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    if (remoto) el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.onerror = () => setErro("Não deu para abrir esta foto para recortar.");
    el.src = src;
    return () => { el.onload = null; el.onerror = null; };
  }, [src, remoto]);

  // O quadro é medido, não suposto: ele muda com a altura da janela.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setQuadro({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [img]);

  const preencher = img && quadro.w ? Math.max(quadro.w / img.naturalWidth, quadro.h / img.naturalHeight) : 1;
  const inteira = img && quadro.w ? Math.min(quadro.w / img.naturalWidth, quadro.h / img.naturalHeight) : 1;

  // Começa preenchendo e centralizado: é exatamente o que a tela faz hoje, então
  // confirmar sem mexer em nada devolve a foto como ela já estava.
  useEffect(() => {
    if (!img || !quadro.w) return;
    setEscala(preencher);
    setCentro({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
  }, [img, quadro.w, quadro.h, preencher]);

  /** Não deixa sobrar buraco: com a foto maior que o quadro, ela cobre sempre. */
  const limitar = useCallback(
    (x: number, y: number, e: number) => {
      if (!img) return { x, y };
      const meiaW = quadro.w / 2 / e;
      const meiaH = quadro.h / 2 / e;
      return {
        x: img.naturalWidth >= meiaW * 2
          ? Math.min(Math.max(x, meiaW), img.naturalWidth - meiaW)
          : img.naturalWidth / 2,
        y: img.naturalHeight >= meiaH * 2
          ? Math.min(Math.max(y, meiaH), img.naturalHeight - meiaH)
          : img.naturalHeight / 2,
      };
    },
    [img, quadro.w, quadro.h],
  );

  const mover = (dx: number, dy: number) => {
    setCentro((c) => limitar(c.x - dx / escala, c.y - dy / escala, escala));
  };

  const trocarEscala = (nova: number) => {
    setEscala(nova);
    setCentro((c) => limitar(c.x, c.y, nova));
  };

  /**
   * Desenha o que o quadro mostra, no tamanho que o celular do cliente usa.
   *
   * O fundo desfocado é desenhado SEMPRE, por baixo: quando a foto preenche, ele
   * fica escondido atrás dela e não custa nada; quando ela não preenche, é ele
   * que ocupa as sobras. Uma passagem só, sem caso especial para errar.
   */
  const confirmar = () => {
    if (!img) return;
    setOcupado(true);
    try {
      // Nunca aumenta a foto: se o pedaço visível for menor que 1080, sai menor.
      const visivelW = quadro.w / escala;
      const largura = Math.max(320, Math.min(RECORTE_LARGURA, Math.round(visivelW)));
      const altura = Math.round((largura * RECORTE_ALTURA) / RECORTE_LARGURA);

      const cv = document.createElement("canvas");
      cv.width = largura;
      cv.height = altura;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("sem canvas");

      const cobre = Math.max(largura / img.naturalWidth, altura / img.naturalHeight);
      ctx.filter = `blur(${Math.max(8, Math.round(largura / 24))}px)`;
      ctx.drawImage(
        img,
        largura / 2 - (img.naturalWidth * cobre) / 2,
        altura / 2 - (img.naturalHeight * cobre) / 2,
        img.naturalWidth * cobre,
        img.naturalHeight * cobre,
      );
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(0, 0, largura, altura);

      const k = largura / visivelW;
      ctx.drawImage(
        img,
        largura / 2 - centro.x * k,
        altura / 2 - centro.y * k,
        img.naturalWidth * k,
        img.naturalHeight * k,
      );

      cv.toBlob(
        (blob) => {
          setOcupado(false);
          if (blob) onPronto(blob);
          else setErro("Não deu para gerar a foto recortada.");
        },
        "image/jpeg",
        0.88,
      );
    } catch {
      setOcupado(false);
      setErro("Não deu para recortar aqui. Envie a foto já cortada em 9:16.");
    }
  };

  const estiloFoto = img && quadro.w
    ? {
        width: img.naturalWidth * escala,
        height: img.naturalHeight * escala,
        left: quadro.w / 2 - centro.x * escala,
        top: quadro.h / 2 - centro.y * escala,
      }
    : undefined;

  const cabeTudo = Math.abs(escala - inteira) < 0.001;
  /**
   * Quantos pixels da foto original cabem no quadro. Aproximar demais numa foto
   * pequena entrega uma imagem borrada na tela do cliente, e o dono não tem
   * como saber disso olhando a prévia de 300px no computador dele — aqui, sim.
   */
  const pixelsVisiveis = img && quadro.w ? Math.round(quadro.w / escala) : 0;
  const borrada = pixelsVisiveis > 0 && pixelsVisiveis < 720;

  return (
    <div className="recorte" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="recorte__painel">
        <div className="recorte__cabeca">
          <p className="editor-form__secao">{titulo}</p>
          <button type="button" className="bt bt--mini" onClick={onCancelar}>Cancelar</button>
        </div>

        <div
          className="recorte__quadro"
          ref={caixa}
          onPointerDown={(e) => {
            arrasto.current = { px: e.clientX, py: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!arrasto.current) return;
            mover(e.clientX - arrasto.current.px, e.clientY - arrasto.current.py);
            arrasto.current = { px: e.clientX, py: e.clientY };
          }}
          onPointerUp={() => { arrasto.current = null; }}
          onPointerCancel={() => { arrasto.current = null; }}
        >
          {img ? (
            <>
              {/* O mesmo fundo que vai para o arquivo, para o dono ver antes. */}
              <img className="recorte__fundo" src={src} alt="" style={estiloFotoFundo(quadro, img)} />
              <img className="recorte__foto" src={src} alt="" style={estiloFoto} draggable={false} />
            </>
          ) : (
            <p className="recorte__carregando">{erro ?? "Abrindo a foto…"}</p>
          )}
          <span className="recorte__guia" aria-hidden="true" />
        </div>

        <p className="contagem recorte__dica">
          É assim que o cliente vê, na tela inteira do celular. Arraste a foto para escolher o pedaço.
        </p>

        <div className="recorte__controles">
          <input
            type="range"
            className="recorte__zoom"
            min={inteira}
            max={preencher * 3}
            step={(preencher * 3 - inteira) / 200 || 0.001}
            value={escala}
            onChange={(e) => trocarEscala(Number(e.target.value))}
            aria-label="Aproximar ou afastar"
            disabled={!img}
          />
          <div className="linha-acoes">
            <button
              type="button"
              className={`bt bt--mini${!cabeTudo ? " bt--ouro" : ""}`}
              onClick={() => trocarEscala(preencher)}
              disabled={!img}
            >
              Preencher
            </button>
            <button
              type="button"
              className={`bt bt--mini${cabeTudo ? " bt--ouro" : ""}`}
              onClick={() => trocarEscala(inteira)}
              disabled={!img}
            >
              Mostrar tudo
            </button>
          </div>
        </div>

        {cabeTudo ? (
          <p className="contagem">
            A foto inteira cabe e as sobras viram um fundo desfocado dela mesma. Boa saída para foto
            deitada que não sobrevive a corte.
          </p>
        ) : null}
        {borrada ? (
          <p className="contagem contagem--curta">
            Aproximado demais: só {pixelsVisiveis}px da foto original cabem no quadro, e isso fica
            borrado na tela do cliente. Afaste um pouco, ou use uma foto maior.
          </p>
        ) : null}
        {erro && img ? <p className="contagem contagem--curta">{erro}</p> : null}

        <div className="recorte__pe">
          <button type="button" className="bt bt--ouro" onClick={confirmar} disabled={!img || ocupado}>
            {ocupado ? "Preparando…" : "Usar este enquadramento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** O fundo desfocado da prévia: sempre cobrindo o quadro, atrás da foto. */
function estiloFotoFundo(quadro: { w: number; h: number }, img: HTMLImageElement) {
  if (!quadro.w) return undefined;
  const cobre = Math.max(quadro.w / img.naturalWidth, quadro.h / img.naturalHeight);
  return {
    width: img.naturalWidth * cobre,
    height: img.naturalHeight * cobre,
    left: quadro.w / 2 - (img.naturalWidth * cobre) / 2,
    top: quadro.h / 2 - (img.naturalHeight * cobre) / 2,
  };
}
