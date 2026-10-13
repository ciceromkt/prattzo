"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Resultados", icone: "◷" },
  { href: "/cardapio", rotulo: "Cardápio", icone: "▸" },
  { href: "/qrcode", rotulo: "QR Code", icone: "▦" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "⚙" },
];

export function MenuLateral() {
  const caminho = usePathname();

  return (
    <nav aria-label="Menu principal">
      <ul className="menu">
        {ITENS.map((item) => {
          const ativo = item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`menu__link${ativo ? " menu__link--ativo" : ""}`}
                aria-current={ativo ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icone}</span>
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
