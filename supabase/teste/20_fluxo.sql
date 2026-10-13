\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'gula@teste');
insert into public.restaurants (id, owner_id, nome, slug, publicado, fuso) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Gula', 'gula', true, 'America/Sao_Paulo');
insert into public.menu_categories (id, restaurant_id, nome, ordem) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Comidas', 0);
insert into public.dishes (id, restaurant_id, category_id, nome, preco_min_centavos, preco_max_centavos, ordem) values
  ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Picanha', 12680, 16490, 0),
  ('d1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Peixe', 6500, null, 1);

\echo '--- restrições do banco (tem que recusar dado ruim)'
do $$
declare ok int := 0;
begin
  begin insert into public.dishes (restaurant_id, nome, preco_min_centavos) values ('aaaaaaaa-0000-0000-0000-000000000001','X',-100);
  exception when check_violation then ok := ok+1; end;
  begin insert into public.dishes (restaurant_id, nome, preco_min_centavos, preco_max_centavos) values ('aaaaaaaa-0000-0000-0000-000000000001','Y',5000,1000);
  exception when check_violation then ok := ok+1; end;
  begin insert into public.dishes (restaurant_id, nome) values ('aaaaaaaa-0000-0000-0000-000000000001','A');
  exception when check_violation then ok := ok+1; end;
  begin insert into public.dish_media (dish_id, restaurant_id, tipo, url) values ('d1000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','video','v.mp4');
  exception when check_violation then ok := ok+1; end;
  begin insert into public.order_items (order_id, nome, quantidade) values (gen_random_uuid(),'X',0);
  exception when check_violation or foreign_key_violation then ok := ok+1; end;
  raise notice 'restricoes que funcionaram: % de 5', ok;
end $$;

\echo '--- a rota do servidor grava o pedido (chave de servico)'
set role service_role;
with o as (
  insert into public.orders (restaurant_id, sessao, total_centavos, aproximado)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'sessao-abc', 19180, true) returning id
)
insert into public.order_items (order_id, dish_id, nome, quantidade, preco_centavos)
select o.id, d.id, d.nome, 1, d.preco_min_centavos from o, public.dishes d;

insert into public.events (restaurant_id, sessao, tipo, dish_id, ms) values
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','abriu_cardapio',null,null),
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','viu_prato','d1000000-0000-0000-0000-000000000001',9000),
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','terminou_video','d1000000-0000-0000-0000-000000000001',null),
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','adicionou_pedido','d1000000-0000-0000-0000-000000000001',null),
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','viu_sugestao',null,null),
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','aceitou_sugestao','d1000000-0000-0000-0000-000000000002',null),
  ('aaaaaaaa-0000-0000-0000-000000000001','sessao-abc','fechou_pedido',null,null);
select 'pedido gravado por anonimo: ok';

\echo '--- anonimo NAO le nem escreve pedido'
reset role; set role anon;
select 'pedidos que o anonimo le: ' || count(*) || ' (esperado 0)' from public.orders;
do $$
begin
  insert into public.events (restaurant_id, sessao, tipo)
  values ('aaaaaaaa-0000-0000-0000-000000000001','forjada','fechou_pedido');
  raise exception 'FALHA: anonimo forjou evento';
exception when insufficient_privilege then
  raise notice 'OK: anonimo nao consegue forjar evento';
end $$;

\echo '--- dono le as metricas'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select 'pedidos do dono: ' || count(*) from public.orders;
select 'resumo: clientes=' || clientes || ' vistos=' || pratos_vistos || ' adicoes=' || adicoes
       || ' fechados=' || pedidos_fechados || ' sug_vistas=' || sugestoes_vistas || ' sug_aceitas=' || sugestoes_aceitas
  from public.v_resumo where restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'atencao ' || nome || ': vistas=' || vistas || ' terminou=' || terminou || ' quis=' || quis || ' ms=' || coalesce(ms_medio::text,'-')
  from public.v_atencao_pratos where restaurant_id='aaaaaaaa-0000-0000-0000-000000000001' order by nome;

\echo '--- LGPD: cliente apaga a propria sessao (funcao security definer)'
reset role; set role anon;
select public.apagar_dados_sessao('sessao-abc');
reset role;
select 'apos apagar -> eventos=' || (select count(*) from public.events)
    || ' pedidos=' || (select count(*) from public.orders)
    || ' itens=' || (select count(*) from public.order_items) || ' (esperado 0 0 0)';
