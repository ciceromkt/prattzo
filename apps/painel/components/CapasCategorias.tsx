"use client";

import { useState } from "react";
import { CAPA_ALTURA, CAPA_LARGURA } from "@prattzo/core";
import { definirCapaCategoria, salvarCapaCategoria } from "@/lib/actions";
import { RecorteFoto } from "./RecorteFoto";

export interface CapaView {
  id: string;
  nome: string;
  atual: string | null;
  escolhida: string | null;
  itens: number;
  opcoes: Array<{ url: string; rotulo: string }>;
}

/**
 * A capa da categoria, e por que escolher a imagem não bastava.
 *
 * Esta tela já deixava trocar a imagem, mas a grade da home é DEITADA (3:2) e
 * quase toda foto do cardápio é em pé — a do prato porque é feita para a tela
 * cheia do celular, e o quadro de um vídeo porque o vídeo é vertical. Escolher
 * qual imagem não resolvia nada: as duas entravam como uma tira fina do meio.
 *
 * Por isso a capa ganhou enquadramento próprio, no formato da grade. Quando o
 * dono enquadra, sai um arquivo novo só da capa; enquanto ele não enquadra,
 * segue a sugestão automática de antes, porque cardápio recém-criado tem que
 * ficar de pé sozinho.
 */
export function CapasCategorias({ categorias }: { categorias: CapaView[] }) {
  const [recorte, setRecorte] = useState<{ id: string; nome: string; src: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function receber(blob: Blob) {
    const alvo = recorte;
    setRecorte(null);
    if (!alvo) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alvo: "categoria", contentType: "image/jpeg" }),
      });
      const { uploadUrl, token, publicUrl } = (await r.json()) as {
        uploadUrl?: string; token?: string; publicUrl?: string;
      };
      if (!uploadUrl || !publicUrl) throw new Error("upload não autorizado");

      const envio = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": "image/jpeg", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: blob,
      });
      if (!envio.ok) throw new Error("falha no envio");

      const ok = await salvarCapaCategoria({ id: alvo.id, capaUrl: publicUrl });
      if (!ok.ok) throw new Error("não gravou");
    } catch {
      setErro("Não deu para salvar a capa. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <p className="dica">
        A capa é a primeira coisa que o cliente vê na grade da home, e ela é deitada. Enquadre para
        escolher o pedaço — sem isso, uma foto em pé entra como uma tira do meio dela.
      </p>

      <div className="capas-grade">
        {categorias.map((c) => (
          <div className="capa-cartao" key={c.id}>
            <div className="capa-cartao__previa">
              {c.atual ? <img src={c.atual} alt="" /> : <span>sem capa</span>}
              {!c.escolhida && c.atual ? <span className="capa-cartao__auto">automática</span> : null}
            </div>
            <div className="capa-cartao__corpo">
              <p className="capa-cartao__nome">{c.nome}</p>
              <p className="capa-cartao__meta">
                {c.itens} {c.itens === 1 ? "item" : "itens"} ·{" "}
                {c.opcoes.length > 0 ? `${c.opcoes.length} imagens` : "nenhuma mídia ainda"}
              </p>

              {c.opcoes.length > 0 ? (
                <>
                  <div className="opcoes">
                    {c.opcoes.map((o) => (
                      <form action={definirCapaCategoria} key={o.url}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="capa_url" value={o.url} />
                        <button
                          type="submit"
                          className="opcao"
                          aria-pressed={c.atual === o.url}
                          title={`Usar ${o.rotulo} sem enquadrar`}
                        >
                          <img src={o.url} alt={o.rotulo} />
                        </button>
                      </form>
                    ))}
                    <form action={definirCapaCategoria}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="capa_url" value="" />
                      <button
                        type="submit"
                        className="opcao opcao--texto"
                        aria-pressed={!c.escolhida}
                        title="Deixar automática"
                      >
                        auto
                      </button>
                    </form>
                  </div>

                  <div className="linha-acoes">
                    <button
                      type="button"
                      className="bt bt--mini bt--ouro"
                      disabled={enviando || !c.atual}
                      onClick={() => c.atual && setRecorte({ id: c.id, nome: c.nome, src: c.atual })}
                    >
                      ⤢ Enquadrar capa
                    </button>
                  </div>
                  <p className="contagem">
                    Enquadra a imagem que está na prévia. Para enquadrar outra, escolha ela primeiro.
                  </p>
                </>
              ) : (
                <p className="capa-vazia">Suba uma foto em algum item desta categoria.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {enviando ? <p className="contagem">Salvando a capa…</p> : null}
      {erro ? <p className="contagem contagem--curta">{erro}</p> : null}

      {recorte ? (
        <RecorteFoto
          src={recorte.src}
          remoto
          titulo={`Capa de ${recorte.nome}`}
          dica="É assim que esta categoria aparece na grade da home."
          larguraAlvo={CAPA_LARGURA}
          alturaAlvo={CAPA_ALTURA}
          onPronto={(blob) => void receber(blob)}
          onCancelar={() => setRecorte(null)}
        />
      ) : null}
    </section>
  );
}
