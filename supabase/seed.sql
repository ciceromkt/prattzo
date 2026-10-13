-- Cardápio de demonstração do Gula, para ver o produto rodando antes do cadastro real.
-- Uso: psql "$DATABASE_URL" -v owner="'UUID-DO-USUARIO'" -f supabase/seed.sql

insert into public.restaurants (owner_id, nome, slug, descricao, horario_texto, publicado)
values (:owner::uuid, 'Gula Rooftop', 'gula', 'Rooftop em Heliópolis, São Paulo', 'Aberto até 02:00', true)
on conflict (slug) do nothing;

with r as (select id from public.restaurants where slug = 'gula')
insert into public.menu_categories (restaurant_id, nome, ordem)
select r.id, c.nome, c.ordem from r, (values
  ('Entradas', 0), ('Porções', 1), ('Comidas', 2),
  ('Lanches', 3), ('Drinks', 4), ('Sobremesas', 5)
) as c(nome, ordem);

with r as (select id from public.restaurants where slug = 'gula'),
     c as (select id, nome from public.menu_categories where restaurant_id = (select id from r))
insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem)
select (select id from r), c.id, d.nome, d.descricao, d.pmin, d.pmax, d.ordem
from c join (values
  ('Entradas', 'Panceta do Gula', 'Crocância por fora que você escuta na primeira mordida e carne macia e suculenta por dentro.', 5900, null, 0),
  ('Entradas', 'Dadinhos de Tapioca', 'Crocantes por fora, macios por dentro. 8 unidades com geleia de pimenta.', 3700, null, 1),
  -- Propositalmente incompleto: serve para a tela de pendências ter o que apontar.
  ('Entradas', 'Bolinho de Cupim', '', 0, null, 2),
  ('Comidas', 'Picanha no Rechaud', '500g de picanha no ponto escolhido, com farofa da casa, vinagrete e maionese.', 12680, 16490, 0),
  ('Comidas', 'Peixe frito do Gula', 'Bem dourado, crocante por fora e macio por dentro. Farto, feito para o meio da mesa.', 6500, 9800, 1),
  ('Drinks', 'Perfeitinha', 'Gin, xarope de maracujá vermelho, limão, tangerina, frutas vermelhas e hortelã.', 3300, null, 0),
  ('Sobremesas', 'Esfera de Chocolate', 'Brownie em esfera com sorvete de creme e calda quente derramada na mesa.', 2900, null, 0)
) as d(categoria, nome, descricao, pmin, pmax, ordem) on c.nome = d.categoria;
