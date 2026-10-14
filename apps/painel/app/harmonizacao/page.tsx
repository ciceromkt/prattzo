import { hasPrice, montarGrupos, temMidia } from "@prattzo/core";
import { getMenuDoDono } from "@prattzo/db";
import { requireRestaurant } from "@/lib/supabase";
import { Casca } from "@/components/Casca";
import { EditorHarmonizacao } from "@/components/EditorHarmonizacao";
import type { ParPratoView, PratoOpcao } from "@/components/EditorHarmonizacao";

export const metadata = { title: "Harmonização" };
export const dynamic = "force-dynamic";

/**
 * Página própria, não uma aba do Cardápio.
 *
 * No Cardápio o dono cadastra item: nome, preço, foto. Aqui ele decide o que
 * combina com o quê — é a cabeça do maître, não a do estoquista, e se mexe uma
 * vez por temporada. Misturar as duas coisas enterraria a harmonização no meio
 * do formulário de 26 pratos, que é onde recurso morre.
 */
export default async function PaginaHarmonizacao() {
  const { client, restaurant } = await requireRestaurant();
  const dados = await getMenuDoDono(client, restaurant.id);
  if (!dados) return null;

  const grupos = montarGrupos(dados.categorias, dados.pratos, false)
    .filter((g) => g.categoria.id !== "sem-categoria");

  const nomes = new Map(dados.pratos.map((p) => [p.id, p.nome]));

  const paresPrato: ParPratoView[] = dados.paresPrato
    // Par cujo item foi excluído some junto no banco; este filtro é só defesa.
    .filter((p) => nomes.has(p.a_id) && nomes.has(p.b_id))
    .map((p) => ({
      id: p.id,
      nota: p.nota,
      a: { id: p.a_id, nome: nomes.get(p.a_id)! },
      b: { id: p.b_id, nome: nomes.get(p.b_id)! },
    }));

  // "Pronto" = o cardápio de fato mostraria este item como harmonização. São os
  // mesmos cortes da regra: fora do cardápio, sem preço ou sem imagem não entra.
  const opcoes: PratoOpcao[] = grupos.flatMap((g) =>
    g.pratos.map((p) => ({
      id: p.id,
      nome: p.nome,
      categoria: g.categoria.nome,
      pronto: p.ativo && hasPrice(p) && temMidia(p),
    })),
  );

  return (
    <Casca
      titulo="Harmonização"
      descricao="Com o que cada coisa vai bem. O cliente vê isso dentro do prato."
    >
      <EditorHarmonizacao
        categorias={grupos.map((g) => ({
          id: g.categoria.id,
          nome: g.categoria.nome,
          itens: g.pratos.length,
        }))}
        paresCategoria={dados.paresCategoria}
        paresPrato={paresPrato}
        opcoes={opcoes}
      />
    </Casca>
  );
}
