import { getAtencao, getResumo } from "@pede-esse/db";
import { requireRestaurant } from "@/lib/supabase";
import { Casca } from "@/components/Casca";

export const metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

export default async function Resultados() {
  const { client, restaurant } = await requireRestaurant();
  const [resumo, atencao] = await Promise.all([
    getResumo(client, restaurant.id),
    getAtencao(client, restaurant.id),
  ]);

  const comVistas = atencao.filter((a) => a.vistas > 0);
  const maior = Math.max(1, ...comVistas.map((a) => a.vistas));
  const taxa = resumo && resumo.pratos_vistos > 0
    ? Math.round((resumo.adicoes / resumo.pratos_vistos) * 100)
    : 0;

  return (
    <Casca titulo="Resultados" descricao="Últimos 14 dias. Só itens com mídia geram medição de atenção.">
      <div className="metricas">
        <Metrica valor={String(resumo?.clientes ?? 0)} rotulo="Clientes no cardápio" />
        <Metrica valor={String(resumo?.pratos_vistos ?? 0)} rotulo="Pratos assistidos" />
        <Metrica valor={String(resumo?.adicoes ?? 0)} rotulo="Toques em “Quero esse”" extra={`${taxa}% de quem assistiu`} />
        <Metrica valor={String(resumo?.pedidos_fechados ?? 0)} rotulo="Pedidos fechados" />
        <Metrica valor={String(resumo?.compartilhamentos ?? 0)} rotulo="Compartilhamentos" />
        <Metrica
          valor={String(resumo?.sugestoes_aceitas ?? 0)}
          rotulo="Sugestões aceitas"
          extra={
            resumo && resumo.sugestoes_vistas > 0
              ? `${Math.round((resumo.sugestoes_aceitas / resumo.sugestoes_vistas) * 100)}% de quem viu`
              : undefined
          }
        />
      </div>

      {comVistas.length === 0 ? (
        <p className="aviso">
          <b>Ainda sem dados.</b> Os números aparecem depois que os primeiros clientes abrirem o
          cardápio pelo QR Code da mesa.
        </p>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-principal">Item</th>
                <th className="num">Assistido por</th>
                <th>Relativo</th>
                <th className="num">Terminou o vídeo</th>
                <th className="num">Quero esse</th>
              </tr>
            </thead>
            <tbody>
              {comVistas.map((a) => (
                <tr key={a.dish_id}>
                  <td className="col-principal">{a.nome}</td>
                  <td className="num">{a.vistas}</td>
                  <td>
                    <span className="medidor">
                      <span style={{ width: `${Math.round((a.vistas / maior) * 100)}%` }} />
                    </span>
                  </td>
                  <td className="num">{a.vistas > 0 ? `${Math.round((a.terminou / a.vistas) * 100)}%` : "—"}</td>
                  <td className="num">{a.quis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="dica">
        A taxa entre “assistido” e “Quero esse” é o sinal mais importante: diz se o vídeo está dando
        vontade. Abaixo de 15%, costuma ser vídeo parado ou descrição fraca, não o prato.
      </p>
    </Casca>
  );
}

function Metrica({ valor, rotulo, extra }: { valor: string; rotulo: string; extra?: string }) {
  return (
    <div className="metrica">
      <b>{valor}</b>
      <span>{rotulo}</span>
      {extra ? <i>{extra}</i> : null}
    </div>
  );
}
