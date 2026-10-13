/** Log estruturado de servidor. Monitoramento desde o início (requisito do briefing). */

type Level = "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, mensagem: string, fields: LogFields = {}): void {
  const linha = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    app: "cardapio",
    mensagem,
    ...fields,
  });
  if (level === "error") console.error(linha);
  else if (level === "warn") console.warn(linha);
  else console.log(linha);
}

export const log = {
  info: (mensagem: string, fields?: LogFields) => emit("info", mensagem, fields),
  warn: (mensagem: string, fields?: LogFields) => emit("warn", mensagem, fields),
  error: (mensagem: string, fields?: LogFields) => emit("error", mensagem, fields),
};

/** Envia o erro ao webhook de monitoramento, se configurado. Nunca lança. */
export async function reportError(mensagem: string, erro: unknown, fields: LogFields = {}): Promise<void> {
  const detalhe = erro instanceof Error ? { erro: erro.message, stack: erro.stack?.slice(0, 1500) } : { erro: String(erro) };
  log.error(mensagem, { ...fields, ...detalhe });

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `[cardapio] ${mensagem}: ${detalhe.erro ?? ""}` }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // monitoramento não pode derrubar a requisição
  }
}
