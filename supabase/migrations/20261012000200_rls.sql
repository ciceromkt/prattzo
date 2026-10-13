-- Isolamento entre restaurantes. Dono só enxerga o que é dele;
-- o público só enxerga cardápio publicado.

alter table public.restaurants     enable row level security;
alter table public.menu_categories enable row level security;
alter table public.dishes          enable row level security;
alter table public.dish_media      enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.events          enable row level security;

-- Dono do restaurante da linha.
create or replace function public.e_dono(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants r where r.id = rid and r.owner_id = auth.uid());
$$;

create or replace function public.esta_publicado(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants r where r.id = rid and r.publicado);
$$;

-- As políticas públicas valem só para `anon`, nunca para `authenticated`.
-- O app do cliente sempre entra anônimo; o painel entra autenticado. Se o
-- público valesse para authenticated, um `select * from dishes` no painel
-- traria os pratos de todo restaurante publicado do Brasil junto com os seus.

-- restaurants
drop policy if exists restaurants_dono on public.restaurants;
create policy restaurants_dono on public.restaurants
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists restaurants_publico on public.restaurants;
create policy restaurants_publico on public.restaurants
  for select to anon using (publicado);

-- categorias e pratos
drop policy if exists categories_dono on public.menu_categories;
create policy categories_dono on public.menu_categories
  for all using (public.e_dono(restaurant_id)) with check (public.e_dono(restaurant_id));
drop policy if exists categories_publico on public.menu_categories;
create policy categories_publico on public.menu_categories
  for select to anon using (ativa and public.esta_publicado(restaurant_id));

drop policy if exists dishes_dono on public.dishes;
create policy dishes_dono on public.dishes
  for all using (public.e_dono(restaurant_id)) with check (public.e_dono(restaurant_id));
drop policy if exists dishes_publico on public.dishes;
create policy dishes_publico on public.dishes
  for select to anon using (ativo and public.esta_publicado(restaurant_id));

drop policy if exists media_dono on public.dish_media;
create policy media_dono on public.dish_media
  for all using (public.e_dono(restaurant_id)) with check (public.e_dono(restaurant_id));
drop policy if exists media_publico on public.dish_media;
create policy media_publico on public.dish_media
  for select to anon using (public.esta_publicado(restaurant_id));

-- Pedido e evento: SÓ O DONO LÊ, e NINGUÉM escreve direto do navegador.
--
-- A chave anônima é pública — vai no código do site. Se o anônimo pudesse
-- gravar aqui, qualquer pessoa com a chave forjaria milhões de pedidos e
-- eventos em qualquer cardápio publicado, e a medição do restaurante viraria
-- lixo. Por isso a escrita passa pelas rotas do servidor, com a chave de
-- serviço, que validam o prato e limitam a frequência por sessão.
--
-- Sem política de insert, a tabela recusa escrita de anon e authenticated; a
-- chave de serviço ignora RLS por definição.
drop policy if exists orders_dono_le on public.orders;
create policy orders_dono_le on public.orders
  for select using (public.e_dono(restaurant_id));

drop policy if exists order_items_dono_le on public.order_items;
create policy order_items_dono_le on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and public.e_dono(o.restaurant_id))
  );

drop policy if exists events_dono_le on public.events;
create policy events_dono_le on public.events
  for select using (public.e_dono(restaurant_id));
