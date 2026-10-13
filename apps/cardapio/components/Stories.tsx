"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, MenuGroup } from "@pede-esse/core";
import { capaDoPrato, estaEsgotado, priceLabel, videoDoPrato } from "@pede-esse/core";
import { DUR_SEM_VIDEO } from "@pede-esse/ui";
import { Regua } from "./Regua";
import { track } from "@/lib/track";

const ICONE_CURTIR = (
  <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4l1.4 1.4L12 21.3l7.4-7.5 1.4-1.4a5.2 5.2 0 0 0 0-7.4Z" />
  </svg>
);

const ICONE_COMPARTILHAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V3m0 0L8 7m4-4 4 4M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
  </svg>
);

interface Props {
  grupos: MenuGroup[];
  fila: Dish[];
  idx: number;
  pedido: Record<string, number>;
  favoritos: Record<string, boolean>;
  restaurantId: string;
  onIdx: (i: number) => void;
  onFechar: () => void;
  onLista: (catId: string) => void;
  onCategoria: (g: MenuGroup) => void;
  onQuero: (p: Dish) => void;
  onFavoritar: (p: Dish) => void;
  onCompartilhar: (p: Dish) => void;
}

export function Stories({
  grupos, fila, idx, pedido, favoritos, restaurantId,
  onIdx, onFechar, onLista, onCategoria, onQuero, onFavoritar, onCompartilhar,
}: Props) {
  const [pausado, setPausado] = useState(false);
  const [som, setSom] = useState(false);
  const [aberto, setAberto] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrou = useRef<number>(Date.now());

  const prato = fila[idx];
  const video = prato ? videoDoPrato(prato) : null;
  const capa = prato ? capaDoPrato(prato) : null;
  const esgotado = prato ? estaEsgotado(prato) : false;
  const noPedido = prato ? pedido[prato.id] ?? 0 : 0;
  const curtido = prato ? Boolean(favoritos[prato.id]) : false;
  const categoria = grupos.find((g) => g.categoria.id === prato?.category_id)?.categoria;

  const avancar = (passo: number) => {
    const proximo = idx + passo;
    if (proximo < 0) return;
    if (proximo >= fila.length) return onFechar();
    onIdx(proximo);
  };

  // Mede quanto tempo o prato prendeu — é o número que diz se o vídeo funciona.
  useEffect(() => {
    if (!prato) return;
    entrou.current = Date.now();
    setAberto(false);
    return () => {
      track({ restaurantId, tipo: "viu_prato", dishId: prato.id, ms: Date.now() - entrou.current });
    };
  }, [prato, restaurantId]);

  // Item sem vídeo avança sozinho; com vídeo, quem manda é o fim do vídeo.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!prato || pausado || video) return;
    timer.current = setTimeout(() => avancar(1), DUR_SEM_VIDEO * 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prato, pausado, video]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !som;
    if (pausado) el.pause();
    else void el.play().catch(() => undefined);
  }, [pausado, som, prato]);

  if (!prato) return null;
  const dur = video?.duracao_s ?? DUR_SEM_VIDEO;
  const temDesc = prato.descricao.length > 0;
  const primeiro = idx === 0 && fila.length > 1;

  return (
    <div className={`stories${pausado ? " stories--pausado" : ""}`}>
      <div className="stories__palco">
        {video ? (
          <video
            ref={videoRef}
            key={video.id}
            className="stories__video"
            src={video.url}
            poster={video.poster_url ?? undefined}
            playsInline
            autoPlay
            preload="auto"
            onEnded={() => avancar(1)}
            aria-label={`Vídeo: ${prato.nome}`}
          />
        ) : capa ? (
          <img className="stories__foto" src={capa} alt={prato.nome} />
        ) : (
          <div className="stories__sem-midia" />
        )}

        <span className="stories__sombra-topo" />
        <span className="stories__sombra-base" />

        <div className="stories__toque">
          <button type="button" onClick={() => avancar(-1)} aria-label="Anterior" />
          <button type="button" onClick={() => avancar(1)} aria-label="Próximo" />
        </div>

        <div className="stories__topo">
          <button type="button" className="redondo" onClick={onFechar} aria-label="Voltar">←</button>
          <button type="button" className="chip" onClick={() => onLista(prato.category_id ?? "")}>☰ Ver lista</button>
        </div>

        <Regua grupos={grupos} ativa={prato.category_id} onTrocar={(g) => onCategoria(g)} />

        <div className="stories__barras">
          {fila.map((p, i) => (
            <span
              key={p.id}
              className={`barra${i === idx ? " barra--ativa" : i < idx ? " barra--vista" : ""}`}
              style={{ ["--dur" as string]: `${dur}s` }}
            >
              <span />
            </span>
          ))}
          <button
            type="button"
            className="barra-pausa"
            onClick={() => setPausado((p) => !p)}
            aria-label={pausado ? "Continuar" : "Pausar"}
          >
            {pausado ? "▶" : "❚❚"}
          </button>
          {video ? (
            <button
              type="button"
              className="barra-pausa"
              onClick={() => setSom((s) => !s)}
              aria-label={som ? "Desativar som" : "Ativar som"}
            >
              {som ? "🔊" : "🔇"}
            </button>
          ) : null}
        </div>

        {/* A primeira vez não é óbvia: o cliente não sabe que dá para tocar e avançar. */}
        {primeiro ? (
          <span className="dica-avancar" aria-hidden="true">
            <span>›</span>
            toque para avançar
          </span>
        ) : null}

        <div className="ficha">
          <div className="ficha__topo">
            <span className="ficha__id">
              {categoria ? <span className="ficha__cat">{categoria.nome}</span> : null}
              <h2 className="ficha__nome">{prato.nome}</h2>
              {/* O preço fica junto do nome: faixa longa não cabe na linha das ações. */}
              <span className={`ficha__preco${prato.preco_min_centavos > 0 ? "" : " ficha__preco--vazio"}`}>
                {priceLabel(prato)}
              </span>
            </span>
            <button type="button" className="ficha__fechar" onClick={onFechar} aria-label="Fechar">✕</button>
          </div>

          {temDesc ? (
            <p className={`ficha__desc${aberto ? " ficha__desc--aberta" : ""}`}>{prato.descricao}</p>
          ) : null}
          {temDesc && prato.descricao.length > 115 ? (
            <button type="button" className="ficha__mais" onClick={() => setAberto((a) => !a)}>
              {aberto ? "Ver menos" : "Ler tudo"}
            </button>
          ) : null}
          {!video && !capa ? <span className="sem-video-aviso">Ainda sem foto nem vídeo</span> : null}

          <div className="barra-acoes">
            {esgotado ? (
              <span className="selo-esgotado">Esgotado hoje</span>
            ) : (
              <button
                type="button"
                className={`cta-quero${noPedido ? " cta-quero--feito" : ""}`}
                onClick={() => onQuero(prato)}
              >
                {noPedido ? `✓ ${noPedido} no pedido · add` : "Quero esse"}
              </button>
            )}
            <button
              type="button"
              className={`acao${curtido ? " acao--ativa" : ""}`}
              onClick={() => onFavoritar(prato)}
              aria-pressed={curtido}
              aria-label={curtido ? "Tirar dos favoritos" : "Favoritar este prato"}
            >
              {ICONE_CURTIR}
            </button>
            {/* Compartilha o PRATO, não o cardápio: o vídeo abre direto no amigo. */}
            <button
              type="button"
              className="acao"
              onClick={() => onCompartilhar(prato)}
              aria-label="Enviar este prato"
            >
              {ICONE_COMPARTILHAR}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
