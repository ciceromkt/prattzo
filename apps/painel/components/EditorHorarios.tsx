"use client";

import { useState } from "react";
import { DIAS, horaValida, lerExpedientes, type DiaSemana, type Expediente } from "@prattzo/core";
import { salvarHorarios, type ActionState } from "@/lib/actions";
import { useFormState } from "react-dom";
import { BotaoEnviar } from "./BotaoEnviar";

interface Linha {
  dia: DiaSemana;
  aberto: boolean;
  abre: string;
  fecha: string;
}

function montarLinhas(bruto: unknown): Linha[] {
  const porDia = new Map(lerExpedientes(bruto).map((e) => [e.dia, e]));
  return DIAS.map(({ dia }) => {
    const e = porDia.get(dia);
    return { dia, aberto: Boolean(e), abre: e?.abre ?? "18:00", fecha: e?.fecha ?? "23:00" };
  });
}

/**
 * Os dias de funcionamento.
 *
 * Duas decisões de tela que vieram do balcão:
 *
 * 1. Cada dia é uma linha com um interruptor. Horário de restaurante muda por
 *    dia — segunda fechado, sexta até mais tarde — e um campo de texto livre
 *    ("seg a sex 18h às 23h, sáb até 2h") não dá para o cardápio calcular nada.
 * 2. "Copiar para os outros dias" existe porque a maioria repete o mesmo
 *    horário cinco ou seis vezes, e preencher quatorze campos à mão cansa.
 */
export function EditorHorarios({ horarios }: { horarios: unknown }) {
  const [linhas, setLinhas] = useState<Linha[]>(() => montarLinhas(horarios));
  const [estado, acao] = useFormState<ActionState, FormData>(salvarHorarios, {});

  const mudar = (dia: DiaSemana, campo: keyof Linha, valor: string | boolean) =>
    setLinhas((atual) => atual.map((l) => (l.dia === dia ? { ...l, [campo]: valor } : l)));

  const copiarParaTodos = (origem: Linha) =>
    setLinhas((atual) => atual.map((l) => ({ ...l, aberto: true, abre: origem.abre, fecha: origem.fecha })));

  const abertos = linhas.filter((l) => l.aberto);
  const invalida = abertos.some((l) => !horaValida(l.abre) || !horaValida(l.fecha));
  const viraODia = abertos.filter((l) => l.fecha <= l.abre);

  const carga: Expediente[] = abertos.map((l) => ({ dia: l.dia, abre: l.abre, fecha: l.fecha }));

  return (
    <form action={acao} className="bloco">
      <h3>Dias e horários</h3>
      <p className="contagem">
        O cardápio mostra sozinho se está aberto agora, no fuso do salão. Dia desmarcado é fechado.
      </p>

      <input type="hidden" name="horarios" value={JSON.stringify(carga)} />

      <div className="horarios">
        {linhas.map((l) => {
          const nome = DIAS.find((d) => d.dia === l.dia)!.longo;
          return (
            <div className={`horarios__linha${l.aberto ? "" : " horarios__linha--off"}`} key={l.dia}>
              <label className="horarios__dia">
                <input
                  type="checkbox"
                  checked={l.aberto}
                  onChange={(e) => mudar(l.dia, "aberto", e.target.checked)}
                />
                <span>{nome}</span>
              </label>

              {l.aberto ? (
                <>
                  <span className="horarios__faixa">
                    <input
                      className="campo campo--hora"
                      type="time"
                      value={l.abre}
                      onChange={(e) => mudar(l.dia, "abre", e.target.value)}
                      aria-label={`${nome}: abre`}
                    />
                    <span className="horarios__ate">às</span>
                    <input
                      className="campo campo--hora"
                      type="time"
                      value={l.fecha}
                      onChange={(e) => mudar(l.dia, "fecha", e.target.value)}
                      aria-label={`${nome}: fecha`}
                    />
                  </span>
                  <button type="button" className="bt bt--mini" onClick={() => copiarParaTodos(l)}>
                    Copiar p/ todos
                  </button>
                </>
              ) : (
                <span className="horarios__fechado">Fechado</span>
              )}
            </div>
          );
        })}
      </div>

      {viraODia.length > 0 ? (
        <p className="contagem">
          {viraODia.length === 1 ? "Um dia fecha" : `${viraODia.length} dias fecham`} depois da
          meia-noite. O cardápio entende isso: às 00h30 de domingo ele diz “aberto” pelo expediente
          de sábado, em vez de “fechado”.
        </p>
      ) : null}

      {invalida ? <p className="contagem contagem--curta">Confira as horas preenchidas.</p> : null}
      {estado.erro ? <p className="contagem contagem--curta">{estado.erro}</p> : null}
      {estado.ok ? <p className="contagem">{estado.ok}</p> : null}

      <div className="linha-acoes">
        <BotaoEnviar className="bt bt--ouro" disabled={invalida}>Salvar horários</BotaoEnviar>
      </div>
    </form>
  );
}
