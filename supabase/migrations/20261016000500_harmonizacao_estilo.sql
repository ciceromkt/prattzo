-- Como a harmonização APARECE dentro do prato: cartão com foto, ou só a frase.
--
-- Não é só estética. O cartão com foto exige que o item sugerido TENHA foto —
-- um cartão de imagem sem imagem é um buraco. Por isso a regra de
-- harmonização sempre descartou quem não tem mídia, e drinks sem foto nunca
-- puderam ser sugeridos, por melhor que combinassem.
--
-- No estilo texto essa exigência perde o sentido: a oferta é uma frase, e uma
-- frase funciona sem foto. É o estilo que decide, então, se o item precisa de
-- mídia para entrar.
alter table public.restaurants
  add column if not exists harmonizacao_estilo text not null default 'cartao'
    check (harmonizacao_estilo in ('cartao', 'texto'));
