/**
 * Quem pode ligar o modo demonstração.
 *
 * A coluna `restaurants.demo_resultados` guarda o estado ligado/desligado.
 * Ela sozinha não basta: uma coluna é um valor, e qualquer caminho de escrita
 * futuro — um script, um bug, uma tela nova — poderia virá-la para um cliente
 * pagante, que passaria a ver números inventados achando que são dele.
 *
 * Por isso o direito de ligar vive FORA do banco, numa variável de ambiente
 * com a lista de slugs autorizados. Para um restaurante fora da lista o
 * painel nem mostra o interruptor, e ignora a coluna mesmo que ela esteja
 * ligada. São duas travas que falham em direções diferentes.
 *
 * Lista vazia (o padrão) = ninguém demonstra. É o lado seguro: o pior caso de
 * esquecer a variável é a demonstração não aparecer, não um cliente vendo
 * dado falso.
 */
export function podeDemonstrar(slug: string): boolean {
  const lista = (process.env.DEMO_RESULTADOS_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(slug.toLowerCase());
}
