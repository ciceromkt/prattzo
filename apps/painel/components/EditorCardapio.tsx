"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useFormState } from "react-dom";
import type { Category, MediaItem } from "@prattzo/core";
import { DESCRICAO_MINIMA, estaEsgotado, formatCents, moverNaLista, priceLabel } from "@prattzo/core";
import {
  alternarAtivo, alternarDestaque, alternarEsgotado, criarCategoria, criarPrato,
  excluirCategoria, excluirPrato, moverPrato, ordenarCategorias,
  renomearCategoria, salvarPrato,
  type ActionState,
} from "@/lib/actions";
import { UploadMidia } from "./UploadMidia";
import type { MidiaPendente } from "./UploadMidia";

export interface PratoView {
  id: string;
  nome: string;
  descricao: string;
  preco_min_centavos: number;
  preco_max_centavos: number | null;
  ativo: boolean;
  esgotado_ate: string | null;
  destaque: boolean;
  versao: number;
  category_id: string | null;
  ingredientes: string[];
  serve: string;
  midias: MediaItem[];
}

export interface GrupoView {
  categoria: Category;
  pratos: PratoView[];
}

export interface Pendencia {
  dish_id: string;
  nome: string;
  categoria: string;
  faltas: string[];
}

/**
 * Uma categoria por vez.
 *
 * A primeira versão mostrava as nove categorias e os 66 itens numa página só.
 * Com cardápio de verdade isso vira um rolo que ninguém percorre, e a edição de
 * um item some no meio. Aqui a esquerda escolhe, a direita mostra — e o ponto
 * âmbar na lista diz em qual categoria ainda falta coisa para cadastrar.
 */
export function EditorCardapio({
  grupos, pendencias,
}: {
  grupos: GrupoView[];
  pendencias: Pendencia[];
}) {
  const [catAtiva, setCatAtiva] = useState<string | null>(grupos[0]?.categoria.id ?? null);
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  /**
   * Item criado: fecha o formulário de novo e abre a edição do item, que é
   * onde moram as fotos e o vídeo. Troca a categoria junto, porque o dono pode
   * ter criado o item em outra que não a que está aberta — e aí ele não
   * encontraria o que acabou de cadastrar.
   */
  /**
   * Item criado: o formulário fecha e o item aparece na lista, completo — com
   * as fotos, porque elas foram no mesmo Salvar. A confirmação morre junto com
   * o formulário desmontado, então ela sobe para cá.
   */
  const [recemCriado, setRecemCriado] = useState<string | null>(null);
  const aoCriar = useCallback((categoryId: string | null, mensagem: string) => {
    if (categoryId) setCatAtiva(categoryId);
    setNovo(false);
    setEditando(null);
    setRecemCriado(mensagem);
  }, []);
  const [novaCategoria, setNovaCategoria] = useState(false);
  const [ordenando, setOrdenando] = useState(false);

  const pendentes = new Set(pendencias.map((p) => p.dish_id));
  const faltasDe = (id: string) => pendencias.find((p) => p.dish_id === id)?.faltas ?? [];
  const grupo = grupos.find((g) => g.categoria.id === catAtiva) ?? grupos[0];

  const trocar = (id: string) => {
    setCatAtiva(id); setEditando(null); setNovo(false); setRecemCriado(null);
  };

  return (
    <div className="duas-colunas">
      <nav className={ordenando ? "rail rail--ordenando" : "rail"} aria-label="Categorias">
        <div className="rail__cabeca">
          <p className="rail__titulo">Categorias</p>
          {grupos.length > 1 ? (
            <button
              type="button"
              className="bt bt--mini"
              onClick={() => setOrdenando((v) => !v)}
            >
              {ordenando ? "Cancelar" : "⇅ Ordenar"}
            </button>
          ) : null}
        </div>

        {ordenando ? <OrdemCategorias grupos={grupos} onFechar={() => setOrdenando(false)} /> : null}

        {ordenando ? null : grupos.map((g) => {
          const falta = g.pratos.some((p) => pendentes.has(p.id));
          return (
            <button
              key={g.categoria.id}
              type="button"
              className="rail__item"
              aria-current={g.categoria.id === grupo?.categoria.id ? "true" : undefined}
              onClick={() => trocar(g.categoria.id)}
            >
              <span className="rail__nome">{g.categoria.nome}</span>
              {falta ? <span className="rail__alerta" title="Tem item com pendência" /> : null}
              <span className="rail__conta">{g.pratos.length}</span>
            </button>
          );
        })}

        {novaCategoria || ordenando ? null : (
          <button type="button" className="rail__item rail__novo" onClick={() => setNovaCategoria(true)}>
            + Nova categoria
          </button>
        )}
      </nav>

      <div>
        {novaCategoria ? <FormCategoria onFechar={() => setNovaCategoria(false)} /> : null}

        {!grupo ? (
          <p className="painel-vazio">Crie a primeira categoria para começar o cardápio.</p>
        ) : (
          <>
            <div className="editor-grupo__cabeca">
              <form action={renomearCategoria} className="editor-grupo__nome-form">
                <input type="hidden" name="id" value={grupo.categoria.id} />
                <input
                  className="campo campo--invisivel"
                  name="nome"
                  defaultValue={grupo.categoria.nome}
                  key={grupo.categoria.id}
                  aria-label="Nome da categoria"
                />
                <button type="submit" className="bt bt--mini">Renomear</button>
              </form>
              <span className="editor-grupo__acoes">
                {/* A ordem mora na lista da esquerda, no "⇅ Ordenar": é lá que o
                    dono vê as categorias em fila e consegue comparar arranjos.
                    Aqui ficavam duas setas que mexiam uma casa por vez — perto
                    do Excluir, longe da lista, e ninguém as achava. */}
                <form action={excluirCategoria}>
                  <input type="hidden" name="id" value={grupo.categoria.id} />
                  <button type="submit" className="bt bt--mini bt--perigo">Excluir</button>
                </form>
              </span>
            </div>

            {/* A confirmação do item recém-criado: o formulário dele já fechou,
                então ela precisa aparecer aqui, junto da lista onde ele entrou. */}
            {recemCriado ? (
              <p className="aviso aviso--ok">
                ✓ {recemCriado}
                <button type="button" className="aviso__fechar" onClick={() => setRecemCriado(null)} aria-label="Dispensar">
                  ✕
                </button>
              </p>
            ) : null}

            {grupo.pratos.length === 0 && !novo ? (
              <p className="painel-vazio">Nenhum item aqui ainda.</p>
            ) : null}

            {grupo.pratos.map((p, i) => {
              const esgotado = estaEsgotado(p);
              const faltas = faltasDe(p.id);
              return editando === p.id ? (
                <FormPrato key={p.id} prato={p} grupos={grupos} onFechar={() => setEditando(null)} />
              ) : (
                <div className={`editor-item${p.ativo ? "" : " editor-item--off"}`} key={p.id}>
                  {p.midias[0] ? (
                    <img
                      className="editor-item__thumb"
                      src={p.midias[0].tipo === "video" ? p.midias[0].poster_url ?? p.midias[0].url : p.midias[0].url}
                      alt=""
                    />
                  ) : (
                    <span className="editor-item__thumb" />
                  )}
                  <span className="editor-item__txt">
                    <span className="editor-item__nome">
                      {p.nome}
                      {p.preco_min_centavos > 0 ? ` · ${priceLabel(p)}` : null}
                      {esgotado ? <span className="selo-falta selo-falta--forte">esgotado hoje</span> : null}
                      {!p.ativo ? <span className="selo-falta">fora do cardápio</span> : null}
                      {p.destaque ? <span className="selo-falta">sugerido</span> : null}
                      {faltas.map((f) => <span className="selo-falta" key={f}>{f}</span>)}
                    </span>
                    <span className="editor-item__desc">{p.descricao || "—"}</span>
                    <span className="editor-item__midia">
                      {p.midias.length === 0
                        ? "sem mídia"
                        : `${p.midias.length} ${p.midias.length === 1 ? "imagem" : "imagens"}`}
                    </span>
                  </span>

                  <span className="editor-item__acoes">
                    <form action={alternarEsgotado}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="esgotar" value={esgotado ? "false" : "true"} />
                      <button type="submit" className={`bt bt--mini${esgotado ? " bt--ouro" : ""}`}>
                        {esgotado ? "Voltou" : "Acabou"}
                      </button>
                    </form>
                    <Mover
                      action={moverPrato}
                      id={p.id}
                      cima={i > 0}
                      baixo={i < grupo.pratos.length - 1}
                      extra={{ category_id: grupo.categoria.id === "sem-categoria" ? "" : grupo.categoria.id }}
                    />
                    <button type="button" className="bt bt--mini" onClick={() => setEditando(p.id)}>Editar</button>
                  </span>
                </div>
              );
            })}

            {novo ? (
              <FormPrato
                categoriaId={grupo.categoria.id === "sem-categoria" ? null : grupo.categoria.id}
                grupos={grupos}
                onFechar={() => setNovo(false)}
                onCriado={aoCriar}
              />
            ) : (
              <button type="button" className="bt bt--novo" onClick={() => setNovo(true)}>
                + Adicionar item em {grupo.categoria.nome}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Arrumar a ordem das categorias.
 *
 * Esta ordem é a que o CLIENTE vê: a fila de atalhos no topo do cardápio e a
 * sequência da grade na home. Era a única coisa do painel que só dava para
 * mexer uma casa por vez, com uma ida ao servidor por casa — e escondida no
 * cabeçalho da categoria aberta, que é onde ninguém procura a ordem da lista.
 *
 * Aqui o dono experimenta à vontade — arrastando pelo punho, ou nas setas, que
 * é o que funciona no celular e no teclado — e grava uma vez no fim. Enquanto
 * ele não salva, nada muda para o cliente.
 */
function OrdemCategorias({
  grupos, onFechar,
}: {
  grupos: GrupoView[];
  onFechar: () => void;
}) {
  const [ids, setIds] = useState<string[]>(() => grupos.map((g) => g.categoria.id));
  const [pegando, setPegando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const listaRef = useRef<HTMLUListElement | null>(null);

  const nomes = new Map(grupos.map((g) => [g.categoria.id, g.categoria.nome] as const));
  const contas = new Map(grupos.map((g) => [g.categoria.id, g.pratos.length] as const));
  const mudou = ids.some((id, i) => grupos[i]?.categoria.id !== id);

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= ids.length) return;
    setIds((atual) => moverNaLista(atual, de, para));
  };

  /**
   * A linha que está sob o dedo passa a ser a nova posição.
   *
   * Sem fantasma flutuando: a própria linha troca de lugar enquanto o dedo
   * anda, então o que o dono vê durante o arrasto já é o resultado. O punho
   * continua sendo o mesmo elemento (a chave é o id), por isso a captura do
   * ponteiro sobrevive à reordenação.
   */
  const aoArrastar = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pegando || !listaRef.current) return;
    const linhas = Array.from(listaRef.current.querySelectorAll<HTMLElement>("[data-id]"));
    const alvo = linhas.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    });
    const de = ids.indexOf(pegando);
    if (alvo < 0 || de < 0 || alvo === de) return;
    mover(de, alvo);
  };

  const comTeclado = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const punho = e.currentTarget;
    mover(i, e.key === "ArrowUp" ? i - 1 : i + 1);
    requestAnimationFrame(() => punho.focus());
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const r = await ordenarCategorias(ids);
    setSalvando(false);
    if (r?.erro) { setErro(r.erro); return; }
    onFechar();
  };

  return (
    <div className="ordem">
      <p className="ordem__ajuda">
        Arraste pelo <span aria-hidden="true">⠿</span> ou use as setas. É nesta ordem que o cliente
        vê as categorias no cardápio.
      </p>

      <ul className="ordem__lista" ref={listaRef}>
        {ids.map((id, i) => (
          <li
            key={id}
            data-id={id}
            className={pegando === id ? "ordem__linha ordem__linha--pega" : "ordem__linha"}
          >
            <button
              type="button"
              className="ordem__punho"
              aria-label={`Mover ${nomes.get(id) ?? ""}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setPegando(id);
              }}
              onPointerMove={aoArrastar}
              onPointerUp={() => setPegando(null)}
              onPointerCancel={() => setPegando(null)}
              onKeyDown={(e) => comTeclado(e, i)}
            >
              <span aria-hidden="true">⠿</span>
            </button>
            <span className="ordem__pos" aria-hidden="true">{i + 1}</span>
            <span className="ordem__nome">{nomes.get(id)}</span>
            <span className="ordem__conta">{contas.get(id)}</span>
            <span className="mover">
              <button
                type="button" className="bt bt--mini" aria-label="Subir"
                disabled={i === 0} onClick={() => mover(i, i - 1)}
              >↑</button>
              <button
                type="button" className="bt bt--mini" aria-label="Descer"
                disabled={i === ids.length - 1} onClick={() => mover(i, i + 1)}
              >↓</button>
            </span>
          </li>
        ))}
      </ul>

      {erro ? <p className="aviso aviso--erro">{erro}</p> : null}

      <div className="ordem__pe">
        <button
          type="button" className="bt bt--principal"
          onClick={salvar} disabled={!mudou || salvando}
        >
          {salvando ? "Salvando…" : "Salvar ordem"}
        </button>
        <button type="button" className="bt bt--mini" onClick={onFechar} disabled={salvando}>
          Descartar
        </button>
      </div>
    </div>
  );
}

function Mover({
  action, id, cima, baixo, extra,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  cima: boolean;
  baixo: boolean;
  extra?: Record<string, string>;
}) {
  return (
    <span className="mover">
      {(["cima", "baixo"] as const).map((dir) => (
        <form action={action} key={dir}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direcao" value={dir} />
          {extra ? Object.entries(extra).map(([k, v]) => <input type="hidden" name={k} value={v} key={k} />) : null}
          <button
            type="submit"
            className="bt bt--mini"
            disabled={dir === "cima" ? !cima : !baixo}
            aria-label={dir === "cima" ? "Subir" : "Descer"}
          >
            {dir === "cima" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </span>
  );
}

function FormPrato({
  prato, categoriaId, grupos, onFechar, onCriado,
}: {
  prato?: PratoView;
  categoriaId?: string | null;
  grupos: GrupoView[];
  onFechar: () => void;
  /** Só no formulário de item novo: avisa que gravou, com a frase pronta. */
  onCriado?: (categoryId: string | null, mensagem: string) => void;
}) {
  const [desc, setDesc] = useState(prato?.descricao ?? "");
  const curta = desc.trim().length < DESCRICAO_MINIMA;
  /**
   * Fotos e vídeo do item que ainda não existe.
   *
   * Já estão no Storage — sobem assim que são escolhidos, para o Salvar não
   * virar uma espera de um minuto — mas ainda não têm linha no banco. Vão
   * junto no envio do formulário, e é o Salvar que grava tudo de uma vez.
   */
  const [midiasNovas, setMidiasNovas] = useState<MidiaPendente[]>([]);
  // As ações têm assinatura (estado, formData). Passá-las direto no `action=`
  // entrega só o formData no primeiro argumento e o salvar nunca acontece —
  // foi o que o teste contra o banco pegou.
  const [estado, acao] = useFormState<ActionState, FormData>(prato ? salvarPrato : criarPrato, {});

  /** Criado: o formulário fecha e o item aparece na lista, já completo. */
  useEffect(() => {
    // Com erro de mídia o item existe, mas o formulário NÃO fecha: a mensagem
    // diz o que fazer, e fechar esconderia o problema.
    if (estado.criado && estado.ok) onCriado?.(estado.criado.categoryId, estado.ok);
  }, [estado.criado, estado.ok, onCriado]);

  return (
    <div className="editor-form">
      <form action={acao}>
        <p className="editor-form__secao">Dados do item</p>
        {prato ? (
          <>
            <input type="hidden" name="id" value={prato.id} />
            {/* Versão carregada: se mudou no servidor, o salvar é recusado. */}
            <input type="hidden" name="versao" value={prato.versao} />
          </>
        ) : null}
        <div className="editor-form__linha">
          <label>
            <span className="campo-rotulo">Nome</span>
            <input className="campo" name="nome" defaultValue={prato?.nome} maxLength={120} required autoFocus />
          </label>
          <label>
            <span className="campo-rotulo">Categoria</span>
            <select className="campo" name="category_id" defaultValue={prato?.category_id ?? categoriaId ?? ""}>
              <option value="">Sem categoria</option>
              {grupos
                .filter((g) => g.categoria.id !== "sem-categoria")
                .map((g) => <option value={g.categoria.id} key={g.categoria.id}>{g.categoria.nome}</option>)}
            </select>
          </label>
        </div>

        <div className="editor-form__linha">
          <label>
            <span className="campo-rotulo">Preço</span>
            <input
              className="campo"
              name="preco_min"
              placeholder="59,00"
              defaultValue={prato && prato.preco_min_centavos > 0 ? formatCents(prato.preco_min_centavos).replace("R$ ", "") : ""}
            />
          </label>
          <label>
            <span className="campo-rotulo">Até (opcional)</span>
            <input
              className="campo"
              name="preco_max"
              placeholder="164,90"
              defaultValue={prato?.preco_max_centavos ? formatCents(prato.preco_max_centavos).replace("R$ ", "") : ""}
            />
          </label>
        </div>
        <p className="contagem">Vazio no segundo campo = preço único. Preenchido, vira faixa.</p>

        <label>
          <span className="campo-rotulo">Descrição</span>
          <textarea
            className="campo"
            name="descricao"
            maxLength={320}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ingredientes e textura. O que o cliente sente ao comer."
          />
        </label>
        <p className={`contagem${curta ? " contagem--curta" : ""}`}>
          {desc.trim().length} caracteres{curta ? " — curta demais para vender" : ""}
        </p>

        <label>
          <span className="campo-rotulo">O que vem nele</span>
          <textarea
            className="campo campo--curto"
            name="ingredientes"
            defaultValue={(prato?.ingredientes ?? []).join("\n")}
            placeholder={"Tapioca granulada\nQueijo coalho\nMelaço de cana"}
          />
        </label>
        <p className="contagem">
          Um por linha. É a pergunta que o cliente faz ao garçom — “o que vem nesse dadinho?”.
          No cardápio aparece em etiquetas, dentro do prato.
        </p>

        <label>
          <span className="campo-rotulo">Serve (opcional)</span>
          <input
            className="campo"
            name="serve"
            defaultValue={prato?.serve ?? ""}
            maxLength={40}
            placeholder="Serve 2 pessoas"
          />
        </label>
        <p className="contagem">Fica ao lado do preço. “Serve 2 pessoas”, “350 ml”, “12 unidades”.</p>

        {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
        {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

        {/**
         * A barra de salvar gruda no rodapé da tela enquanto este formulário
         * está aberto — e diz o que ela salva.
         *
         * Antes ela ficava solta no meio do cartão, logo acima de "Fotos e
         * vídeo", e parecia salvar só a etapa anterior. Parecia porque É: foto
         * e vídeo gravam sozinhos no envio, e o Salvar nunca foi deles. O erro
         * não era o botão estar no lugar errado, era a tela não dizer de quem
         * ele é.
         */}
        {/* No item novo, a área de mídia fica DENTRO do formulário, acima do
            Salvar: é uma tela só, e um botão só no fim grava tudo. No item que
            já existe ela fica fora, porque lá cada envio grava sozinho. */}
        {!prato ? (
          <>
            <UploadMidia
              destino={{ modo: "rascunho", pendentes: midiasNovas, onMudar: setMidiasNovas }}
            />
            <input type="hidden" name="midias" value={JSON.stringify(midiasNovas)} />
          </>
        ) : null}

        <div className={`editor-form__salvar${prato ? " editor-form__salvar--fixo" : ""}`}>
          <div className="linha-acoes">
            <button type="submit" className="bt bt--ouro">
              {prato ? "Salvar" : "Adicionar ao cardápio"}
            </button>
            <button type="button" className="bt" onClick={onFechar}>Cancelar</button>
          </div>
          <p className="contagem">
            {prato
              ? "Salva os dados acima. Fotos e vídeo gravam sozinhos no envio — não dependem deste botão."
              : midiasNovas.length > 0
                ? `Grava o item com ${midiasNovas.length} ${midiasNovas.length === 1 ? "mídia" : "mídias"}, de uma vez.`
                : "Grava o item. Dá para adicionar foto e vídeo agora, aqui em cima, ou depois."}
          </p>
        </div>
      </form>

      {prato ? (
        <>
          <UploadMidia destino={{ modo: "prato", dishId: prato.id }} midias={prato.midias} />

          <div className="linha-acoes">
            <form action={alternarDestaque}>
              <input type="hidden" name="id" value={prato.id} />
              <input type="hidden" name="destaque" value={prato.destaque ? "false" : "true"} />
              <button type="submit" className={`bt${prato.destaque ? " bt--ouro" : ""}`}>
                {prato.destaque ? "✓ Sugerido no fechamento" : "Sugerir no fechamento"}
              </button>
            </form>
          </div>
          <p className="contagem">
            O cliente recebe uma sugestão ao fechar o pedido, sempre de uma categoria que ainda não
            pediu. Marcar aqui põe este item à frente dentro da categoria dele.
          </p>

          <div className="linha-acoes linha-acoes--fim">
            <form action={alternarAtivo}>
              <input type="hidden" name="id" value={prato.id} />
              <input type="hidden" name="ativo" value={prato.ativo ? "false" : "true"} />
              <button type="submit" className="bt">
                {prato.ativo ? "Tirar do cardápio" : "Voltar ao cardápio"}
              </button>
            </form>
            <form action={excluirPrato}>
              <input type="hidden" name="id" value={prato.id} />
              <button type="submit" className="bt bt--perigo">Excluir item</button>
            </form>
          </div>
          <p className="contagem">
            Tirar do cardápio esconde do cliente e guarda os dados. Excluir apaga de vez.
          </p>
        </>
      ) : null}
    </div>
  );
}

function FormCategoria({ onFechar }: { onFechar: () => void }) {
  const [estado, acao] = useFormState<ActionState, FormData>(criarCategoria, {});
  return (
    <form action={acao} className="editor-form">
      <label>
        <span className="campo-rotulo">Nome da categoria</span>
        <input className="campo" name="nome" placeholder="Sobremesas" required autoFocus />
      </label>
      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      <div className="linha-acoes">
        <button type="submit" className="bt bt--ouro">Criar</button>
        <button type="button" className="bt" onClick={onFechar}>Cancelar</button>
      </div>
    </form>
  );
}
