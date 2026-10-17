-- Resultados por janela de tempo, com período anterior para comparar.
--
-- As views `v_resumo` e `v_atencao_pratos` são fixas em 14 dias: servem para
-- "como foi a quinzena", não para um painel com filtro de 7, 30 e 90 dias — e
-- não têm como responder "quanto isso mudou em relação ao período anterior",
-- que é o número que diz se uma mudança no cardápio funcionou.
--
-- Aqui cada função recebe o tamanho da janela (`p_dias`) e um deslocamento
-- (`p_desloc`, em dias). O período anterior é a MESMA função com
-- `p_desloc = p_dias`: mesma largura, logo antes. Um só lugar define o
-- recorte, então os dois lados da comparação nunca medem coisas diferentes.
--
-- `security invoker`: a leitura passa pela política de RLS de events, que é o
-- que impede uma casa de ler o movimento da outra.

-- Cada função limita a janela a 1..365 dias. Sem isso, um parâmetro grande
-- vira varredura da tabela inteira a cada carregamento da tela.
create or replace function public.resumo_periodo(
  p_restaurant uuid, p_dias int default 30, p_desloc int default 0
) returns table (
  visitas bigint, pratos_vistos bigint, quero bigint,
  harmonizacao_vistas bigint, harmonizacao_cliques bigint,
  compartilhamentos bigint, pedidos_fechados bigint,
  sugestoes_vistas bigint, sugestoes_aceitas bigint
) language sql stable set search_path = public as $$
  with j as (
    select greatest(1, least(coalesce(p_dias, 30), 365)) as dias,
           greatest(0, least(coalesce(p_desloc, 0), 365)) as desloc
  ),
  e as (
    select ev.* from public.events ev, j
     where ev.restaurant_id = p_restaurant
       and ev.criado_em >= now() - make_interval(days => j.dias + j.desloc)
       and ev.criado_em <  now() - make_interval(days => j.desloc)
  )
  select
    count(distinct sessao) filter (where tipo = 'abriu_cardapio'),
    count(*) filter (where tipo = 'viu_prato'),
    count(*) filter (where tipo = 'adicionou_pedido'),
    count(*) filter (where tipo = 'viu_harmonizacao'),
    count(*) filter (where tipo = 'clicou_harmonizacao'),
    count(*) filter (where tipo = 'compartilhou'),
    count(*) filter (where tipo = 'fechou_pedido'),
    count(*) filter (where tipo = 'viu_sugestao'),
    count(*) filter (where tipo = 'aceitou_sugestao')
  from e;
$$;

-- Por prato. Traz TODOS os pratos ativos, inclusive os de zero: "ninguém viu
-- este" é justamente a informação que gera a oportunidade de posicionamento.
create or replace function public.pratos_periodo(
  p_restaurant uuid, p_dias int default 30, p_desloc int default 0
) returns table (
  dish_id uuid, vistas bigint, terminou bigint, quis bigint,
  compartilhou bigint, ms_medio int
) language sql stable set search_path = public as $$
  with j as (
    select greatest(1, least(coalesce(p_dias, 30), 365)) as dias,
           greatest(0, least(coalesce(p_desloc, 0), 365)) as desloc
  ),
  e as (
    select ev.* from public.events ev, j
     where ev.restaurant_id = p_restaurant and ev.dish_id is not null
       and ev.criado_em >= now() - make_interval(days => j.dias + j.desloc)
       and ev.criado_em <  now() - make_interval(days => j.desloc)
  )
  select
    d.id,
    count(e.id) filter (where e.tipo = 'viu_prato'),
    count(e.id) filter (where e.tipo = 'terminou_video'),
    count(e.id) filter (where e.tipo = 'adicionou_pedido'),
    count(e.id) filter (where e.tipo = 'compartilhou'),
    avg(e.ms) filter (where e.tipo = 'viu_prato')::int
  from public.dishes d
  left join e on e.dish_id = d.id
  where d.restaurant_id = p_restaurant
  group by d.id;
$$;

-- Por par de harmonização, nos dois sentidos em que ele foi oferecido.
create or replace function public.pares_periodo(
  p_restaurant uuid, p_dias int default 30, p_desloc int default 0
) returns table (
  dish_id uuid, alvo_id uuid, exibicoes bigint, cliques bigint
) language sql stable set search_path = public as $$
  with j as (
    select greatest(1, least(coalesce(p_dias, 30), 365)) as dias,
           greatest(0, least(coalesce(p_desloc, 0), 365)) as desloc
  )
  select
    ev.dish_id, ev.alvo_id,
    count(*) filter (where ev.tipo = 'viu_harmonizacao'),
    count(*) filter (where ev.tipo = 'clicou_harmonizacao')
  from public.events ev, j
  where ev.restaurant_id = p_restaurant
    and ev.tipo in ('viu_harmonizacao', 'clicou_harmonizacao')
    and ev.dish_id is not null and ev.alvo_id is not null
    and ev.criado_em >= now() - make_interval(days => j.dias + j.desloc)
    and ev.criado_em <  now() - make_interval(days => j.desloc)
  group by ev.dish_id, ev.alvo_id;
$$;

-- Série diária, para os gráficos. Dias sem movimento vêm com zero: um buraco
-- no gráfico lido como "não houve dado" conta outra história.
create or replace function public.serie_periodo(
  p_restaurant uuid, p_dias int default 30
) returns table (
  dia date, visitas bigint, vistas bigint, quero bigint, harmonizacao bigint
) language sql stable set search_path = public as $$
  with j as (select greatest(1, least(coalesce(p_dias, 30), 365)) as dias),
  dias as (
    select generate_series(
      (current_date - (select dias - 1 from j))::date, current_date, interval '1 day'
    )::date as dia
  ),
  e as (
    select ev.criado_em::date as dia, ev.tipo, ev.sessao
      from public.events ev, j
     where ev.restaurant_id = p_restaurant
       and ev.criado_em >= current_date - make_interval(days => (select dias - 1 from j))
  )
  select
    dias.dia,
    count(distinct e.sessao) filter (where e.tipo = 'abriu_cardapio'),
    count(*) filter (where e.tipo = 'viu_prato'),
    count(*) filter (where e.tipo = 'adicionou_pedido'),
    count(*) filter (where e.tipo = 'clicou_harmonizacao')
  from dias left join e on e.dia = dias.dia
  group by dias.dia order by dias.dia;
$$;

grant execute on function public.resumo_periodo(uuid, int, int) to authenticated;
grant execute on function public.pratos_periodo(uuid, int, int) to authenticated;
grant execute on function public.pares_periodo(uuid, int, int) to authenticated;
grant execute on function public.serie_periodo(uuid, int) to authenticated;
