import type { Metadata } from "next";
import { BRAND } from "@prattzo/core";
import "@prattzo/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: `Painel — ${BRAND.name}`,
  description: "Gestão do cardápio, mídia dos pratos e medição de resultados.",
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
