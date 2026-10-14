-- Quem escolhe o que harmoniza, e quantas sugestões aparecem.
--
-- A regra de harmonização já era dos dois: par exato que o dono escreve, e
-- regra de categoria que ele marca. Faltava ele poder dizer QUANTO de cada um
-- quer — tem casa que só aceita o que o chef escolheu a dedo, e tem casa que
-- marca as categorias uma vez e não quer pensar mais nisso.
--
-- O padrão é 'misto' e UMA sugestão. Uma, e não duas, porque uma lida como
-- conselho da casa e duas lidam como vitrine; e porque o segundo cartão empurra
-- o "Quero esse" para baixo. Quem discordar muda aqui — e o painel já conta
-- quantas sugestões foram vistas e aceitas, então daqui a um mês a escolha
-- deixa de ser gosto e vira número.
alter table public.restaurants
  add column if not exists harmonizacao_modo text not null default 'misto'
    check (harmonizacao_modo in ('curado', 'misto', 'automatico')),
  add column if not exists harmonizacao_max smallint not null default 1
    check (harmonizacao_max between 1 and 2);
