-- Esquema do cardápio digital com vídeo.
-- Produto: o cliente assiste, separa o que quer e mostra a própria lista ao garçom.
-- Nada de IA, nada de recomendação, nada de pedido enviado para a cozinha.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- restaurante
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,48}$'),
  descricao text not null default '',
  logo_url text,
  -- Vídeo de ambiente que roda atrás do topo do cardápio.
  video_capa_url text,
  horario_texto text not null default '',
  -- Fuso IANA do salão. A virada do "esgotado" é calculada aqui, não no
  -- relógio do servidor, que roda em UTC.
  fuso text not null default 'America/Sao_Paulo',
  link_google text,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists restaurants_owner_idx on public.restaurants (owner_id);

-- ----------------------------------------------------------------- categorias
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 60),
  ordem integer not null default 0,
  ativa boolean not null default true,
  -- Capa escolhida pelo dono. Nula = o cardápio sugere a primeira mídia da categoria.
  capa_url text,
  criado_em timestamptz not null default now()
);
create index if not exists menu_categories_rest_idx on public.menu_categories (restaurant_id, ordem);

-- --------------------------------------------------------------------- pratos
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  nome text not null check (length(trim(nome)) between 2 and 120),
  descricao text not null default '',
  -- Preço base em centavos. 0 = não cadastrado, e a tela diz isso em voz alta.
  preco_min_centavos integer not null default 0
    check (preco_min_centavos >= 0 and preco_min_centavos < 10000000),
  -- Teto da faixa ("R$ 23,00 até R$ 31,00"). Nulo = preço único.
  preco_max_centavos integer
    check (preco_max_centavos is null or (preco_max_centavos >= preco_min_centavos and preco_max_centavos < 10000000)),
  ordem integer not null default 0,
  ativo boolean not null default true,
  -- Esgotado até este instante. Passou, volta sozinho: ninguém precisa desmarcar.
  esgotado_ate timestamptz,
  -- Passa à frente na sugestão de fechamento de pedido.
  destaque boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists dishes_rest_idx on public.dishes (restaurant_id, ordem);
create index if not exists dishes_cat_idx on public.dishes (category_id, ordem);

-- ---------------------------------------------------------------------- mídia
-- Um prato tem várias imagens: a picanha do Gula tem quatro fotos e um vídeo.
create table if not exists public.dish_media (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tipo text not null check (tipo in ('foto', 'video')),
  url text not null,
  -- Quadro de capa do vídeo, extraído no envio.
  poster_url text,
  duracao_s numeric(5,2),
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  constraint dish_media_video_tem_poster check (tipo <> 'video' or poster_url is not null)
);
create index if not exists dish_media_dish_idx on public.dish_media (dish_id, ordem);

-- -------------------------------------------------------------------- pedidos
-- O que o cliente separou. Não vai para a cozinha: serve para o dono saber o
-- que deu vontade e comparar com o que de fato foi vendido no PDV.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  sessao text not null,
  total_centavos integer not null default 0,
  aproximado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists orders_rest_idx on public.orders (restaurant_id, criado_em desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete set null,
  -- Nome congelado no momento: o prato pode ser renomeado ou apagado depois.
  nome text not null,
  quantidade integer not null check (quantidade > 0 and quantidade < 100),
  preco_centavos integer not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- --------------------------------------------------------------------- eventos
create table if not exists public.events (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  sessao text not null,
  tipo text not null check (tipo in (
    'abriu_cardapio', 'abriu_categoria', 'viu_prato', 'terminou_video',
    'adicionou_pedido', 'fechou_pedido', 'compartilhou',
    'viu_sugestao', 'aceitou_sugestao'
  )),
  dish_id uuid references public.dishes (id) on delete set null,
  ms integer,
  criado_em timestamptz not null default now()
);
create index if not exists events_rest_idx on public.events (restaurant_id, criado_em desc);
create index if not exists events_dish_idx on public.events (dish_id, tipo);
-- Serve às views do painel: filtram por restaurante e pelos últimos 14 dias.
create index if not exists events_rest_data_tipo_idx on public.events (restaurant_id, criado_em desc, tipo);

-- --------------------------------------------------------- atualizado_em
create or replace function public.toca_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists restaurants_touch on public.restaurants;
create trigger restaurants_touch before update on public.restaurants
  for each row execute function public.toca_atualizado_em();
drop trigger if exists dishes_touch on public.dishes;
create trigger dishes_touch before update on public.dishes
  for each row execute function public.toca_atualizado_em();
