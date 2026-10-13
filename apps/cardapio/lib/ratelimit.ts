/**
 * Limite simples por sessão/IP, em memória.
 *
 * Protege as rotas que escrevem: pedido, evento e privacidade. Em memória
 * significa por instância — numa só máquina resolve; com várias, cada uma tem a
 * sua contagem. Trocar por Redis é item conhecido antes de escalar.
 */

interface Bucket {
  tokens: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(chave: string, limite: number, janelaMs: number): { ok: boolean; restante: number } {
  const agora = Date.now();
  const atual = buckets.get(chave);

  if (!atual || atual.reset < agora) {
    buckets.set(chave, { tokens: limite - 1, reset: agora + janelaMs });
    return { ok: true, restante: limite - 1 };
  }
  if (atual.tokens <= 0) return { ok: false, restante: 0 };

  atual.tokens -= 1;
  return { ok: true, restante: atual.tokens };
}

/** Limpa buckets vencidos para a memória não crescer sem limite. */
export function cleanupRateLimits(): void {
  const agora = Date.now();
  for (const [chave, bucket] of buckets) {
    if (bucket.reset < agora) buckets.delete(chave);
  }
}
