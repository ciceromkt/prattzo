import { montarGrupos, capaDaCategoria, diagnosticar, opcoesDeCapa } from "@pede-esse/core";
import { getMenuDoDono } from "@pede-esse/db";
import { requireRestaurant } from "@/lib/supabase";
import { Casca } from "@/components/Casca";
import { PainelCardapio } from "@/components/PainelCardapio";

export const metadata = { title: "Cardápio" };
export const dynamic = "force-dynamic";

export default async function PaginaCardapio() {
  const { client, restaurant } = await requireRestaurant();
  const dados = await getMenuDoDono(client, restaurant.id);
  if (!dados) return null;

  // O dono vê tudo, inclusive o que está desativado e a categoria vazia.
  const grupos = montarGrupos(dados.categorias, dados.pratos, false);
  const diag = diagnosticar(grupos);

  const capas = grupos.map((g) => ({
    id: g.categoria.id,
    nome: g.categoria.nome,
    atual: capaDaCategoria(g),
    escolhida: g.categoria.capa_url,
    itens: g.pratos.length,
    opcoes: opcoesDeCapa(g),
  }));

  return (
    <Casca titulo="Cardápio" descricao="Itens, capas e o que ainda falta cadastrar.">
      <PainelCardapio
        grupos={grupos.map((g) => ({
          categoria: g.categoria,
          pratos: g.pratos.map((p) => ({
            id: p.id,
            nome: p.nome,
            descricao: p.descricao,
            preco_min_centavos: p.preco_min_centavos,
            preco_max_centavos: p.preco_max_centavos,
            ativo: p.ativo,
            esgotado_ate: p.esgotado_ate,
            destaque: p.destaque,
            versao: p.versao,
            category_id: p.category_id,
            midias: p.midias,
          })),
        }))}
        capas={capas}
        pendencias={diag.pendencias}
      />
    </Casca>
  );
}
