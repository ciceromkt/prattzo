"use client";

const KEY = "pede-esse:sessao";

/**
 * Identificador anônimo por navegador. Nenhum dado pessoal (LGPD).
 * Vive em sessionStorage: termina quando o cliente fecha a aba.
 */
export function getAnonSession(): string {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = novaSessao();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Navegação privada ou storage bloqueado: sessão só em memória.
    return novaSessao();
  }
}

export function clearAnonSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

function novaSessao(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
