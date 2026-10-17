-- Interruptor do modo demonstração, por casa. Nasce desligado: nenhum
-- restaurante vê número fictício sem alguém ligar de propósito.
--
-- Quem PODE ligar não é decidido aqui: o painel confere a lista de slugs
-- autorizados (DEMO_RESULTADOS_SLUGS) antes de mostrar o interruptor e antes
-- de aceitar o estado ligado. Duas travas, porque uma coluna sozinha é um
-- valor que qualquer caminho de escrita futuro poderia virar.
alter table public.restaurants
  add column if not exists demo_resultados boolean not null default false;
