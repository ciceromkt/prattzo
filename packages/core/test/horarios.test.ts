import { describe, expect, it } from "vitest";
import {
  emMinutos, estadoAgora, horaCurta, horaValida, lerExpedientes, semanaCompleta,
  type Expediente,
} from "../src/horarios";

const SP = "America/Sao_Paulo";

/** Instante UTC a partir de uma hora de São Paulo (UTC-3, sem horário de verão). */
const sp = (iso: string) => new Date(`${iso}:00-03:00`);

// Outubro de 2026: 12 = segunda … 18 = domingo.
const SEGUNDA = "2026-10-12";
const SABADO = "2026-10-17";
const DOMINGO = "2026-10-18";

const bar: Expediente[] = [
  { dia: 3, abre: "18:00", fecha: "23:30" }, // quarta
  { dia: 4, abre: "18:00", fecha: "00:00" }, // quinta, fecha na virada
  { dia: 5, abre: "18:00", fecha: "02:00" }, // sexta, vira o dia
  { dia: 6, abre: "12:00", fecha: "02:00" }, // sábado, vira o dia
  { dia: 0, abre: "12:00", fecha: "22:00" }, // domingo
];

describe("leitura e formato", () => {
  it("aceita hora válida e recusa o resto", () => {
    expect(horaValida("18:00")).toBe(true);
    expect(horaValida("02:30")).toBe(true);
    expect(horaValida("24:00")).toBe(false);
    expect(horaValida("7:00")).toBe(false);
    expect(horaValida("18h")).toBe(false);
  });

  it("fala a hora como gente, não como relógio digital", () => {
    expect(horaCurta("18:00")).toBe("18h");
    expect(horaCurta("18:30")).toBe("18h30");
    expect(horaCurta("02:00")).toBe("2h");
  });

  it("converte para minutos", () => {
    expect(emMinutos("00:00")).toBe(0);
    expect(emMinutos("18:30")).toBe(1110);
    expect(emMinutos("nada")).toBe(null);
  });

  it("descarta lixo vindo do banco sem derrubar nada", () => {
    expect(lerExpedientes(null)).toEqual([]);
    expect(lerExpedientes("[]")).toEqual([]);
    expect(lerExpedientes([{ dia: 9, abre: "18:00", fecha: "02:00" }])).toEqual([]);
    expect(lerExpedientes([{ dia: 1, abre: "25:00", fecha: "02:00" }])).toEqual([]);
    expect(lerExpedientes([{ dia: 1.5, abre: "18:00", fecha: "02:00" }])).toEqual([]);
  });

  it("guarda um expediente por dia e devolve em ordem", () => {
    const lido = lerExpedientes([
      { dia: 5, abre: "18:00", fecha: "02:00" },
      { dia: 1, abre: "10:00", fecha: "15:00" },
      { dia: 1, abre: "19:00", fecha: "23:00" },
    ]);
    expect(lido.map((e) => e.dia)).toEqual([1, 5]);
    expect(lido[1]!.abre).toBe("18:00");
  });
});

describe("estado agora", () => {
  it("sem agenda cadastrada, não afirma que está fechado", () => {
    const e = estadoAgora([], SP, sp(`${SEGUNDA}T03:00`));
    expect(e.aberto).toBe(true);
    expect(e.texto).toBe("");
  });

  it("dia sem expediente é fechado", () => {
    // Segunda não está na agenda do bar.
    expect(estadoAgora(bar, SP, sp(`${SEGUNDA}T20:00`)).texto).toBe("Fechado hoje");
  });

  it("antes de abrir, diz a que horas abre", () => {
    const e = estadoAgora(bar, SP, sp(`${SABADO}T10:00`));
    expect(e.aberto).toBe(false);
    expect(e.texto).toBe("Abre hoje às 12h");
  });

  it("dentro do expediente, diz até que horas vai", () => {
    const e = estadoAgora(bar, SP, sp(`${SABADO}T20:00`));
    expect(e.aberto).toBe(true);
    expect(e.texto).toBe("Aberto até 2h");
  });

  /**
   * O caso que motivou o arquivo: 00h30 de domingo, o salão está aberto pelo
   * expediente de sábado. Olhar só o dia de hoje escreveria "Abre hoje às 12h"
   * com o bar cheio.
   */
  it("madrugada: continua aberto pelo expediente da véspera", () => {
    const e = estadoAgora(bar, SP, sp(`${DOMINGO}T00:30`));
    expect(e.aberto).toBe(true);
    expect(e.texto).toBe("Aberto até 2h");
  });

  it("passada a hora de fechar da véspera, volta a valer o dia de hoje", () => {
    const e = estadoAgora(bar, SP, sp(`${DOMINGO}T03:00`));
    expect(e.aberto).toBe(false);
    expect(e.texto).toBe("Abre hoje às 12h");
  });

  it("depois de fechar, num dia que não vira", () => {
    const e = estadoAgora(bar, SP, sp(`${DOMINGO}T23:00`));
    expect(e.aberto).toBe(false);
    expect(e.texto).toBe("Fechado agora");
  });

  it("fechar às 00:00 conta como virada do dia, não como zero", () => {
    // Quinta fecha "00:00": às 23h ainda está aberto.
    const e = estadoAgora(bar, SP, sp("2026-10-15T23:00"));
    expect(e.aberto).toBe(true);
  });

  it("o fuso do salão manda, não o do servidor", () => {
    // 23h em São Paulo é 21h em Rio Branco (UTC-5): lá ainda não fechou.
    const agenda: Expediente[] = [{ dia: 6, abre: "12:00", fecha: "22:00" }];
    const instante = sp(`${SABADO}T23:00`);
    expect(estadoAgora(agenda, SP, instante).aberto).toBe(false);
    expect(estadoAgora(agenda, "America/Rio_Branco", instante).aberto).toBe(true);
  });
});

describe("semana completa", () => {
  it("lista os sete dias, marcando os fechados", () => {
    const s = semanaCompleta(bar);
    expect(s).toHaveLength(7);
    expect(s[1]!.texto).toBe("Fechado");
    expect(s[5]!.texto).toBe("18h às 2h");
    expect(s[0]!.longo).toBe("Domingo");
  });
});
