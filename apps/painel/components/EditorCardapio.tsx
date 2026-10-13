"use client";

import { useState } from "react";
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
  const [novaCategoria, setNovaCategoria] = useState(false);

  const pendentes = new Set(pendencias.map((p) => p.dish_id));
  const faltasDe = (id: string) => pendencias.find((p) => p.dish_id === id)?.faltas ?? [];
  const grupo = grupos.find((g) => g.categoria.id === catAtiva) ?? grupos[0];
  const iGrupo = grupos.findIndex((g) => g.categoria.id === grupo?.categoria.id);

  const trocar = (id: string) => { setCatAtiva(id); setEditando(null); setNovo(false); };

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
  prato, categoriaId, grupos, onFechar,
}: {
  prato?: PratoView;
  categoriaId?: string | null;
  grupos: GrupoView[];
  onFechar: () => void;
}) {
  const [desc, setDesc] = useState(prato?.descricao ?? "");
  const curta = desc.trim().length < DESCRICAO_MINIMA;
  // As ações têm assinatura (estado, formData). Passá-las direto no `action=`
  // entrega só o formData no primeiro argumento e o salvar nunca acontece —
  // foi o que o teste contra o banco pegou.
  const [estado, acao] = useFormState<ActionState, FormData>(prato ? salvarPrato : criarPrato, {});

  return (
    <div className="editor-form">
      <form action={acao}>
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

        {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
        {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

        <div className="linha-acoes">
          <button type="submit" className="bt bt--ouro">{prato ? "Salvar" : "Adicionar"}</button>
          <button type="button" className="bt" onClick={onFechar}>Cancelar</button>
        </div>
      </form>

      {prato ? (
        <>
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
