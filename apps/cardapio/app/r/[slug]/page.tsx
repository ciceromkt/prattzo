import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient, getPublicMenu } from "@prattzo/db";
import { Cardapio } from "@/components/Cardapio";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const menu = await getPublicMenu(createPublicClient(), params.slug);
  if (!menu) return { title: "Cardápio não encontrado" };
  return {
    title: `${menu.restaurant.nome} — Cardápio`,
    description: menu.restaurant.descricao || `Cardápio do ${menu.restaurant.nome}, prato por prato, em vídeo.`,
    openGraph: {
      title: menu.restaurant.nome,
      description: menu.restaurant.descricao || "Veja o cardápio antes de pedir.",
      type: "website",
    },
  };
}

export default async function PaginaCardapio({ params }: { params: { slug: string } }) {
  const menu = await getPublicMenu(createPublicClient(), params.slug);
  if (!menu) notFound();
  return <Cardapio menu={menu} />;
}
