-- O prato por dentro, e com o que ele vai bem.
--
-- Duas coisas que o cliente pergunta ao garçom e o cardápio não respondia:
-- "o que vem nesse dadinho de tapioca?" e "o que combina com o risoto?".
--
-- A segunda NÃO é modelo adivinhando. Harmonização é conhecimento do salão, e
-- quem tem é o dono: ele marca, uma vez, quais categorias combinam entre si
-- ("Drinks vai com Petiscos") e, quando quiser, o par exato com a justificativa
-- ("o Chardonnay corta a manteiga do risoto"). O cardápio só resolve e mostra —
-- determinístico, explicável, e errado só se o dono errou.

-- ------------------------------------------------------- o prato por dentro
alter table public.dishes
  -- Um ingrediente por posição. Lista em vez de texto corrido porque a tela
  -- mostra em etiquetas, e porque "o que vem nele" é consultado, não lido.
  add column if not exists ingredientes text[] not null default '{}',
  -- "Serve 2 pessoas", "350 ml", "12 unidades". Texto livre de propósito: cada
  -- casa mede do seu jeito, e número com unidade fixa não cobre bar nenhum.
  add column if not exists serve text not null default '';

-- ------------------------------------------------- harmonização por categoria
-- O trabalho que o dono faz uma vez: 6 categorias, não 26 pratos.
--
-- O par é NÃO ORDENADO: a mesma linha responde "o que bebo com o risoto" e "o
-- que como com o vinho", que é exatamente o que foi pedido. O check `a_id <
-- b_id` garante que o par existe uma vez só, nunca duplicado ao contrário, e
-- impede categoria casada consigo mesma.
create table if not exists public.category_pairings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  a_id uuid not null references public.menu_categories (id) on delete cascade,
  b_id uuid not null references public.menu_categories (id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint category_pairings_par_ordenado check (a_id < b_id)
);
create unique index if not exists category_pairings_unico on public.category_pairings (a_id, b_id);
create index if not exists category_pairings_rest_idx on public.category_pairings (restaurant_id);

-- ---------------------------------------------------- harmonização por prato
-- A exceção curada, que passa à frente da regra da categoria e carrega o
-- porquê. É aqui que o cardápio soa como o maître da casa, e não como lista.
create table if not exists public.dish_pairings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  a_id uuid not null references public.dishes (id) on delete cascade,
  b_id uuid not null references public.dishes (id) on delete cascade,
  -- A frase do dono, mostrada nos dois sentidos. Vazia = só "harmoniza".
  nota text not null default '' check (length(nota) <= 140),
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  constraint dish_pairings_par_ordenado check (a_id < b_id)
);
create unique index if not exists dish_pairings_unico on public.dish_pairings (a_id, b_id);
create index if not exists dish_pairings_rest_idx on public.dish_pairings (restaurant_id, ordem);

-- ------------------------------------------------------------------- acesso
alter table public.category_pairings enable row level security;
alter table public.dish_pairings     enable row level security;

-- `create policy` não aceita `if not exists`, e este arquivo precisa poder
-- rodar duas vezes seguidas sem quebrar — foi assim que as migrações anteriores
-- foram testadas. Daí a conferência no catálogo antes de criar.
do $$
begin
  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'category_pairings' and policyname = 'category_pairings_dono') then
    create policy category_pairings_dono on public.category_pairings
      for all using (public.e_dono(restaurant_id)) with check (public.e_dono(restaurant_id));
  end if;

  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'category_pairings' and policyname = 'category_pairings_publico') then
    create policy category_pairings_publico on public.category_pairings
      for select to anon using (public.esta_publicado(restaurant_id));
  end if;

  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dish_pairings' and policyname = 'dish_pairings_dono') then
    create policy dish_pairings_dono on public.dish_pairings
      for all using (public.e_dono(restaurant_id)) with check (public.e_dono(restaurant_id));
  end if;

  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dish_pairings' and policyname = 'dish_pairings_publico') then
    create policy dish_pairings_publico on public.dish_pairings
      for select to anon using (public.esta_publicado(restaurant_id));
  end if;
end $$;
