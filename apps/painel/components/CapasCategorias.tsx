"use client";

import { definirCapaCategoria } from "@/lib/actions";

export interface CapaView {
  id: string;
  nome: string;
  atual: string | null;
  escolhida: string | null;
  itens: number;
  opcoes: Array<{ url: string; rotulo: string }>;
}

/**
 * A capa é a primeira coisa que o cliente vê. Começa sugerida pela primeira
 * mídia da categoria; aqui o dono troca por qualquer imagem que já exista nela.
 */
export function CapasCategorias({ categorias }: { categorias: CapaView[] }) {
  return (
    <section>
      <p className="dica">
        A capa é a primeira coisa que o cliente vê na grade. Clique para trocar — muda na hora.
      </p>

      <div className="capas-grade">
        {categorias.map((c) => (
          <div className="capa-cartao" key={c.id}>
            <div className="capa-cartao__previa">
              {c.atual ? <img src={c.atual} alt="" /> : <span>sem capa</span>}
            </div>
            <div className="capa-cartao__corpo">
              <p className="capa-cartao__nome">{c.nome}</p>
              <p className="capa-cartao__meta">
                {c.itens} {c.itens === 1 ? "item" : "itens"} ·{" "}
                {c.opcoes.length > 0 ? `${c.opcoes.length} imagens` : "nenhuma mídia ainda"}
              </p>

              {c.opcoes.length > 0 ? (
                <div className="opcoes">
                  {c.opcoes.map((o) => (
                    <form action={definirCapaCategoria} key={o.url}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="capa_url" value={o.url} />
                      <button
                        type="submit"
                        className="opcao"
                        aria-pressed={c.atual === o.url}
                        title={o.rotulo}
                      >
                        <img src={o.url} alt={o.rotulo} />
                      </button>
                    </form>
                  ))}
                  <form action={definirCapaCategoria}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="capa_url" value="" />
                    <button type="submit" className="opcao opcao--texto" aria-pressed={!c.escolhida} title="Deixar automática">
                      auto
                    </button>
                  </form>
                </div>
              ) : (
                <p className="capa-vazia">Suba uma foto em algum item desta categoria.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
