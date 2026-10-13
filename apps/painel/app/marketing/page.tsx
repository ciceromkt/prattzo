import { getRestaurantDoUsuario } from "@prattzo/db";
import { requireRestaurant } from "@/lib/supabase";
import { Casca } from "@/components/Casca";
import { CopiarLink } from "@/components/CopiarLink";
import { FormularioMarketing } from "@/components/FormularioMarketing";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

/**
 * O que serve para trazer cliente e trazer de volta.
 *
 * Existe separado de Configurações de propósito: lá é identidade da casa, coisa
 * que se mexe uma vez. Aqui é o que o dono volta para olhar — e misturar os
 * dois faz o link de avaliação virar mais um campo no meio do formulário, em
 * vez de uma alavanca de venda.
 */
export default async function Marketing() {
  const { client, user, restaurant } = await requireRestaurant();
  const r = await getRestaurantDoUsuario(client, user.id);
  if (!r) return null;

  const base = process.env.NEXT_PUBLIC_CARDAPIO_URL ?? "http://localhost:3000";
  const url = `${base}/r/${restaurant.slug}`;

  return (
    <Casca titulo="Marketing" descricao="O que traz cliente e o que o faz voltar.">
      <section className="bloco">
        <h3>Link do cardápio</h3>
        <p className="contagem">
          Serve na bio do Instagram, no WhatsApp e na resposta a quem pergunta o cardápio. É o mesmo
          endereço do QR Code das mesas.
        </p>
        <CopiarLink url={url} />
        {!r.publicado ? (
          <p className="aviso aviso--erro">
            O cardápio está como rascunho: quem abrir o link vê “cardápio não encontrado”. Publique
            em Configurações antes de divulgar.
          </p>
        ) : null}
      </section>

      <FormularioMarketing restaurante={r} />

      <section className="bloco">
        <h3>Em breve</h3>
        <p className="contagem">
          Campanha de item parado — o cardápio sabe quais pratos são muito vistos e pouco pedidos.
          Hoje isso aparece em Resultados; a ideia é virar ação a partir dali.
        </p>
      </section>
    </Casca>
  );
}
