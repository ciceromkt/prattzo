"use client";

import { useEffect } from "react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", app: "cardapio", mensagem: "erro_cliente", erro: error.message, digest: error.digest }));
  }, [error]);

  return (
    <div className="tela">
      <main className="conteudo" style={{ paddingTop: 80, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 760 }}>Algo deu errado</h1>
        <p style={{ color: "var(--cor-tinta-media)", marginTop: 10 }}>
          Tente de novo. Se continuar, chame o garçom para pedir o cardápio impresso.
        </p>
        <button type="button" className="botao" style={{ marginTop: 24 }} onClick={reset}>
          Tentar de novo
        </button>
      </main>
    </div>
  );
}
