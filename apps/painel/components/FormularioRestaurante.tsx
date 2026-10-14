"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { Restaurant } from "@prattzo/core";
import { salvarRestaurante, type ActionState } from "@/lib/actions";
import { BotaoEnviar } from "./BotaoEnviar";
import { UploadCasa } from "./UploadCasa";

const MAX_DESC = 200;

export function FormularioRestaurante({ restaurante }: { restaurante: Restaurant }) {
  const [estado, acao] = useFormState<ActionState, FormData>(salvarRestaurante, {});
  const [desc, setDesc] = useState(restaurante.descricao);

  return (
    <form action={acao} className="bloco">
      <h3>Identidade</h3>

      <label className="campo-grupo">
        <span className="campo-rotulo">Nome do restaurante</span>
        <input className="campo" name="nome" defaultValue={restaurante.nome} required maxLength={120} />
      </label>

      <label className="campo-grupo">
        <span className="campo-rotulo">Descrição</span>
        <textarea
          className="campo"
          name="descricao"
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, MAX_DESC))}
          maxLength={MAX_DESC}
          placeholder="Uma frase sobre a casa. Aparece no compartilhamento do link e nas buscas."
        />
        <span className="contagem">{desc.length} de {MAX_DESC} caracteres</span>
      </label>

      <label className="campo-grupo">
        <span className="campo-rotulo">Frase do topo (opcional)</span>
        <input
          className="campo"
          name="horario_texto"
          defaultValue={restaurante.horario_texto}
          maxLength={60}
          placeholder="Música ao vivo de quinta a sábado"
        />
        <span className="contagem">
          Fica abaixo do horário. O “aberto até” o cardápio calcula sozinho, em Dias e horários —
          não precisa escrever aqui.
        </span>
      </label>

      <label className="campo-grupo">
        <span className="campo-rotulo">Fuso horário do salão</span>
        <select className="campo" name="fuso" defaultValue={restaurante.fuso}>
          {["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza",
            "America/Cuiaba", "America/Campo_Grande", "America/Rio_Branco", "America/Noronha"].map((f) => (
            <option value={f} key={f}>{f.split("/")[1]!.replace(/_/g, " ")}</option>
          ))}
        </select>
        <span className="contagem">
          Manda em duas coisas: quando o item marcado como “acabou” volta ao cardápio, e se o salão
          está aberto agora. Sempre a hora daqui, nunca a do servidor.
        </span>
      </label>

      <UploadCasa
        alvo="capa"
        nome="video_capa_url"
        valorAtual={restaurante.video_capa_url ?? ""}
        rotulo="Vídeo de ambiente da capa"
        dica="Roda em silêncio atrás do nome da casa, na primeira tela. O salão cheio funciona melhor que o prato."
      />

      <UploadCasa
        alvo="logo"
        nome="logo_url"
        valorAtual={restaurante.logo_url ?? ""}
        escuroAtual={restaurante.logo_escuro}
        rotulo="Logo"
        dica="Aparece sobre o vídeo da capa. Fundo transparente (PNG) fica melhor."
      />

      <p className="contagem">Endereço do cardápio: /r/{restaurante.slug} — não muda depois de criado.</p>

      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

      <div className="linha-acoes">
        <BotaoEnviar className="bt bt--ouro">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
