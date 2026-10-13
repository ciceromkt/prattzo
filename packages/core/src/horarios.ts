/**
 * Dias e horários de funcionamento.
 *
 * O caso que quebra as implementações ingênuas é o do bar: abre às 18h e fecha
 * às 02h — a hora de fechar é MENOR que a de abrir, e pertence ao dia seguinte.
 * Às 00h30 de domingo o salão está aberto, mas pelo expediente de SÁBADO, e um
 * cardápio que olhe só o dia de hoje escreve "Fechado" com o salão cheio.
 *
 * Então "está aberto agora" olha dois expedientes: o de hoje e o de ontem que
 * ainda não terminou. E tudo é calculado no fuso do salão, nunca no do servidor.
 */

/** 0 = domingo … 6 = sábado, igual a `Date.getDay()`. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Expediente {
  dia: DiaSemana;
  /** "18:00" */
  abre: string;
  /** "02:00" — menor que `abre` significa que vira o dia. */
  fecha: string;
}

export const DIAS: ReadonlyArray<{ dia: DiaSemana; curto: string; longo: string }> = [
  { dia: 0, curto: "Dom", longo: "Domingo" },
  { dia: 1, curto: "Seg", longo: "Segunda" },
  { dia: 2, curto: "Ter", longo: "Terça" },
  { dia: 3, curto: "Qua", longo: "Quarta" },
  { dia: 4, curto: "Qui", longo: "Quinta" },
  { dia: 5, curto: "Sex", longo: "Sexta" },
  { dia: 6, curto: "Sáb", longo: "Sábado" },
];

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function horaValida(h: string): boolean {
  return HORA.test(h);
}

/** "18:00" → 1080. Devolve null se não for hora. */
export function emMinutos(h: string): number | null {
  const m = HORA.exec(h);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "18:00" → "18h"; "18:30" → "18h30". Como se fala, não como se digita. */
export function horaCurta(h: string): string {
  const m = HORA.exec(h);
  if (!m) return h;
  return m[2] === "00" ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`;
}

/** Aceita o que vier do banco sem confiar: jsonb é texto livre até ser validado. */
export function lerExpedientes(bruto: unknown): Expediente[] {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<number>();
  const saida: Expediente[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const { dia, abre, fecha } = item as Record<string, unknown>;
    if (typeof dia !== "number" || dia < 0 || dia > 6 || !Number.isInteger(dia)) continue;
    if (typeof abre !== "string" || typeof fecha !== "string") continue;
    if (!horaValida(abre) || !horaValida(fecha)) continue;
    // Um expediente por dia: o segundo seria ambíguo para "fecha às".
    if (vistos.has(dia)) continue;
    vistos.add(dia);
    saida.push({ dia: dia as DiaSemana, abre, fecha });
  }
  return saida.sort((a, b) => a.dia - b.dia);
}

/** Minutos desde a meia-noite e o dia da semana, no fuso do salão. */
function agoraNoFuso(agora: Date, fuso: string): { dia: DiaSemana; minutos: number } {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const partes = Object.fromEntries(f.formatToParts(agora).map((p) => [p.type, p.value]));
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dia = Math.max(0, semana.indexOf(String(partes.weekday))) as DiaSemana;
  // Alguns fusos formatam meia-noite como "24"; normaliza para 0.
  const hora = Number(partes.hour) % 24;
  return { dia, minutos: hora * 60 + Number(partes.minute) };
}

const ontem = (d: DiaSemana): DiaSemana => (((d + 6) % 7) as DiaSemana);

export interface EstadoHorario {
  /** O salão está aberto neste instante. */
  aberto: boolean;
  /** "Aberto até 02h", "Fecha às 23h", "Abre hoje às 18h", "Fechado hoje". */
  texto: string;
  /** Expediente de hoje, se houver. */
  hoje: Expediente | null;
}

/**
 * O que dizer no topo do cardápio, agora.
 *
 * Sem expediente cadastrado devolve `aberto: true` e texto vazio: é melhor não
 * dizer nada do que afirmar "fechado" para um restaurante que só não preencheu
 * a agenda — o cliente está com o celular na mão, dentro do salão.
 */
export function estadoAgora(
  expedientes: Expediente[],
  fuso: string,
  agora: Date = new Date(),
): EstadoHorario {
  if (expedientes.length === 0) return { aberto: true, texto: "", hoje: null };

  const { dia, minutos } = agoraNoFuso(agora, fuso);
  const porDia = new Map(expedientes.map((e) => [e.dia, e]));
  const hoje = porDia.get(dia) ?? null;

  // 1. O expediente de ontem que atravessou a meia-noite ainda vale?
  const vespera = porDia.get(ontem(dia));
  if (vespera) {
    const abre = emMinutos(vespera.abre)!;
    const fecha = emMinutos(vespera.fecha)!;
    if (fecha <= abre && minutos < fecha) {
      return { aberto: true, texto: `Aberto até ${horaCurta(vespera.fecha)}`, hoje };
    }
  }

  if (!hoje) return { aberto: false, texto: "Fechado hoje", hoje: null };

  const abre = emMinutos(hoje.abre)!;
  const fecha = emMinutos(hoje.fecha)!;
  const viraODia = fecha <= abre;

  if (minutos < abre) {
    return { aberto: false, texto: `Abre hoje às ${horaCurta(hoje.abre)}`, hoje };
  }
  if (viraODia || minutos < fecha) {
    return { aberto: true, texto: `Aberto até ${horaCurta(hoje.fecha)}`, hoje };
  }
  return { aberto: false, texto: "Fechado agora", hoje };
}

/** Linha por linha, para a tela que mostra a semana inteira. */
export function semanaCompleta(expedientes: Expediente[]): Array<{
  dia: DiaSemana; longo: string; texto: string;
}> {
  const porDia = new Map(expedientes.map((e) => [e.dia, e]));
  return DIAS.map(({ dia, longo }) => {
    const e = porDia.get(dia);
    return {
      dia,
      longo,
      texto: e ? `${horaCurta(e.abre)} às ${horaCurta(e.fecha)}` : "Fechado",
    };
  });
}
