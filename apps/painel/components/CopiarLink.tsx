"use client";

import { useState } from "react";

/**
 * Copiar o endereço do cardápio. O QR é opcional: na página de Marketing só
 * interessa o link, e carregar os botões de baixar e imprimir ali seria ruído.
 */
export function CopiarLink({ url, svg, nome }: { url: string; svg?: string; nome?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de clipboard: o campo abaixo permite copiar à mão.
    }
  }

  function baixarSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `qrcode-${nome ?? "cardapio"}.svg`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <>
      <input className="campo__entrada" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <div className="acoes-linha" style={{ marginTop: 12 }}>
        <button type="button" className="botao botao--neutro" onClick={copiar}>
          {copiado ? "✓ Copiado" : "Copiar link"}
        </button>
        {svg ? (
          <>
            <button type="button" className="botao botao--neutro" onClick={baixarSvg}>
              Baixar QR Code (SVG)
            </button>
            <button type="button" className="botao botao--neutro" onClick={() => window.print()}>
              Imprimir
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
