"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { slugify } from "@pede-esse/core";
import { criarRestaurante, type ActionState } from "@/lib/actions";
import { BotaoEnviar } from "./BotaoEnviar";

const CARDAPIO_URL = process.env.NEXT_PUBLIC_CARDAPIO_URL ?? "http://localhost:3000";

export function FormularioOnboarding() {
  const [estado, acao] = useFormState<ActionState, FormData>(criarRestaurante, {});
  const [nome, setNome] = useState("");

  const slug = slugify(nome);

  return (
    <form action={acao} style={{ marginTop: 24 }}>
      <label className="campo">
        <span className="campo__rotulo">Nome do restaurante *</span>
        <input
          className="campo__entrada"
          name="nome"
          required
          minLength={2}
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Gula Rooftop"
        />
        <span className="campo__dica">
          {slug ? (
            <>
              Endereço do cardápio: {CARDAPIO_URL}/r/<strong>{slug}</strong>
            </>
          ) : (
            "O endereço do cardápio é gerado a partir do nome."
          )}
        </span>
      </label>

      <label className="campo">
        <span className="campo__rotulo">Descrição curta</span>
        <input
          className="campo__entrada"
          name="descricao"
          maxLength={200}
          placeholder="Bar e rooftop em Heliópolis, São Paulo"
        />
      </label>

      <div className="linha-campos">
        <label className="campo">
          <span className="campo__rotulo">Telefone</span>
          <input className="campo__entrada" name="telefone" type="tel" placeholder="(11) 90000-0000" />
        </label>
        <label className="campo">
          <span className="campo__rotulo">Endereço</span>
          <input className="campo__entrada" name="endereco" placeholder="Rua, número, bairro" />
        </label>
      </div>

      {estado.erro ? <p className="aviso aviso--erro">{estado.erro}</p> : null}

      <BotaoEnviar className="botao botao--grande" carregando="Criando…">
        Criar restaurante
      </BotaoEnviar>
    </form>
  );
}
