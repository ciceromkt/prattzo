import { getRestaurantDoUsuario } from "@pede-esse/db";
import { requireRestaurant } from "@/lib/supabase";
import { Casca } from "@/components/Casca";
import { FormularioRestaurante } from "@/components/FormularioRestaurante";
import { alternarPublicado } from "@/lib/actions";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function Configuracoes() {
  const { client, user } = await requireRestaurant();
  const r = await getRestaurantDoUsuario(client, user.id);
  if (!r) return null;

  return (
    <Casca titulo="Configurações" descricao="Identidade do cardápio e publicação.">
      <section className="bloco">
        <h3>Publicar</h3>
        <p className="dica">
          Enquanto está em rascunho, ninguém vê o cardápio — nem com o link. Publique só quando os
          preços estiverem conferidos.
        </p>
        <form action={alternarPublicado}>
          <input type="hidden" name="publicar" value={r.publicado ? "false" : "true"} />
          <button type="submit" className={`bt${r.publicado ? "" : " bt--ouro"}`}>
            {r.publicado ? "Despublicar cardápio" : "Publicar cardápio"}
          </button>
        </form>
      </section>

      <FormularioRestaurante restaurante={r} />
    </Casca>
  );
}
