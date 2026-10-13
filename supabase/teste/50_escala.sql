\pset format unaligned
\pset tuples_only on
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into public.restaurants (id, owner_id, nome, slug, publicado) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Gigante','gigante',true);

-- 37 categorias e 230 itens: o cardápio real do dguests que eu extraí.
insert into public.menu_categories (restaurant_id, nome, ordem)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'Categoria ' || g, g from generate_series(1,37) g;

insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, ordem)
select 'aaaaaaaa-0000-0000-0000-000000000001', c.id,
       'Prato ' || g, repeat('descricao com ingredientes e textura. ', 3), 1000 + g * 37, g
from generate_series(1,230) g
join lateral (select id from public.menu_categories order by (g % 37), id limit 1) c on true;

-- média de 2,5 mídias por prato
insert into public.dish_media (dish_id, restaurant_id, tipo, url, poster_url, ordem)
select d.id, d.restaurant_id, 'foto', 'https://cdn/x.jpg', null, s
from public.dishes d, generate_series(0, 2) s where (s = 0) or (random() < 0.75);

-- 60 mil eventos: cerca de um mês de um salão movimentado
insert into public.events (restaurant_id, sessao, tipo, dish_id, ms, criado_em)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'sessao-' || (g % 4000),
       (array['abriu_cardapio','viu_prato','terminou_video','adicionou_pedido','fechou_pedido'])[1 + (g % 5)],
       (select id from public.dishes order by md5(g::text || id::text) limit 1),
       (random() * 12000)::int,
       now() - (random() * interval '30 days')
from generate_series(1, 60000) g;

select 'cardapio: ' || (select count(*) from public.menu_categories) || ' categorias, '
    || (select count(*) from public.dishes) || ' pratos, '
    || (select count(*) from public.dish_media) || ' midias, '
    || (select count(*) from public.events) || ' eventos';
