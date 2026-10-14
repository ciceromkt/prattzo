"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dish, MenuGroup, PublicMenu } from "@prattzo/core";
import { capaDaCategoria, estadoAgora, filaDeStories, lerExpedientes, orderTotal, sugestoesParaPedido, videoDoPrato } from "@prattzo/core";
import type { EstadoHorario } from "@prattzo/core";
import { Stories } from "./Stories";
import { ListaCorrida } from "./ListaCorrida";
import { Pedido } from "./Pedido";
import { flush, track } from "@/lib/track";
import { consultarEsgotados } from "@/lib/estoque";

type Tela = "capa" | "stories";

export function Cardapio({ menu }: { menu: PublicMenu }) {
  const [tela, setTela] = useState<Tela>("capa");
  const [fila, setFila] = useState<Dish[]>([]);
  const [idx, setIdx] = useState(0);
  const [lista, setLista] = useState(false);
  const [listaCat, setListaCat] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Record<string, number>>({});
  const [pedidoAberto, setPedidoAberto] = useState(false);
  const [comanda, setComanda] = useState(false);
  const [favoritos, setFavoritos] = useState<Record<string, boolean>>({});
  const [sugerindo, setSugerindo] = useState(false);
  // Uma vez por visita: oferecer de novo a cada "fechar" vira insistência.
  const jaSugeriu = useRef(false);
  /** O que acabou DEPOIS que esta página carregou. Vazio é o normal. */
  const [esgotouAgora, setEsgotouAgora] = useState<Record<string, true>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const palcoRef = useRef<HTMLDivElement | null>(null);
  const barraRef = useRef<HTMLButtonElement | null>(null);

  const grupos = menu.grupos;
  const todos = useMemo(() => filaDeStories(grupos), [grupos]);

  /**
   * A barra do pedido cobre o rodapé do story — e logo embaixo dela fica o
   * "Quero esse". A altura dela muda com a largura da tela e com o texto, então
   * ela é medida de verdade: número fixo escondia o botão em tela estreita.
   */
  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco) return;
    const medir = () => {
      const h = barraRef.current?.offsetHeight ?? 0;
      palco.style.setProperty("--barra-pedido", `${h}px`);
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(medir);
    if (barraRef.current) obs.observe(barraRef.current);
    obs.observe(palco);
    return () => obs.disconnect();
  });

  useEffect(() => {
    track({ restaurantId: menu.restaurant.id, tipo: "abriu_cardapio" });
  }, [menu.restaurant.id]);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(null), 1600);
  }, []);

  const abrirCategoria = useCallback(
    (grupo: MenuGroup) => {
      setFila(grupo.pratos);
      setIdx(0);
      setTela("stories");
      setLista(false);
      track({ restaurantId: menu.restaurant.id, tipo: "abriu_categoria" });
    },
    [menu.restaurant.id],
  );

  const abrirPrato = useCallback((prato: Dish, daFila: Dish[]) => {
    setFila(daFila);
    setIdx(Math.max(0, daFila.findIndex((p) => p.id === prato.id)));
    setTela("stories");
    setLista(false);
  }, []);

  /**
   * Abre um prato que veio da harmonização — quase sempre de outra categoria.
   *
   * A fila passa a ser a categoria DELE, não a de onde o cliente veio: ele
   * tocou no vinho, então o que vem depois são os outros vinhos. Levar a fila
   * antiga faria o toque seguinte voltar para a comida, sem explicação.
   */
  const abrirHarmonizado = useCallback(
    (prato: Dish) => {
      const grupo = grupos.find((g) => g.pratos.some((p) => p.id === prato.id));
      abrirPrato(prato, grupo?.pratos ?? [prato]);
    },
    [grupos, abrirPrato],
  );

  const somar = useCallback(
    (prato: Dish, delta: number) => {
      setPedido((atual) => {
        const n = Math.max(0, (atual[prato.id] ?? 0) + delta);
        const proximo = { ...atual };
        if (n === 0) delete proximo[prato.id];
        else proximo[prato.id] = n;
        return proximo;
      });
      if (delta > 0) {
        mostrarAviso(`${prato.nome} · ${(pedido[prato.id] ?? 0) + 1} no pedido`);
        track({ restaurantId: menu.restaurant.id, tipo: "adicionou_pedido", dishId: prato.id });
      }
    },
    [menu.restaurant.id, mostrarAviso, pedido],
  );

  const linhas = useMemo(
    () => todos.filter((p) => (pedido[p.id] ?? 0) > 0).map((dish) => ({ dish, quantidade: pedido[dish.id]! })),
    [todos, pedido],
  );
  const total = useMemo(() => orderTotal(linhas), [linhas]);
  const quantidade = linhas.reduce((n, l) => n + l.quantidade, 0);

  const sugestoes = useMemo(() => sugestoesParaPedido(grupos, pedido), [grupos, pedido]);

  /**
   * Confere o que acabou na hora de abrir o pedido.
   *
   * A página do cliente é cacheada e fica aberta muito tempo — ele vê os vídeos,
   * conversa, volta. O estoque muda nesse intervalo. Perguntar aqui é o momento
   * exato em que isso importa: é quando ele decide o que vai pedir ao garçom.
   * Se der erro, não avisa nada e segue: não dá para travar o pedido por isso.
   */
  const abrirPedido = useCallback(async () => {
    setPedidoAberto(true);
    setEsgotouAgora(await consultarEsgotados(menu.restaurant.slug));
  }, [menu.restaurant.slug]);

  /** O que o cliente de fato leva: sem o que acabou no meio do caminho. */
  const linhasValidas = useMemo(() => linhas.filter((l) => !esgotouAgora[l.dish.id]), [linhas, esgotouAgora]);

  /** Fechar passa pela sugestão uma vez; depois vai direto para a lista. */
  const tentarFechar = useCallback(() => {
    if (!jaSugeriu.current && sugestoes.length > 0) {
      jaSugeriu.current = true;
      setSugerindo(true);
      setPedidoAberto(false);
      track({ restaurantId: menu.restaurant.id, tipo: "viu_sugestao" });
      return;
    }
    void fecharPedido();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestoes, menu.restaurant.id]);

  const fecharPedido = useCallback(async () => {
    setSugerindo(false);
    setPedidoAberto(false);
    setComanda(true);
    // Vai agora, sem esperar o lote: fechar é o último ato da visita, e muita
    // gente fecha a aba na tela da lista. No lote de 4s esse evento — o único
    // que mede conversão — se perde justamente nas visitas que converteram.
    track({ restaurantId: menu.restaurant.id, tipo: "fechou_pedido" });
    flush(menu.restaurant.id);
    try {
      await fetch("/api/pedido", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: menu.restaurant.slug,
          totalCentavos: total.centavos,
          aproximado: total.aproximado,
          linhas: linhasValidas.map((l) => ({
            dish_id: l.dish.id,
            nome: l.dish.nome,
            quantidade: l.quantidade,
            preco_centavos: l.dish.preco_min_centavos,
          })),
        }),
      });
    } catch {
      // O cliente já tem a lista na tela; falha de rede não pode atrapalhar.
    }
  }, [linhasValidas, menu.restaurant.id, menu.restaurant.slug, total]);

  const favoritar = useCallback(
    (prato: Dish) => {
      setFavoritos((a) => {
        const proximo = { ...a };
        if (proximo[prato.id]) delete proximo[prato.id];
        else proximo[prato.id] = true;
        return proximo;
      });
      mostrarAviso(favoritos[prato.id] ? "Tirado dos favoritos" : "Favoritado");
    },
    [favoritos, mostrarAviso],
  );

  /** Compartilha o prato, não o cardápio: o amigo abre no vídeo certo. */
  const compartilharPrato = useCallback(
    async (prato: Dish) => {
      const base = typeof window === "undefined" ? "" : window.location.href.split("#")[0];
      const url = `${base}#${prato.id}`;
      track({ restaurantId: menu.restaurant.id, tipo: "compartilhou", dishId: prato.id });
      const nav = typeof navigator === "undefined" ? undefined : navigator;
      if (nav?.share) {
        try {
          await nav.share({ title: prato.nome, text: `Olha isso: ${prato.nome}`, url });
          return;
        } catch {
          return;
        }
      }
      try {
        await nav?.clipboard?.writeText(url);
        mostrarAviso("Link do prato copiado");
      } catch {
        mostrarAviso(url);
      }
    },
    [menu.restaurant.id, mostrarAviso],
  );

  const compartilhar = useCallback(async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    track({ restaurantId: menu.restaurant.id, tipo: "compartilhou" });
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    if (nav?.share) {
      try {
        await nav.share({ title: menu.restaurant.nome, text: "Olha o cardápio daqui", url });
        return;
      } catch {
        return; // cancelou
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      mostrarAviso("Link copiado");
    } catch {
      mostrarAviso("Copie o link da barra do navegador");
    }
  }, [menu.restaurant.id, menu.restaurant.nome, mostrarAviso]);

  return (
    <div className="palco" ref={palcoRef}>
      {tela === "capa" ? (
        <Capa
          menu={menu}
          onCategoria={abrirCategoria}
          onLista={() => { setListaCat(grupos[0]?.categoria.id ?? null); setLista(true); }}
          onCompartilhar={compartilhar}
        />
      ) : (
        <Stories
          grupos={grupos}
          fila={fila}
          idx={idx}
          pedido={pedido}
          onIdx={setIdx}
          onFechar={() => setTela("capa")}
          onLista={(catId) => { setListaCat(catId); setLista(true); }}
          onCategoria={abrirCategoria}
          onQuero={(p) => somar(p, 1)}
          favoritos={favoritos}
          onFavoritar={favoritar}
          onCompartilhar={compartilharPrato}
          restaurantId={menu.restaurant.id}
          paresPrato={menu.paresPrato}
          paresCategoria={menu.paresCategoria}
          harmonizacao={{
            modo: menu.restaurant.harmonizacao_modo,
            max: menu.restaurant.harmonizacao_max,
          }}
          onAbrirPar={abrirHarmonizado}
          onQueroPar={(p) => {
            somar(p, 1);
            track({ restaurantId: menu.restaurant.id, tipo: "aceitou_sugestao", dishId: p.id });
          }}
        />
      )}

      {lista ? (
        <ListaCorrida
          grupos={grupos}
          catInicial={listaCat}
          onFechar={() => setLista(false)}
          onPrato={(p, g) => abrirPrato(p, g.pratos)}
        />
      ) : null}

      {quantidade > 0 && !pedidoAberto && !comanda ? (
        <button type="button" className="pedido-barra" ref={barraRef} onClick={() => void abrirPedido()}>
          <span className="pedido-barra__n">{quantidade}</span>
          <span className="pedido-barra__txt">Meu pedido</span>
          <span className="pedido-barra__seta" aria-hidden="true">Fechar pedido ›</span>
        </button>
      ) : null}

      {pedidoAberto || comanda || sugerindo ? (
        <Pedido
          linhas={comanda ? linhasValidas : linhas}
          esgotados={esgotouAgora}
          comanda={comanda}
          onMais={(p) => somar(p, 1)}
          onMenos={(p) => somar(p, -1)}
          sugestoes={sugestoes}
          sugerindo={sugerindo}
          onFechar={() => setPedidoAberto(false)}
          onFecharPedido={tentarFechar}
          onVoltar={() => { setComanda(false); setSugerindo(false); void abrirPedido(); }}
          onAceitarSugestao={(p) => {
            somar(p, 1);
            track({ restaurantId: menu.restaurant.id, tipo: "aceitou_sugestao", dishId: p.id });
          }}
          onPularSugestao={() => { void fecharPedido(); }}
        />
      ) : null}

      {aviso ? <p className="aviso-flutua">{aviso}</p> : null}
    </div>
  );
}

/**
 * O vídeo de ambiente da capa, e o que fazer quando ele não pode tocar.
 *
 * Duas coisas separadas:
 *
 * 1. O atributo `muted` como prop do React chega depois da primeira
 *    renderização, e aí o navegador já bloqueou o autoplay. Por isso ele é
 *    posto na mão, junto com `playsinline`.
 *
 * 2. Tem caso em que o iPhone recusa de qualquer jeito — o Modo de Baixo
 *    Consumo bloqueia autoplay de TODO vídeo, inclusive mudo, e desenha um
 *    botão de play gigante no meio da tela. É comum no cliente real: quem está
 *    no bar às 22h está com a bateria no fim. Nesse caso o vídeo some e fica a
 *    foto, que é o que o vídeo mostraria parado — melhor uma capa bonita do que
 *    um play que ninguém pediu. Se o cliente tocar na tela, tenta de novo: o
 *    toque é o gesto que o iOS exige.
 */
function useVideoAmbiente() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [tocando, setTocando] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");

    let vivo = true;
    const tentar = () => {
      el.play().then(
        () => { if (vivo) setTocando(true); },
        () => { if (vivo) setTocando(false); },
      );
    };
    tentar();

    // `play()` pode resolver e o quadro nunca andar. Um segundo depois, se
    // ainda está parado, é porque não vai tocar.
    const conferir = setTimeout(() => { if (vivo && el.paused) setTocando(false); }, 1100);
    const noToque = () => tentar();
    document.addEventListener("touchstart", noToque, { passive: true });
    document.addEventListener("click", noToque);

    return () => {
      vivo = false;
      clearTimeout(conferir);
      document.removeEventListener("touchstart", noToque);
      document.removeEventListener("click", noToque);
    };
  }, []);

  return { ref, tocando };
}

function Capa({
  menu, onCategoria, onLista, onCompartilhar,
}: {
  menu: PublicMenu;
  onCategoria: (g: MenuGroup) => void;
  onLista: () => void;
  onCompartilhar: () => void;
}) {
  const { restaurant, grupos } = menu;
  const { ref: videoRef, tocando } = useVideoAmbiente();
  // Sem poster a capa fica preta até o vídeo carregar — no 4G do bar, isso é a
  // primeira impressão. Pega a capa da ÚLTIMA categoria, não da primeira: em
  // coluna única o primeiro cartão encosta no topo, e a mesma foto duas vezes,
  // uma embaixo da outra, parece defeito.
  const capas = grupos.map((g) => capaDaCategoria(g)).filter(Boolean);
  const poster = (capas[capas.length - 1] ?? undefined) as string | undefined;
  return (
    <div className="rolagem">
      <header className="hero">
        {/* A foto fica SEMPRE atrás do vídeo, não só quando não há vídeo: é ela
            que aparece enquanto o vídeo carrega e é ela que fica se o aparelho
            recusar tocar. Sem isso a capa é um retângulo preto no 4G do bar. */}
        {poster ? <img className="hero__video" src={poster} alt="" /> : null}
        {restaurant.video_capa_url ? (
          <video
            ref={videoRef}
            className={`hero__video${tocando ? "" : " hero__video--parado"}`}
            src={restaurant.video_capa_url}
            poster={poster}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            aria-hidden="true"
          />
        ) : null}
        <span className="hero__veu" />
        <div className="topo-flutua">
          <button type="button" className="chip" onClick={onLista}>☰ Ver lista</button>
          <span className="topo-flutua__dir">
            <button type="button" className="chip" onClick={onCompartilhar}>Compartilhar</button>
            {restaurant.link_google ? (
              <a className="chip" href={restaurant.link_google} target="_blank" rel="noreferrer">
                Avalie no Google
              </a>
            ) : null}
          </span>
        </div>
        <div className="hero__texto">
          {restaurant.logo_url ? (
            <>
              <img
                className={`hero__logo${restaurant.logo_escuro ? " hero__logo--placa" : ""}`}
                src={restaurant.logo_url}
                alt={restaurant.nome}
              />
              {/* O nome segue no documento para busca e leitor de tela: a marca
                  está na imagem, mas o texto é o que o Google e o cego leem. */}
              <h1 className="visually-hidden">{restaurant.nome}</h1>
            </>
          ) : (
            <h1 className="hero__nome">{restaurant.nome}</h1>
          )}
          <HorarioAgora restaurant={restaurant} />
          {restaurant.horario_texto ? <p className="hero__frase">{restaurant.horario_texto}</p> : null}
        </div>
      </header>

      {/* Atalho para o vídeo sem rolar. A grade abaixo faz a mesma coisa, mas
          exige rolar até a categoria; quem chegou pelo QR com fome não rola. */}
      {grupos.length > 1 ? (
        <nav className="atalhos" aria-label="Categorias">
          {grupos.map((g) => (
            <button type="button" className="atalhos__item" key={g.categoria.id} onClick={() => onCategoria(g)}>
              {g.categoria.nome}
              <span className="atalhos__n">{g.pratos.length}</span>
            </button>
          ))}
        </nav>
      ) : null}

      <div className="grade">
        {grupos.map((g) => {
          const capa = capaDaCategoria(g);
          const comVideo = g.pratos.filter((p) => videoDoPrato(p)).length;
          return (
            <button
              key={g.categoria.id}
              type="button"
              className={`categoria${capa ? "" : " categoria--sem-capa"}`}
              onClick={() => onCategoria(g)}
            >
              {capa ? (
                <>
                  <img className="categoria__img" src={capa} alt="" loading="lazy" decoding="async" />
                  <span className="categoria__veu" />
                </>
              ) : null}
              {/* Em cartão grande isto deixa de ser detalhe e vira argumento:
                  é a única coisa na tela que a lista de fotos do concorrente
                  não tem como dizer. */}
              {comVideo > 0 ? (
                <span className="categoria__play">
                  <span className="categoria__play-ic" aria-hidden="true">▶</span>
                  {comVideo} em vídeo
                </span>
              ) : null}
              <span className="categoria__texto">
                <span className="categoria__nome">{g.categoria.nome}</span>
                <span className="categoria__conta">
                  {g.pratos.length} {g.pratos.length === 1 ? "item" : "itens"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


/**
 * "Aberto até 2h" no topo, calculado no fuso do salão.
 *
 * Renderiza só depois de montar: a página é cacheada, então o HTML do servidor
 * carrega o estado da hora em que ele gerou — e serviria "Aberto" às 4 da manhã.
 * Montado no navegador, a hora é a de quem está olhando.
 */
function HorarioAgora({ restaurant }: { restaurant: PublicMenu["restaurant"] }) {
  const [estado, setEstado] = useState<EstadoHorario | null>(null);

  useEffect(() => {
    const expedientes = lerExpedientes(restaurant.horarios);
    const calcular = () => setEstado(estadoAgora(expedientes, restaurant.fuso));
    calcular();
    // A virada acontece enquanto o cliente está com a tela aberta.
    const t = setInterval(calcular, 60_000);
    return () => clearInterval(t);
  }, [restaurant.horarios, restaurant.fuso]);

  if (!estado || !estado.texto) return null;
  return (
    <p className={`hero__horario${estado.aberto ? "" : " hero__horario--fechado"}`}>
      <span className="hero__ponto" aria-hidden="true" />
      {estado.texto}
    </p>
  );
}
