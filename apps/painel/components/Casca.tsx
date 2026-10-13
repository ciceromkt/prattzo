import { MenuLateral } from "./MenuLateral";
import { CascaVisual } from "./CascaVisual";
import { sair } from "@/lib/actions";
import { requireRestaurant } from "@/lib/supabase";

export async function Casca({
  children,
  titulo,
  descricao,
  acoes,
}: {
  children: React.ReactNode;
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  const { restaurant: restaurante } = await requireRestaurant();
  const urlCardapio = `${process.env.NEXT_PUBLIC_CARDAPIO_URL ?? "http://localhost:3000"}/r/${restaurante.slug}`;

  return (
    <CascaVisual
      titulo={titulo}
      descricao={descricao}
      acoes={acoes}
      restaurante={restaurante}
      nav={<MenuLateral />}
      rodape={
        <>
          <a href={urlCardapio} target="_blank" rel="noopener noreferrer" className="botao botao--texto">
            ↗ Ver cardápio público
          </a>
          <form action={sair}>
            <button type="submit" className="botao botao--texto">Sair</button>
          </form>
        </>
      }
    >
      {children}
    </CascaVisual>
  );
}
