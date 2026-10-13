"use client";

import { useFormState } from "react-dom";
import type { Restaurant } from "@prattzo/core";
import { salvarMarketing, type ActionState } from "@/lib/actions";
import { BotaoEnviar } from "./BotaoEnviar";

export function FormularioMarketing({ restaurante }: { restaurante: Restaurant }) {
  const [estado, acao] = useFormState<ActionState, FormData>(salvarMarketing, {});

  return (
    <form action={acao} className="bloco">
      <h3>Avaliação no Google</h3>
      <p className="contagem">
        O melhor momento para pedir uma avaliação é logo depois de comer, ainda na mesa. Com o link
        aqui, o cardápio oferece isso no fim do pedido — sem o garçom ter que pedir.
      </p>

      <label className="campo-grupo">
        <span className="campo-rotulo">Link de avaliação</span>
        <input
          className="campo"
          name="link_google"
          type="url"
          defaultValue={restaurante.link_google ?? ""}
          placeholder="https://g.page/r/…/review"
        />
        <span className="contagem">
          No Google Meu Negócio: <strong>Peça avaliações</strong> → copiar link. Ele termina em
          <code> /review</code> e abre a janela de estrelas já aberta.
        </span>
      </label>

      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

      <div className="linha-acoes">
        <BotaoEnviar className="bt bt--ouro">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
