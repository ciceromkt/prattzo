"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { casadasCom } from "@prattzo/core";
import type { ModoHarmonizacao, ParCategoria } from "@prattzo/core";
import {
  criarParPrato, excluirParPrato, salvarModoHarmonizacao, salvarParesCategoria, type ActionState,
} from "@/lib/actions";
import { BotaoEnviar } from "./BotaoEnviar";

export interface CategoriaView {
  id: string;
  nome: string;
  itens: number;
}

export interface ParPratoView {
  id: string;
  nota: string;
  a: { id: string; nome: string };
  b: { id: string; nome: string };
}

export interface PratoOpcao {
  id: string;
  nome: string;
  categoria: string;
  pronto: boolean;
}

/**
 * Harmonização: o conhecimento do salão, escrito uma vez.
 *
 * O caminho curto primeiro — casar CATEGORIAS. São seis, não vinte e seis: em
 * dois minutos o dono marca "Drinks combina com Petiscos" e todo prato de
 * petisco passa a sugerir drink, e todo drink passa a sugerir petisco. Só
 * depois vem o par exato, que é a exceção com nome e justificativa.
 *
 * Essa ordem é a diferença entre um recurso usado e um recurso vazio: pedir 26
 * decisões antes de mostrar resultado garante que ninguém termina.
 */
export function EditorHarmonizacao({
  categorias, paresCategoria, paresPrato, opcoes, modo, max,
}: {
  categorias: CategoriaView[];
  paresCategoria: ParCategoria[];
  paresPrato: ParPratoView[];
  opcoes: PratoOpcao[];
  modo: ModoHarmonizacao;
  max: number;
}) {
  return (
    <>
      <Comando modo={modo} max={max} />
      <QuadroCategorias categorias={categorias} pares={paresCategoria} />
      <ParesExatos pares={paresPrato} opcoes={opcoes} />
    </>
  );
}

const MODOS: Array<{ id: ModoHarmonizacao; nome: string; texto: string }> = [
  {
    id: "curado",
    nome: "Só o que eu escolher",
    texto: "O cardápio mostra apenas os pares que você escreveu aqui embaixo. Prato sem par não "
      + "sugere nada. É a casa que prefere não dizer nada a dizer algo que o chef não assinaria.",
  },
  {
    id: "misto",
    nome: "Eu escolho, o cardápio completa",
    texto: "Seus pares vêm na frente. Onde não houver par, o cardápio usa as combinações de "
      + "categoria que você marcou abaixo. É o caminho de quem quer cuidar dos carros-chefes "
      + "e deixar o resto resolvido.",
  },
  {
    id: "automatico",
    nome: "Deixa o cardápio escolher",
    texto: "Só as combinações de categoria. Você marca uma vez quais categorias vão bem juntas e "
      + "não pensa mais nisso — nem os pares exatos são usados.",
  },
];

/**
 * A única configuração que muda o COMPORTAMENTO do cardápio.
 *
 * Os três modos não mudam de onde vem a sugestão — ela é sempre sua, escrita
 * aqui. O que muda é quanto trabalho você quer ter.
 */
function Comando({ modo, max }: { modo: ModoHarmonizacao; max: number }) {
  const [estado, acao] = useFormState<ActionState, FormData>(salvarModoHarmonizacao, {});
  const [escolhido, setEscolhido] = useState<ModoHarmonizacao>(modo);
  const [quantas, setQuantas] = useState(max);

  return (
    <form action={acao} className="bloco">
      <h3>Como o cardápio sugere</h3>

      <div className="modo-lista">
        {MODOS.map((m) => (
          <label className={`modo${escolhido === m.id ? " modo--on" : ""}`} key={m.id}>
            <input
              type="radio"
              name="modo"
              value={m.id}
              checked={escolhido === m.id}
              onChange={() => setEscolhido(m.id)}
            />
            <span>
              <span className="modo__nome">{m.nome}</span>
              <span className="modo__txt">{m.texto}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="campo-rotulo modo-quantas__titulo">Quantas sugestões por prato</p>
      <div className="modo-quantas">
        {[1, 2].map((n) => (
          <label className={`harmo-chip${quantas === n ? " harmo-chip--on" : ""}`} key={n}>
            <input
              type="radio"
              name="max"
              value={n}
              checked={quantas === n}
              onChange={() => setQuantas(n)}
              className="visually-hidden"
            />
            {n === 1 ? "Uma" : "Duas"}
          </label>
        ))}
      </div>
      <p className="contagem">
        Uma é o padrão, e é o que recomendo: uma sugestão lê como conselho da casa, duas leem como
        vitrine — e o segundo cartão empurra o “Quero esse” para baixo. Mas quem conhece o salão é
        você, e em Resultados dá para ver quantas sugestões foram vistas e quantas viraram pedido.
      </p>

      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      {estado.ok ? <p className="contagem contagem--ok">{estado.ok}</p> : null}

      <div className="linha-acoes">
        <BotaoEnviar className="bt bt--ouro">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}

function chave(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function QuadroCategorias({
  categorias, pares,
}: {
  categorias: CategoriaView[];
  pares: ParCategoria[];
}) {
  const [estado, acao] = useFormState<ActionState, FormData>(salvarParesCategoria, {});
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(pares.map((p) => chave(p.a_id, p.b_id))),
  );

  const alternar = (a: string, b: string) => {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      const k = chave(a, b);
      if (proximo.has(k)) proximo.delete(k);
      else proximo.add(k);
      return proximo;
    });
  };

  const total = marcados.size;

  return (
    <form action={acao} className="bloco">
      <h3>Combinações por categoria</h3>
      <p className="contagem">
        Marque o que vai bem com o quê. A marcação vale nos dois sentidos: casar
        <strong> Drinks</strong> com <strong>Petiscos</strong> faz o petisco sugerir drink e o drink
        sugerir petisco. Dentro da categoria, o cardápio oferece o item que você marcou como
        sugerido; não havendo, o primeiro da sua ordem.
      </p>

      {categorias.length < 2 ? (
        <p className="painel-vazio">
          Com uma categoria só não há o que combinar. Crie as outras no Cardápio.
        </p>
      ) : (
        <div className="harmo-quadro">
          {categorias.map((c) => {
            const casadas = casadasCom(
              [...marcados].map((k) => {
                const [a, b] = k.split("|");
                return { id: k, a_id: a!, b_id: b! };
              }),
              c.id,
            );
            return (
              <div className="harmo-linha" key={c.id}>
                <span className="harmo-linha__nome">
                  {c.nome}
                  <small>{c.itens} {c.itens === 1 ? "item" : "itens"}</small>
                </span>
                <span className="harmo-linha__chips">
                  {categorias.filter((o) => o.id !== c.id).map((o) => {
                    const ativo = casadas.has(o.id);
                    return (
                      <button
                        type="button"
                        key={o.id}
                        className={`harmo-chip${ativo ? " harmo-chip--on" : ""}`}
                        aria-pressed={ativo}
                        onClick={() => alternar(c.id, o.id)}
                      >
                        {ativo ? "✓ " : "+ "}{o.nome}
                      </button>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* O estado da tela vai inteiro no envio: a ação reescreve o conjunto, em
          vez de aplicar diferenças — um quadro de marcações é isso. */}
      {[...marcados].map((k) => <input type="hidden" name="par" value={k} key={k} />)}

      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

      <div className="linha-acoes">
        <BotaoEnviar className="bt bt--ouro">
          Salvar {total > 0 ? `${total} ${total === 1 ? "combinação" : "combinações"}` : "combinações"}
        </BotaoEnviar>
      </div>
    </form>
  );
}

function ParesExatos({
  pares, opcoes,
}: {
  pares: ParPratoView[];
  opcoes: PratoOpcao[];
}) {
  const [estado, acao] = useFormState<ActionState, FormData>(criarParPrato, {});
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, PratoOpcao[]>();
    for (const o of opcoes) {
      const lista = mapa.get(o.categoria) ?? [];
      lista.push(o);
      mapa.set(o.categoria, lista);
    }
    return [...mapa.entries()];
  }, [opcoes]);

  const naoPronto = (id: string) => opcoes.find((o) => o.id === id && !o.pronto);

  return (
    <section className="bloco">
      <h3>Pares exatos</h3>
      <p className="contagem">
        A exceção curada: este prato com esta bebida, e o porquê. Passa à frente da regra de
        categoria e a frase aparece na tela do cliente, dentro do prato — nos dois sentidos.
      </p>

      {pares.length === 0 ? (
        <p className="painel-vazio">Nenhum par exato ainda. A regra por categoria já cobre o resto.</p>
      ) : (
        <ul className="harmo-pares">
          {pares.map((p) => (
            <li className="harmo-par" key={p.id}>
              <span className="harmo-par__txt">
                <span className="harmo-par__nomes">{p.a.nome} <span aria-hidden="true">+</span> {p.b.nome}</span>
                {p.nota ? <span className="harmo-par__nota">“{p.nota}”</span> : (
                  <span className="harmo-par__nota harmo-par__nota--vazia">
                    sem frase — o cliente vê só “Harmoniza com”
                  </span>
                )}
              </span>
              <form action={excluirParPrato}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="bt bt--mini bt--perigo">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={acao} className="harmo-novo">
        <div className="editor-form__linha">
          <label>
            <span className="campo-rotulo">Este item</span>
            <Selecao nome="a_id" valor={a} onTrocar={setA} grupos={porCategoria} />
          </label>
          <label>
            <span className="campo-rotulo">Harmoniza com</span>
            <Selecao nome="b_id" valor={b} onTrocar={setB} grupos={porCategoria} />
          </label>
        </div>

        <label>
          <span className="campo-rotulo">Por quê (opcional)</span>
          <input
            className="campo"
            name="nota"
            maxLength={140}
            placeholder="A acidez do vinho corta a manteiga do risoto."
          />
        </label>
        <p className="contagem">
          Escreva de um jeito que sirva nos dois sentidos: a mesma frase aparece no prato e na
          bebida. Até 140 caracteres.
        </p>

        {/* O par só é mostrado ao cliente se os dois lados estiverem completos:
            dizer isso aqui evita o par cadastrado que nunca aparece na tela. */}
        {[a, b].map((id) => {
          const falta = id ? naoPronto(id) : undefined;
          return falta ? (
            <p className="contagem contagem--curta" key={id}>
              “{falta.nome}” ainda não aparece em harmonização: falta preço, foto ou está fora do
              cardápio. Dá para salvar o par — ele passa a aparecer quando o item estiver pronto.
            </p>
          ) : null;
        })}

        {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
        {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

        <div className="linha-acoes">
          <BotaoEnviar className="bt">Adicionar par</BotaoEnviar>
        </div>
      </form>
    </section>
  );
}

function Selecao({
  nome, valor, onTrocar, grupos,
}: {
  nome: string;
  valor: string;
  onTrocar: (v: string) => void;
  grupos: Array<[string, PratoOpcao[]]>;
}) {
  return (
    <select className="campo" name={nome} value={valor} onChange={(e) => onTrocar(e.target.value)} required>
      <option value="">Escolha um item</option>
      {grupos.map(([cat, itens]) => (
        <optgroup label={cat} key={cat}>
          {itens.map((o) => (
            <option value={o.id} key={o.id}>{o.nome}{o.pronto ? "" : " (incompleto)"}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
