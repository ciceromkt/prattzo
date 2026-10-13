"use client";

import { useState } from "react";
import { CapasCategorias, type CapaView } from "./CapasCategorias";
import { EditorCardapio, type GrupoView, type Pendencia } from "./EditorCardapio";

type Aba = "itens" | "capas" | "pendencias";

/**
 * As três coisas que o dono faz no cardápio moram em abas, não empilhadas:
 * cadastrar item, escolher capa e zerar pendência são tarefas diferentes, em
 * momentos diferentes. Juntas numa página só, nenhuma é fácil de terminar.
 */
export function PainelCardapio({
  grupos, capas, pendencias,
}: {
  grupos: GrupoView[];
  capas: CapaView[];
  pendencias: Pendencia[];
}) {
  const [aba, setAba] = useState<Aba>("itens");
  const semCapa = capas.filter((c) => !c.atual).length;

  const abas: Array<{ id: Aba; rotulo: string; conta?: number }> = [
    { id: "itens", rotulo: "Itens", conta: grupos.reduce((n, g) => n + g.pratos.length, 0) },
    { id: "capas", rotulo: "Capas", conta: semCapa > 0 ? semCapa : undefined },
    { id: "pendencias", rotulo: "Pendências", conta: pendencias.length || undefined },
  ];

  return (
    <>
      <div className="abas">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-current={aba === a.id ? "true" : undefined}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
            {a.conta !== undefined ? <span className="abas__conta">{a.conta}</span> : null}
          </button>
        ))}
      </div>

      {aba === "itens" ? <EditorCardapio grupos={grupos} pendencias={pendencias} /> : null}
      {aba === "capas" ? <CapasCategorias categorias={capas} /> : null}
      {aba === "pendencias" ? <ListaPendencias pendencias={pendencias} /> : null}
    </>
  );
}

function ListaPendencias({ pendencias }: { pendencias: Pendencia[] }) {
  if (pendencias.length === 0) {
    return <p className="painel-vazio">Nenhuma pendência. O cardápio está completo.</p>;
  }
  return (
    <>
      <p className="dica">
        O que falta cadastrar, item por item. Item sem preço aparece para o cliente como “Preço a
        confirmar”, e item sem foto nem vídeo não entra na sugestão de fechamento.
      </p>
      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th className="col-principal">Item</th>
              <th>Categoria</th>
              <th>Falta</th>
            </tr>
          </thead>
          <tbody>
            {pendencias.map((p) => (
              <tr key={p.dish_id}>
                <td className="col-principal">{p.nome}</td>
                <td>{p.categoria}</td>
                <td>
                  {p.faltas.map((f) => <span className="selo-falta" key={f}>{f}</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
