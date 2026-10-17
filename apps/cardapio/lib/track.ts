"use client";

import { getAnonSession } from "./session";

export type EventoTipo =
  | "abriu_cardapio" | "abriu_categoria" | "viu_prato" | "terminou_video"
  | "adicionou_pedido" | "fechou_pedido" | "compartilhou"
  /** Sugestão do fechamento do pedido. */
  | "viu_sugestao" | "aceitou_sugestao"
  /** Harmonização dentro do prato: dishId = prato aberto, alvoId = o par. */
  | "viu_harmonizacao" | "clicou_harmonizacao";

export interface TrackedEvent {
  restaurantId: string;
  tipo: EventoTipo;
  dishId?: string;
  /** O outro lado do par, nos eventos de harmonização. */
  alvoId?: string;
  ms?: number;
}

const FLUSH_MS = 4000;
const MAX_BATCH = 20;

const buffers = new Map<string, TrackedEvent[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Enfileira um evento e envia em lote.
 * Falha de rede nunca atrapalha o cliente: o erro é engolido de propósito.
 */
export function track(event: TrackedEvent): void {
  const { restaurantId } = event;
  const list = buffers.get(restaurantId) ?? [];
  list.push(event);
  buffers.set(restaurantId, list);

  if (list.length >= MAX_BATCH) {
    flush(restaurantId);
    return;
  }
  if (!timers.has(restaurantId)) {
    timers.set(
      restaurantId,
      setTimeout(() => flush(restaurantId), FLUSH_MS),
    );
  }
}

export function flush(restaurantId: string): void {
  const timer = timers.get(restaurantId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(restaurantId);
  }
  const events = buffers.get(restaurantId);
  if (!events || events.length === 0) return;
  buffers.set(restaurantId, []);

  const body = JSON.stringify({ restaurantId, sessao: getAnonSession(), events });

  // sendBeacon sobrevive ao fechamento da aba.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const ok = navigator.sendBeacon("/api/eventos", new Blob([body], { type: "application/json" }));
      if (ok) return;
    } catch {
      // cai no fetch
    }
  }
  void fetch("/api/eventos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function flushAll(): void {
  for (const id of [...buffers.keys()]) flush(id);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}
