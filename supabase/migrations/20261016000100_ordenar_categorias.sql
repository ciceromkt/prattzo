-- Gravar a ordem INTEIRA das categorias de uma vez.
--
-- Já existia `mover_categoria`, que troca uma categoria com a vizinha. Serve
-- para um ajuste, não para arrumar o cardápio: tirar Drinks do fim para o
-- começo de uma casa com nove categorias são oito idas ao servidor, cada uma
-- revalidando as duas pontas do cache. E o dono não quer mover uma casa, ele
-- quer experimentar arranjos até achar o melhor.
--
-- Aqui ele arrasta à vontade na tela e grava uma vez. A lista chega completa e
-- na ordem final; a função escreve a posição de cada uma pelo índice no array,
-- numa transação só, com as linhas travadas — duas abas do painel não se
-- atropelam.
create or replace function public.ordenar_categorias(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_rest uuid;
  v_n int;
begin
  v_n := coalesce(array_length(p_ids, 1), 0);
  if v_n = 0 then return; end if;

  -- Id repetido faria duas categorias terminarem na mesma posição.
  if v_n <> (select count(distinct id) from unnest(p_ids) as u(id)) then
    raise exception 'ordenar_categorias: id repetido';
  end if;

  select restaurant_id into v_rest from public.menu_categories where id = p_ids[1];
  if v_rest is null then return; end if;

  -- Mistura de casas: a lista de um restaurante nunca pode reposicionar a de
  -- outro. A política do RLS já barraria a escrita, mas o erro aqui é claro.
  if exists (
    select 1 from public.menu_categories
      where id = any(p_ids) and restaurant_id is distinct from v_rest
  ) then
    raise exception 'ordenar_categorias: categorias de casas diferentes';
  end if;

  -- A lista tem de cobrir TODAS as categorias da casa. Ordenar um pedaço
  -- deixaria as de fora com posições que colidem com as reescritas.
  if v_n <> (select count(*) from public.menu_categories where restaurant_id = v_rest) then
    raise exception 'ordenar_categorias: lista incompleta';
  end if;

  perform 1 from public.menu_categories where restaurant_id = v_rest order by id for update;

  update public.menu_categories c
     set ordem = p.pos
    from (
      select id, (i - 1)::int as pos from unnest(p_ids) with ordinality as t(id, i)
    ) p
   where c.id = p.id and c.ordem is distinct from p.pos;
end $$;

grant execute on function public.ordenar_categorias(uuid[]) to authenticated;
