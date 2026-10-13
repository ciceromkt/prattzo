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
