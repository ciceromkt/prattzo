-- A harmonização passa a ter eventos próprios — e um segundo prato na linha.
--
-- Até aqui a tira "Harmoniza com", dentro do prato, gravava `viu_sugestao`:
-- o MESMO tipo que a sugestão do fechamento do pedido, que é outra coisa, em
-- outra tela, com outra intenção. Somados, não dizem nada sobre nenhuma das
-- duas. E o clique na harmonização não era gravado em lugar nenhum: dava para
-- saber que a oferta apareceu, nunca que alguém a aceitou.
--
-- `alvo_id` é o segundo prato do par. Uma harmonização é uma relação — "Risoto
-- puxa o Chardonnay" —, e com uma coluna só de prato o painel contaria
-- exibições soltas sem saber de quem para quem. Com os dois lados, a leitura
-- vira "Picanha + Drink: 185 exibições, 42 interações", que é o que o dono
-- precisa para decidir se mantém o par.
alter table public.events
  add column if not exists alvo_id uuid references public.dishes(id) on delete set null;

alter table public.events drop constraint if exists events_tipo_check;
alter table public.events add constraint events_tipo_check check (tipo in (
  'abriu_cardapio',
  'abriu_categoria',
  'viu_prato',
  'terminou_video',
  'adicionou_pedido',
  'fechou_pedido',
  'compartilhou',
  -- Sugestão do fechamento do pedido: outra tela, outro momento.
  'viu_sugestao',
  'aceitou_sugestao',
  -- Harmonização dentro do prato. dish_id = o prato aberto, alvo_id = o par.
  'viu_harmonizacao',
  'clicou_harmonizacao'
));

-- O painel lê sempre por restaurante e por janela de tempo; sem isto, 90 dias
-- de eventos viram varredura da tabela a cada carregamento da tela.
create index if not exists events_restaurante_data on public.events (restaurant_id, criado_em desc);
create index if not exists events_par on public.events (restaurant_id, dish_id, alvo_id)
  where tipo in ('viu_harmonizacao', 'clicou_harmonizacao');
