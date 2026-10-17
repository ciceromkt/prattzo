import Link from "next/link";
import { getMenuDoDono, getResultados } from "@prattzo/db";
import {
  capaDoPrato, harmonizacoes, montarGrupos, oportunidades, resultadosDemo, resumoEscrito,
  videoDoPrato, variacao,
} from "@prattzo/core";
import type { Resultados } from "@prattzo/core";
import { requireRestaurant } from "@/lib/supabase";
import { podeDemonstrar } from "@/lib/demo";
import { alternarDemo } from "@/lib/actions";
import { Casca } from "@/components/Casca";
import { Indicadores, Delta } from "@/components/resultados/Indicadores";
import { Evolucao } from "@/components/resultados/Evolucao";
import { RankingPratos, type LinhaRanking } from "@/components/resultados/RankingPratos";
import { Combinacoes, type LinhaPar } from "@/components/resultados/Combinacoes";
import { Oportunidades } from "@/components/resultados/Oportunidades";

export const metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90] as const;

export default async function Resultados({
  searchParams,
}: {
  searchParams?: { dias?: string };
}) {
  const { client, restaurant } = await requireRestaurant();
  const pedido = Number(searchParams?.dias);
  const dias = PERIODOS.includes(pedido as never) ? pedido : 30;

  const menu = await getMenuDoDono(client, restaurant.id);
  const grupos = menu ? montarGrupos(menu.categorias, menu.pratos) : [];

  /**
   * Duas travas antes de mostrar um número inventado: a conta precisa estar
   * autorizada no ambiente E ter o modo ligado. Ver lib/demo.ts.
   */
  const liberado = podeDemonstrar(restaurant.slug);
  const demo = liberado && Boolean(menu?.restaurant.demo_resultados);

  /**
   * Os dois caminhos devolvem a MESMA forma — e nunca se somam. Daqui para
   * baixo a tela não sabe de onde o número veio, que é o que impede, por
   * construção, um dado fictício encostar num real.
   */
  const r: Resultados = demo && menu
    ? resultadosDemo({
        restaurantId: restaurant.id,
        grupos,
        paresPrato: menu.paresPrato,
        paresCategoria: menu.paresCategoria,
        harmonizacao: {
          modo: menu.restaurant.harmonizacao_modo,
          max: menu.restaurant.harmonizacao_max,
          estilo: menu.restaurant.harmonizacao_estilo,
        },
      }, dias)
    : await getResultados(client, restaurant.id, dias);

  // Com quem cada prato harmoniza HOJE na tela do cliente. É a mesma função
  // que o cardápio usa, então a recomendação fala do que está no ar.
  const paresExibidos = new Map<string, string[]>(
    grupos.flatMap((g) => g.pratos).map((p) => [
      p.id,
      menu
        ? harmonizacoes({
            grupos, prato: p,
            paresPrato: menu.paresPrato, paresCategoria: menu.paresCategoria,
            modo: menu.restaurant.harmonizacao_modo, max: menu.restaurant.harmonizacao_max,
            // O mesmo estilo do cardápio: em texto, pratos sem foto também
            // harmonizam, e a recomendação tem de falar do que está no ar.
            estilo: menu.restaurant.harmonizacao_estilo,
          }).map((h) => h.prato.id)
        : [],
    ]),
  );

  const ops = oportunidades({ resultados: r, grupos, paresExibidos });
  const texto = resumoEscrito({ resultados: r, grupos, oportunidades: ops });

  /* ----------------------------------------------------- dados para a tela */
  const nomes = new Map<string, { nome: string; categoria: string }>();
  for (const g of grupos) {
    for (const p of g.pratos) nomes.set(p.id, { nome: p.nome, categoria: g.categoria.nome });
  }
  const pratosPorId = new Map(grupos.flatMap((g) => g.pratos).map((p) => [p.id, p]));
  const antesPorId = new Map(r.pratosAnterior.map((p) => [p.dish_id, p]));

  const linhas: LinhaRanking[] = r.pratos
    .map((p) => {
      const prato = pratosPorId.get(p.dish_id);
      const info = nomes.get(p.dish_id);
      if (!prato || !info) return null;
      const antes = antesPorId.get(p.dish_id);
      return {
        dishId: p.dish_id,
        nome: info.nome,
        categoria: info.categoria,
        capa: capaDoPrato(prato),
        temVideo: videoDoPrato(prato) !== null,
        semMidia: prato.midias.length === 0,
        vistas: p.vistas,
        quis: p.quis,
        vistasAntes: antes?.vistas ?? 0,
        quisAntes: antes?.quis ?? 0,
      } satisfies LinhaRanking;
    })
    .filter((x): x is LinhaRanking => x !== null);

  const paresAntes = new Map(r.paresAnterior.map((p) => [`${p.dish_id}|${p.alvo_id}`, p]));
  const linhasPares: LinhaPar[] = r.pares
    .filter((p) => p.exibicoes > 0 && nomes.has(p.dish_id) && nomes.has(p.alvo_id))
    .map((p) => ({
      chave: `${p.dish_id}|${p.alvo_id}`,
      de: nomes.get(p.dish_id)!.nome,
      para: nomes.get(p.alvo_id)!.nome,
      exibicoes: p.exibicoes,
      cliques: p.cliques,
      cliquesAntes: paresAntes.get(`${p.dish_id}|${p.alvo_id}`)?.cliques ?? 0,
    }));

  // Quem entra no pedido puxado por outro prato.
  const puxados = new Map<string, number>();
  for (const p of r.pares) {
    if (!nomes.has(p.alvo_id)) continue;
    puxados.set(p.alvo_id, (puxados.get(p.alvo_id) ?? 0) + p.cliques);
  }
  const maisPuxados = [...puxados.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, cliques]) => ({ nome: nomes.get(id)!.nome, cliques }));

  // Quem ganhou e quem perdeu interesse contra o período anterior.
  const movimento = linhas
    .filter((l) => l.quisAntes > 0 || l.quis > 0)
    .map((l) => ({ nome: l.nome, de: l.quisAntes, para: l.quis, delta: variacao(l.quis, l.quisAntes) }))
    .filter((m) => m.delta !== null && Math.abs(m.delta) >= 5);
  const ganharam = [...movimento].sort((a, b) => b.delta! - a.delta!).slice(0, 4);
  const perderam = [...movimento].sort((a, b) => a.delta! - b.delta!).slice(0, 4)
    .filter((m) => m.delta! < 0);

  const semNada = !demo && r.resumo.visitas === 0 && r.resumo.pratos_vistos === 0;

  return (
    <Casca
      titulo="Resultados"
      descricao="O que os clientes olham, o que desperta interesse e o que dá para fazer com isso."
    >
      {demo ? <FaixaDemo ligado /> : null}

      <div className="periodo" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/?dias=${p}`}
            className={`chip-ordem${p === dias ? " chip-ordem--ativo" : ""}`}
            aria-current={p === dias ? "true" : undefined}
          >
            {p} dias
          </Link>
        ))}
        {liberado && !demo ? <FaixaDemo ligado={false} /> : null}
      </div>

      {semNada ? (
        <p className="aviso">
          <b>Ainda sem dados.</b> Os números aparecem depois que os primeiros clientes abrirem o
          cardápio pelo QR Code da mesa. Se já houve movimento e nada aparece aqui, o registro de
          eventos pode não estar configurado no servidor.
        </p>
      ) : null}

      <Indicadores r={r} />

      <p className="resumo-cardapio">{texto}</p>

      <Secao titulo="Evolução no período" dica="O eixo do tempo é o mesmo nos três. Passe o cursor para ver um dia.">
        <Evolucao serie={r.serie} />
      </Secao>

      {ganharam.length > 0 || perderam.length > 0 ? (
        <Secao titulo="Quem ganhou e quem perdeu interesse" dica="Variação dos toques em “Quero esse” contra o período anterior.">
          <ul className="variacoes">
            {[...ganharam, ...perderam].map((m) => (
              <li className="variacoes__linha" key={m.nome}>
                <span className="variacoes__nome">{m.nome}</span>
                <span className="variacoes__de-para">{m.de} → {m.para}</span>
                <Delta valor={m.delta} miudo />
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao titulo="Pratos que despertam interesse" dica="Interesse é quem tocou em “Quero esse”. Não é venda fechada.">
        <RankingPratos linhas={linhas} />
      </Secao>

      <Secao titulo="Combinações que despertam desejo" dica="A harmonização que aparece dentro do prato, e quanto dela é aceita.">
        <Combinacoes linhas={linhasPares} maisPuxados={maisPuxados} />
      </Secao>

      <Secao titulo="Oportunidades Prattzo" dica="Cada recomendação traz o número que a sustenta.">
        <Oportunidades itens={ops} />
      </Secao>
    </Casca>
  );
}

function Secao({ titulo, dica, children }: { titulo: string; dica: string; children: React.ReactNode }) {
  return (
    <section className="secao-res">
      <div className="secao-res__cabeca">
        <h2 className="secao-res__titulo">{titulo}</h2>
        <p className="secao-res__dica">{dica}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * O aviso do modo demonstração.
 *
 * Fica visível o tempo todo enquanto o modo está ligado, e não só ao ligar:
 * quem abre a tela dez minutos depois — ou o cliente em potencial olhando por
 * cima do ombro — precisa saber que aqueles números são simulados. Um aviso
 * que some é um aviso que engana.
 */
function FaixaDemo({ ligado }: { ligado: boolean }) {
  return (
    <form action={alternarDemo} className={ligado ? "faixa-demo" : "faixa-demo faixa-demo--off"}>
      <input type="hidden" name="ligar" value={ligado ? "false" : "true"} />
      {ligado ? (
        <>
          <span className="faixa-demo__selo">Modo demonstração</span>
          <span className="faixa-demo__txt">
            Dados simulados sobre os pratos reais deste cardápio. Nada aqui foi gravado, e nenhum
            número real está misturado.
          </span>
        </>
      ) : null}
      <button type="submit" className="bt bt--mini">
        {ligado ? "Ver dados reais" : "Ver demonstração"}
      </button>
    </form>
  );
}
