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
