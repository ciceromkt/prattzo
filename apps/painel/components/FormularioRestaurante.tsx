"use client";

import { useFormState } from "react-dom";
import type { Restaurant } from "@pede-esse/core";
import { salvarRestaurante, type ActionState } from "@/lib/actions";
import { BotaoEnviar } from "./BotaoEnviar";

export function FormularioRestaurante({ restaurante }: { restaurante: Restaurant }) {
  const [estado, acao] = useFormState<ActionState, FormData>(salvarRestaurante, {});

  return (
    <form action={acao} className="bloco">
      <h3>Identidade</h3>

      <label>
        <span className="campo-rotulo">Nome</span>
        <input className="campo" name="nome" defaultValue={restaurante.nome} required />
      </label>

      <label>
        <span className="campo-rotulo">Descrição</span>
        <input className="campo" name="descricao" defaultValue={restaurante.descricao} maxLength={160} />
      </label>

      <label>
        <span className="campo-rotulo">Horário (aparece no topo do cardápio)</span>
        <input className="campo" name="horario_texto" defaultValue={restaurante.horario_texto} placeholder="Aberto até 02:00" />
      </label>

      <label>
        <span className="campo-rotulo">Fuso horário do salão</span>
        <select className="campo" name="fuso" defaultValue={restaurante.fuso}>
          {["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza",
            "America/Cuiaba", "America/Campo_Grande", "America/Rio_Branco", "America/Noronha"].map((f) => (
            <option value={f} key={f}>{f.split("/")[1]!.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
      <p className="contagem">
        Define quando o item marcado como “acabou” volta ao cardápio: às 6h daqui, não do servidor.
      </p>

      <label>
        <span className="campo-rotulo">Logo (URL da imagem)</span>
        <input className="campo" name="logo_url" defaultValue={restaurante.logo_url ?? ""} placeholder="https://…" />
      </label>

      <label>
        <span className="campo-rotulo">Vídeo de ambiente da capa (URL)</span>
        <input className="campo" name="video_capa_url" defaultValue={restaurante.video_capa_url ?? ""} placeholder="https://…" />
      </label>

      <label>
        <span className="campo-rotulo">Link de avaliação no Google</span>
        <input className="campo" name="link_google" defaultValue={restaurante.link_google ?? ""} placeholder="https://g.page/…" />
      </label>

      <p className="contagem">Endereço do cardápio: /r/{restaurante.slug} — não muda depois de criado.</p>

      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

      <div className="linha-acoes">
        <BotaoEnviar className="bt bt--ouro">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
