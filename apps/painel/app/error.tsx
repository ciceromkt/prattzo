"use client";

import { useEffect } from "react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(
      JSON.stringify({ level: "error", app: "painel", mensagem: "erro_cliente", erro: error.message, digest: error.digest }),
    );
  }, [error]);

  return (
    <div className="auth">
      <main className="auth__caixa">
        <h1 className="auth__titulo">Algo deu errado</h1>
        <p className="auth__sub">
          Não conseguimos carregar esta tela. Se persistir, confira as variáveis de ambiente do Supabase.
        </p>
        <button type="button" className="botao botao--grande" onClick={reset}>
          Tentar de novo
        </button>
      </main>
    </div>
  );
}
