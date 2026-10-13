\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- Dois donos, dois restaurantes. É a proteção que impede um ver o cardápio do outro.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'gula@teste'),
  ('22222222-2222-2222-2222-222222222222', 'rival@teste');

insert into public.restaurants (id, owner_id, nome, slug, publicado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Gula Rooftop', 'gula', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Rival', 'rival', false);

insert into public.menu_categories (id, restaurant_id, nome, ordem) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Entradas', 0),
  ('c2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Secreta', 0);

insert into public.dishes (id, restaurant_id, category_id, nome, preco_min_centavos, ordem) values
  ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Panceta', 5900, 0),
  ('d1000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Item desativado', 1000, 1),
  ('d2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'Receita do rival', 9900, 0);
update public.dishes set ativo = false where id = 'd1000000-0000-0000-0000-000000000009';

\echo '--- 1. dono A logado: só pode ver o restaurante dele'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'restaurantes visiveis para A: ' || count(*) || ' (esperado 2: o dele + o rival publicado? rival NAO esta publicado, entao 1)' from public.restaurants;
select 'pratos visiveis para A: ' || string_agg(nome, ', ' order by nome) from public.dishes;

\echo '--- 2. dono B logado'
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select 'pratos visiveis para B: ' || string_agg(nome, ', ' order by nome) from public.dishes;

\echo '--- 3. publico anonimo: so cardapio publicado e item ativo'
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select 'restaurantes publicos: ' || coalesce(string_agg(nome, ', '), '(nenhum)') from public.restaurants;
select 'pratos publicos: ' || coalesce(string_agg(nome, ', '), '(nenhum)') from public.dishes;

\echo '--- 4. anonimo tentando escrever no cardapio (tem que falhar)'
do $$
begin
  insert into public.dishes (restaurant_id, nome, preco_min_centavos)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Invasao', 100);
  raise exception 'FALHA DE SEGURANCA: anonimo conseguiu inserir prato';
exception when insufficient_privilege or check_violation then
  raise notice 'OK: anonimo bloqueado de escrever (%)', sqlerrm;
end $$;

\echo '--- 5. dono A tentando editar prato do rival (tem que nao afetar nada)'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
with t as (update public.dishes set preco_min_centavos = 1 where id = 'd2000000-0000-0000-0000-000000000002' returning 1)
select 'linhas do rival alteradas por A: ' || count(*) || ' (esperado 0)' from t;
reset role;
select 'preco real do prato do rival: ' || preco_min_centavos || ' (esperado 9900)' from public.dishes where id = 'd2000000-0000-0000-0000-000000000002';
