\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into public.restaurants (id, owner_id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Gula','gula');
insert into public.menu_categories (id, restaurant_id, nome, ordem) values
  ('c1000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Comidas',0);
insert into public.dishes (id, restaurant_id, category_id, nome, descricao, preco_min_centavos, ordem) values
  ('d1000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','Panceta','desc A',1000,0),
  ('d1000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','Picanha','desc B',2000,1),
  ('d1000000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','Coxinha','desc C',3000,2);
select 'cenario pronto';
