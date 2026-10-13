"use client";

import { useFormStatus } from "react-dom";

/** Botão que mostra estado de envio. Usado nos formulários de Server Action. */
export function BotaoEnviar({
  children,
  carregando = "Salvando…",
  className = "botao",
  style,
}: {
  children: React.ReactNode;
  carregando?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} style={style}>
      {pending ? carregando : children}
    </button>
  );
}
