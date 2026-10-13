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
