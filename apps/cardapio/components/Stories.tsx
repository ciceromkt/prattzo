"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dish, MenuGroup, ParCategoria, ParPrato } from "@prattzo/core";
import {
  capaDoPrato, estaEsgotado, harmonizacoes, midiasDoPrato, priceLabel,
} from "@prattzo/core";
import { DUR_SEM_VIDEO } from "@prattzo/ui";
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
  paresPrato: ParPrato[];
  paresCategoria: ParCategoria[];
  onIdx: (i: number) => void;
  onFechar: () => void;
  onLista: (catId: string) => void;
  onCategoria: (g: MenuGroup) => void;
  onQuero: (p: Dish) => void;
  onFavoritar: (p: Dish) => void;
  onCompartilhar: (p: Dish) => void;
  /** Abrir o par harmonizado: o cliente vai ver o vídeo do vinho, não um texto. */
  onAbrirPar: (p: Dish) => void;
  onQueroPar: (p: Dish) => void;
}

export function Stories({
  grupos, fila, idx, pedido, favoritos, restaurantId, paresPrato, paresCategoria,
  onIdx, onFechar, onLista, onCategoria, onQuero, onFavoritar, onCompartilhar,
  onAbrirPar, onQueroPar,
}: Props) {
  const [pausado, setPausado] = useState(false);
  const [som, setSom] = useState(false);
  const [aberto, setAberto] = useState(false);
  /** Qual mídia DESTE prato está no palco. Zera a cada prato novo. */
  const [iMidia, setIMidia] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrou = useRef<number>(Date.now());

  const prato = fila[idx];
  const midias = useMemo(() => (prato ? midiasDoPrato(prato) : []), [prato]);
  const atual = midias[Math.min(iMidia, Math.max(0, midias.length - 1))] ?? null;
  const esgotado = prato ? estaEsgotado(prato) : false;
  const noPedido = prato ? pedido[prato.id] ?? 0 : 0;
  const curtido = prato ? Boolean(favoritos[prato.id]) : false;
  const categoria = grupos.find((g) => g.categoria.id === prato?.category_id)?.categoria;

  const pares = useMemo(
    () => (prato ? harmonizacoes({ grupos, prato, paresPrato, paresCategoria, pedido, max: 3 }) : []),
    [grupos, prato, paresPrato, paresCategoria, pedido],
  );

  /**
   * Um toque anda uma MÍDIA, não um prato.
   *
   * A picanha tem quatro fotos e um vídeo: antes o cliente via uma e passava
   * direto para o item seguinte, e as outras três só existiam no banco. Agora o
   * prato é percorrido por dentro primeiro e só então a fila avança — é o gesto
   * que todo mundo já traz de casa, sem nada novo para aprender.
   */
  const avancar = (passo: number) => {
    if (passo > 0 && iMidia + 1 < midias.length) return setIMidia(iMidia + 1);
    if (passo < 0 && iMidia > 0) return setIMidia(iMidia - 1);
    const proximo = idx + passo;
    if (proximo < 0) return;
    if (proximo >= fila.length) return onFechar();
    setIMidia(0);
    onIdx(proximo);
  };

  // Mede quanto tempo o prato prendeu — é o número que diz se o vídeo funciona.
  useEffect(() => {
    if (!prato) return;
    entrou.current = Date.now();
    setAberto(false);
    setIMidia(0);
    return () => {
      track({ restaurantId, tipo: "viu_prato", dishId: prato.id, ms: Date.now() - entrou.current });
    };
  }, [prato, restaurantId]);

  /**
   * A harmonização é oferta, e oferta se mede: o mesmo par de eventos da
   * sugestão de fechamento serve aqui, e o painel já sabe contá-los.
   */
  useEffect(() => {
    if (!prato || pares.length === 0) return;
    track({ restaurantId, tipo: "viu_sugestao", dishId: prato.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prato?.id, pares.length > 0]);

  // Foto avança sozinha; vídeo, quem manda é o fim dele. Lendo os detalhes,
  // nada avança: o cliente está no meio de uma frase.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!prato || pausado || aberto || atual?.tipo === "video") return;
    timer.current = setTimeout(() => avancar(1), DUR_SEM_VIDEO * 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prato, pausado, aberto, atual]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !som;
    if (pausado || aberto) el.pause();
    else void el.play().catch(() => undefined);
  }, [pausado, som, aberto, atual]);

  if (!prato) return null;
  const dur = atual?.tipo === "video" ? atual.duracao_s ?? DUR_SEM_VIDEO : DUR_SEM_VIDEO;
  const temDesc = prato.descricao.length > 0;
  const temDetalhe = prato.ingredientes.length > 0 || prato.serve.length > 0 || prato.descricao.length > 92;
  const primeiro = idx === 0 && iMidia === 0 && fila.length > 1;
  const n = Math.max(1, midias.length);

  return (
    <div className={`stories${pausado ? " stories--pausado" : ""}`}>
      <div className="stories__palco">
        {atual?.tipo === "video" ? (
          <video
            ref={videoRef}
            key={atual.id}
            className="stories__video"
            src={atual.url}
            poster={atual.poster_url ?? undefined}
            playsInline
            autoPlay
            preload="auto"
            onEnded={() => avancar(1)}
            aria-label={`Vídeo: ${prato.nome}`}
          />
        ) : atual ? (
          <img className="stories__foto" key={atual.id} src={atual.url} alt={prato.nome} />
        ) : capaDoPrato(prato) ? (
          <img className="stories__foto" src={capaDoPrato(prato)!} alt={prato.nome} />
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
              style={i === idx
                // A barra do prato é dividida entre as mídias dele: o traço
                // continua de onde parou em vez de reiniciar a cada foto, que
                // na tela parecia defeito.
                ? {
                    ["--dur" as string]: `${dur}s`,
                    ["--de" as string]: `${(iMidia / n) * 100}%`,
                    ["--ate" as string]: `${((iMidia + 1) / n) * 100}%`,
                  }
                : undefined}
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
          {atual?.tipo === "video" ? (
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
                {prato.serve ? <small className="ficha__serve">{prato.serve}</small> : null}
              </span>
            </span>
            <button type="button" className="ficha__fechar" onClick={onFechar} aria-label="Fechar">✕</button>
          </div>

          {midias.length > 1 ? (
            <Galeria midias={midias} i={iMidia} onIr={setIMidia} />
          ) : null}

          {temDesc ? (
            <p className={`ficha__desc${aberto ? " ficha__desc--aberta" : ""}`}>{prato.descricao}</p>
          ) : null}

          {aberto && prato.ingredientes.length > 0 ? (
            <div className="ingredientes">
              <p className="ingredientes__titulo">O que vem nele</p>
              <ul className="ingredientes__lista">
                {prato.ingredientes.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ) : null}

          {temDetalhe ? (
            <button type="button" className="ficha__mais" onClick={() => setAberto((a) => !a)}>
              {aberto ? "Ver menos" : prato.ingredientes.length > 0 ? "O que vem nele" : "Ler tudo"}
            </button>
          ) : null}

          {!atual ? <span className="sem-video-aviso">Ainda sem foto nem vídeo</span> : null}

          {pares.length > 0 ? (
            <Harmoniza pares={pares} pedido={pedido} onAbrir={onAbrirPar} onQuero={onQueroPar} />
          ) : null}

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

/**
 * Quantas imagens este prato tem, e em qual delas o cliente está.
 *
 * Sem isto não há como saber que existe mais coisa: o toque já andava, mas
 * ninguém toca procurando o que não sabe que está lá. Cada ponto é tocável —
 * dá para ir direto ao vídeo sem passar pelas fotos.
 */
function Galeria({
  midias, i, onIr,
}: {
  midias: ReturnType<typeof midiasDoPrato>;
  i: number;
  onIr: (n: number) => void;
}) {
  const videos = midias.filter((m) => m.tipo === "video").length;
  const fotos = midias.length - videos;
  const partes = [
    videos > 0 ? `${videos} ${videos === 1 ? "vídeo" : "vídeos"}` : null,
    fotos > 0 ? `${fotos} ${fotos === 1 ? "foto" : "fotos"}` : null,
  ].filter(Boolean);

  return (
    <div className="galeria">
      <span className="galeria__pontos">
        {midias.map((m, k) => (
          <button
            key={m.id}
            type="button"
            className={`galeria__ponto${k === i ? " galeria__ponto--ativo" : ""}${m.tipo === "video" ? " galeria__ponto--video" : ""}`}
            onClick={() => onIr(k)}
            aria-label={`${m.tipo === "video" ? "Vídeo" : "Foto"} ${k + 1} de ${midias.length}`}
            aria-current={k === i ? "true" : undefined}
          />
        ))}
      </span>
      <span className="galeria__conta">{partes.join(" · ")}</span>
    </div>
  );
}

/**
 * "Harmoniza com": o que o dono casou com este prato.
 *
 * Tocar o cartão abre o par em vídeo — é aqui que o cardápio vende a bebida, e
 * nenhuma lista de fotos consegue fazer isso. O "+" soma direto, para quem já
 * decidiu e não quer sair da tela.
 */
function Harmoniza({
  pares, pedido, onAbrir, onQuero,
}: {
  pares: ReturnType<typeof harmonizacoes>;
  pedido: Record<string, number>;
  onAbrir: (p: Dish) => void;
  onQuero: (p: Dish) => void;
}) {
  const comFrase = pares.filter((h) => h.nota);
  return (
    <section className="harmoniza" aria-label="Harmoniza com">
      <p className="harmoniza__titulo">Harmoniza com</p>
      {/* A frase do dono vem em cima, em linha inteira, e não dentro do cartão:
          espremida na coluna de 130px ela era cortada no quarto da frase — e a
          frase É a harmonização. O cartão fica com nome e preço, que cabem. */}
      {comFrase.map((h) => (
        <p className="harmoniza__frase" key={h.prato.id}>
          <strong>{h.prato.nome}</strong> — {h.nota}
        </p>
      ))}
      <div className="harmoniza__fila">
        {pares.map(({ prato, motivo }) => {
          const capa = capaDoPrato(prato);
          const jaTem = (pedido[prato.id] ?? 0) > 0;
          return (
            <div className="harmoniza__cartao" key={prato.id}>
              <button
                type="button"
                className="harmoniza__corpo"
                onClick={() => onAbrir(prato)}
                aria-label={`Ver ${prato.nome}`}
              >
                {capa ? <img className="harmoniza__foto" src={capa} alt="" loading="lazy" /> : <span className="harmoniza__foto" />}
                <span className="harmoniza__txt">
                  <span className="harmoniza__motivo">{motivo}</span>
                  <span className="harmoniza__nome">{prato.nome}</span>
                  <span className="harmoniza__preco">{priceLabel(prato)}</span>
                </span>
              </button>
              <button
                type="button"
                className={`harmoniza__add${jaTem ? " harmoniza__add--feito" : ""}`}
                onClick={() => onQuero(prato)}
                aria-label={`Somar ${prato.nome} ao pedido`}
              >
                {jaTem ? "✓" : "+"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
