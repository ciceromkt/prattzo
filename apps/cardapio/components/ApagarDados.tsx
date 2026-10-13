"use client";

import { useState } from "react";
import { clearAnonSession, getAnonSession } from "@/lib/session";

export function ApagarDados() {
  const [estado, setEstado] = useState<"pronto" | "indo" | "feito" | "erro">("pronto");

  async function apagar() {
    setEstado("indo");
    try {
      const r = await fetch("/api/privacidade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao: getAnonSession() }),
      });
      if (!r.ok) throw new Error();
      clearAnonSession();
      setEstado("feito");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "feito") return <p>Pronto. Os dados desta sessão foram apagados.</p>;

  return (
    <>
      <button type="button" className="btn-vazio" onClick={apagar} disabled={estado === "indo"}>
        {estado === "indo" ? "Apagando…" : "Apagar meus dados desta sessão"}
      </button>
      {estado === "erro" ? <p>Não deu certo agora. Tente de novo em instantes.</p> : null}
    </>
  );
}
