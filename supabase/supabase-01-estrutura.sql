-- Pede Esse — estrutura completa do banco.
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do Supabase e rode uma vez.
-- São as 5 migrações do projeto, na ordem:
--   1. tabelas            2. segurança por linha (RLS)
--   3. métricas e bucket  4. reordenação atômica    5. trava de edição simultânea
--
-- Pode rodar de novo sem medo: foi testado rodando duas vezes seguidas.


-- ===================================================================
-- 20261012000100_schema.sql
-- ===================================================================
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

-- ===================================================================
-- 20261012000200_rls.sql
-- ===================================================================
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

-- ===================================================================
-- 20261012000300_metricas_storage.sql
-- ===================================================================
-- Métricas do painel e bucket de mídia.

-- Atenção por prato, últimos 14 dias.
--
-- O `e.restaurant_id = d.restaurant_id` na junção não é redundante: sem ele, o
-- filtro por restaurante só chega em `dishes`, e o Postgres varre a tabela de
-- eventos inteira — a do SaaS todo. Medido: o Gula com 60 mil eventos lia 328
-- mil porque havia um vizinho grande no banco. Com a igualdade, o filtro se
-- propaga e o índice (restaurant_id, criado_em) entra.
create or replace view public.v_atencao_pratos
with (security_invoker = true) as
select
  d.id as dish_id,
  d.restaurant_id,
  d.nome,
  count(*) filter (where e.tipo = 'viu_prato')        as vistas,
  count(*) filter (where e.tipo = 'terminou_video')   as terminou,
  count(*) filter (where e.tipo = 'adicionou_pedido') as quis,
  round(avg(e.ms) filter (where e.tipo = 'viu_prato' and e.ms is not null)) as ms_medio
from public.dishes d
left join public.events e
  on e.dish_id = d.id
 and e.restaurant_id = d.restaurant_id
 and e.criado_em > now() - interval '14 days'
group by d.id, d.restaurant_id, d.nome;

-- Resumo do serviço, últimos 14 dias.
create or replace view public.v_resumo
with (security_invoker = true) as
select
  r.id as restaurant_id,
  count(distinct e.sessao) filter (where e.tipo = 'abriu_cardapio')  as clientes,
  count(*) filter (where e.tipo = 'viu_prato')                       as pratos_vistos,
  count(*) filter (where e.tipo = 'adicionou_pedido')                as adicoes,
  count(*) filter (where e.tipo = 'fechou_pedido')                   as pedidos_fechados,
  count(*) filter (where e.tipo = 'compartilhou')                    as compartilhamentos,
  count(*) filter (where e.tipo = 'viu_sugestao')                    as sugestoes_vistas,
  count(*) filter (where e.tipo = 'aceitou_sugestao')                as sugestoes_aceitas
from public.restaurants r
left join public.events e
  on e.restaurant_id = r.id and e.criado_em > now() - interval '14 days'
group by r.id;

-- Direito de exclusão (LGPD): o cliente apaga o rastro da própria sessão.
create or replace function public.apagar_dados_sessao(p_sessao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.order_items where order_id in (select id from public.orders where sessao = p_sessao);
  delete from public.orders where sessao = p_sessao;
  delete from public.events where sessao = p_sessao;
end $$;
grant execute on function public.apagar_dados_sessao(text) to anon, authenticated;

-- Bucket de mídia: leitura pública, escrita só do dono, na pasta do restaurante.
insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

drop policy if exists midia_leitura on storage.objects;
create policy midia_leitura on storage.objects
  for select to anon, authenticated using (bucket_id = 'midia');

drop policy if exists midia_escrita on storage.objects;
create policy midia_escrita on storage.objects
  for insert to authenticated with check (
    bucket_id = 'midia'
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = auth.uid() and r.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists midia_remocao on storage.objects;
create policy midia_remocao on storage.objects
  for delete to authenticated using (
    bucket_id = 'midia'
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = auth.uid() and r.id::text = (storage.foldername(name))[1]
    )
  );

-- ===================================================================
-- 20261012000400_ordem_atomica.sql
-- ===================================================================
-- Reordenação atômica.
--
-- A primeira versão fazia dois UPDATE em sequência, do lado da aplicação. Com
-- dois gerentes mexendo ao mesmo tempo o resultado é ordem repetida — testado:
-- dois itens ficaram na posição 1 e o terceiro na 2. A partir daqui a troca
-- acontece dentro de uma função, com a categoria travada, e a numeração é
-- refeita antes da troca para que ordens repetidas de antes não atrapalhem.

create or replace function public.mover_prato(p_id uuid, p_direcao text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_rest uuid; v_cat uuid; v_pos int; v_alvo int;
begin
  if p_direcao not in ('cima', 'baixo') then
    raise exception 'direcao invalida: %', p_direcao;
  end if;

  select restaurant_id, category_id into v_rest, v_cat from public.dishes where id = p_id;
  if v_rest is null then return; end if;

  -- Trava os irmãos na ordem do id: duas chamadas simultâneas pegam os mesmos
  -- registros na mesma sequência e não se cruzam (sem deadlock).
  perform 1 from public.dishes
   where restaurant_id = v_rest and category_id is not distinct from v_cat
   order by id for update;

  -- Renumera 0..n-1 pelo critério que a tela usa (ordem, depois nome).
  with ordenado as (
    select id, (row_number() over (order by ordem, nome))::int - 1 as pos
      from public.dishes
     where restaurant_id = v_rest and category_id is not distinct from v_cat
  )
  update public.dishes d set ordem = o.pos
    from ordenado o where d.id = o.id and d.ordem is distinct from o.pos;

  select ordem into v_pos from public.dishes where id = p_id;
  v_alvo := case when p_direcao = 'cima' then v_pos - 1 else v_pos + 1 end;
  if v_alvo < 0 then return; end if;
  if not exists (
    select 1 from public.dishes
     where restaurant_id = v_rest and category_id is not distinct from v_cat and ordem = v_alvo
  ) then return; end if;

  update public.dishes set ordem = v_pos
   where restaurant_id = v_rest and category_id is not distinct from v_cat and ordem = v_alvo;
  update public.dishes set ordem = v_alvo where id = p_id;
end $$;

create or replace function public.mover_categoria(p_id uuid, p_direcao text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_rest uuid; v_pos int; v_alvo int;
begin
  if p_direcao not in ('cima', 'baixo') then
    raise exception 'direcao invalida: %', p_direcao;
  end if;

  select restaurant_id into v_rest from public.menu_categories where id = p_id;
  if v_rest is null then return; end if;

  perform 1 from public.menu_categories where restaurant_id = v_rest order by id for update;

  with ordenado as (
    select id, (row_number() over (order by ordem, nome))::int - 1 as pos
      from public.menu_categories where restaurant_id = v_rest
  )
  update public.menu_categories c set ordem = o.pos
    from ordenado o where c.id = o.id and c.ordem is distinct from o.pos;

  select ordem into v_pos from public.menu_categories where id = p_id;
  v_alvo := case when p_direcao = 'cima' then v_pos - 1 else v_pos + 1 end;
  if v_alvo < 0 then return; end if;
  if not exists (select 1 from public.menu_categories where restaurant_id = v_rest and ordem = v_alvo)
  then return; end if;

  update public.menu_categories set ordem = v_pos where restaurant_id = v_rest and ordem = v_alvo;
  update public.menu_categories set ordem = v_alvo where id = p_id;
end $$;

grant execute on function public.mover_prato(uuid, text) to authenticated;
grant execute on function public.mover_categoria(uuid, text) to authenticated;

-- ===================================================================
-- 20261012000500_versao_linha.sql
-- ===================================================================
-- Trava otimista por número, não por timestamp.
--
-- A primeira versão comparava `atualizado_em`. Parece natural e é frágil: o
-- banco guarda microssegundos, o JSON devolve milissegundos, e a versão que
-- volta do formulário nunca bate. O efeito é o pior possível — TODO salvar é
-- recusado com "outra pessoa editou", sem ninguém ter editado nada. Testado
-- contra o banco: foi assim que apareceu.
--
-- Um inteiro não tem formato, não tem fuso e não tem precisão a perder.

alter table public.dishes add column if not exists versao integer not null default 1;

create or replace function public.toca_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  -- Só as tabelas que têm a coluna participam da trava.
  if to_jsonb(new) ? 'versao' then
    new.versao = coalesce(old.versao, 0) + 1;
  end if;
  return new;
end $$;
