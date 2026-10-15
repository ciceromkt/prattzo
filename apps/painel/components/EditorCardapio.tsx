"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormState } from "react-dom";
import type { Category, MediaItem } from "@prattzo/core";
import { DESCRICAO_MINIMA, estaEsgotado, formatCents, priceLabel } from "@prattzo/core";
import {
  alternarAtivo, alternarDestaque, alternarEsgotado, criarCategoria, criarPrato,
  excluirCategoria, excluirPrato, moverCategoria, moverPrato, renomearCategoria, salvarPrato,
  type ActionState,
} from "@/lib/actions";
import { UploadMidia } from "./UploadMidia";

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
  const [recemCriado, setRecemCriado] = useState<string | null>(null);
  const aoCriar = useCallback((id: string, categoryId: string | null) => {
    if (categoryId) setCatAtiva(categoryId);
    setNovo(false);
    setEditando(id);
    setRecemCriado(id);
  }, []);
  const [novaCategoria, setNovaCategoria] = useState(false);

  const pendentes = new Set(pendencias.map((p) => p.dish_id));
  const faltasDe = (id: string) => pendencias.find((p) => p.dish_id === id)?.faltas ?? [];
  const grupo = grupos.find((g) => g.categoria.id === catAtiva) ?? grupos[0];
  const iGrupo = grupos.findIndex((g) => g.categoria.id === grupo?.categoria.id);

  const trocar = (id: string) => {
    setCatAtiva(id); setEditando(null); setNovo(false); setRecemCriado(null);
  };

  return (
    <div className="duas-colunas">
      <nav className="rail" aria-label="Categorias">
        <p className="rail__titulo">Categorias</p>
        {grupos.map((g) => {
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

        {novaCategoria ? null : (
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
                <Mover action={moverCategoria} id={grupo.categoria.id} cima={iGrupo > 0} baixo={iGrupo < grupos.length - 1} />
                <form action={excluirCategoria}>
                  <input type="hidden" name="id" value={grupo.categoria.id} />
                  <button type="submit" className="bt bt--mini bt--perigo">Excluir</button>
                </form>
              </span>
            </div>

            {grupo.pratos.length === 0 && !novo ? (
              <p className="painel-vazio">Nenhum item aqui ainda.</p>
            ) : null}

            {grupo.pratos.map((p, i) => {
              const esgotado = estaEsgotado(p);
              const faltas = faltasDe(p.id);
              return editando === p.id ? (
                <FormPrato
                  key={p.id}
                  prato={p}
                  grupos={grupos}
                  recemCriado={recemCriado === p.id}
                  onFechar={() => { setEditando(null); setRecemCriado(null); }}
                />
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
  prato, categoriaId, grupos, onFechar, onCriado, recemCriado = false,
}: {
  prato?: PratoView;
  categoriaId?: string | null;
  grupos: GrupoView[];
  onFechar: () => void;
  /** Acabou de ser criado nesta tela: diz o que aconteceu e o que vem agora. */
  recemCriado?: boolean;
  /** Só no formulário de item novo: entrega o id assim que ele existe. */
  onCriado?: (id: string, categoryId: string | null) => void;
}) {
  const [desc, setDesc] = useState(prato?.descricao ?? "");
  const curta = desc.trim().length < DESCRICAO_MINIMA;
  // As ações têm assinatura (estado, formData). Passá-las direto no `action=`
  // entrega só o formData no primeiro argumento e o salvar nunca acontece —
  // foi o que o teste contra o banco pegou.
  const [estado, acao] = useFormState<ActionState, FormData>(prato ? salvarPrato : criarPrato, {});

  /**
   * Criar o item abre a edição DELE na hora.
   *
   * Antes, "Adicionar" fechava o assunto: o item ia para a lista e a área de
   * fotos e vídeo não existia, porque ela depende de um id que só passa a
   * existir depois de gravar. O dono tinha que fechar o formulário, achar o
   * item na lista e clicar em Editar para então subir a foto — três passos que
   * ninguém adivinha, no produto cujo ponto inteiro é a foto e o vídeo.
   */
  useEffect(() => {
    if (estado.criado) onCriado?.(estado.criado.id, estado.criado.categoryId);
  }, [estado.criado, onCriado]);

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
        <div className="editor-form__salvar">
          <div className="linha-acoes">
            <button type="submit" className="bt bt--ouro">{prato ? "Salvar" : "Adicionar"}</button>
            <button type="button" className="bt" onClick={onFechar}>Cancelar</button>
          </div>
          <p className="contagem">
            {prato
              ? "Salva os dados acima. Fotos e vídeo gravam sozinhos no envio — não dependem deste botão."
              : "Depois de adicionar, abre o espaço para enviar as fotos e o vídeo."}
          </p>
        </div>
      </form>

      {prato ? (
        <>
          {/* A confirmação de "criado" morre junto com o formulário de item
              novo, que é desmontado. Sem esta linha o cartão só muda sozinho e
              o dono não sabe se gravou nem o que fazer em seguida. */}
          {recemCriado ? (
            <p className="aviso aviso--ok">
              ✓ “{prato.nome}” está no cardápio. Agora a foto ou o vídeo — é o que faz o cliente pedir.
            </p>
          ) : null}

          <UploadMidia dishId={prato.id} midias={prato.midias} />

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
