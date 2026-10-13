"use client";

import { useFormStatus } from "react-dom";

/** Botão que mostra estado de envio. Usado nos formulários de Server Action. */
export function BotaoEnviar({
  children,
  carregando = "Salvando…",
  className = "botao",
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  carregando?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Trava o envio quando o próprio formulário já sabe que o dado está inválido. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} style={style}>
      {pending ? carregando : children}
    </button>
  );
}
