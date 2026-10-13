type Level = "info" | "warn" | "error";

function emit(level: Level, mensagem: string, fields: Record<string, unknown> = {}): void {
  const linha = JSON.stringify({ ts: new Date().toISOString(), level, app: "painel", mensagem, ...fields });
  if (level === "error") console.error(linha);
  else if (level === "warn") console.warn(linha);
  else console.log(linha);
}

export const log = {
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};

export async function reportError(mensagem: string, erro: unknown, fields: Record<string, unknown> = {}): Promise<void> {
  const detalhe = erro instanceof Error ? { erro: erro.message, stack: erro.stack?.slice(0, 1500) } : { erro: String(erro) };
  log.error(mensagem, { ...fields, ...detalhe });

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `[painel] ${mensagem}: ${detalhe.erro ?? ""}` }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // monitoramento não derruba a requisição
  }
}
