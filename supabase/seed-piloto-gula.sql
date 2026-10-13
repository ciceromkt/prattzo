-- Cardápio do Gula Rooftop — DADO DO CLIENTE PILOTO, não do produto.
--
-- Cada restaurante que entrar no Prattzo ganha as próprias linhas, pelo painel.
-- Este arquivo existe só para montar o piloto de novo sem recadastrar 26 pratos
-- à mão. Não é exemplo a copiar para um cliente novo.
--
-- Rode DEPOIS do arquivo de estrutura e DEPOIS de criar o seu usuário.
-- Troque as duas linhas abaixo e mande o arquivo inteiro de uma vez.

do $seed$
declare
  -- Os nomes começam com v_ de propósito: uma variável chamada "email" colide
  -- com a coluna email de auth.users e o plpgsql recusa a consulta.
  v_base  text := 'https://SEU-PROJETO.supabase.co';   -- Settings > API > Project URL
  v_email text := 'ciceromktdigital@gmail.com';        -- o e-mail com que você entra no painel
  v_dono  uuid;
  v_rest  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  c_id    uuid;
  d_id    uuid;
begin
  select u.id into v_dono from auth.users u where u.email = v_email;
  if v_dono is null then
    raise exception 'Nenhum usuário com o e-mail %. Entre no painel uma vez (ou crie em Authentication > Users) e rode de novo.', v_email;
  end if;

  delete from public.restaurants where id = v_rest;

  insert into public.restaurants (id, owner_id, nome, slug, descricao, horario_texto, video_capa_url, fuso, publicado)
  values (v_rest, v_dono, 'Gula Rooftop', 'gula', 'Rooftop em Heliópolis, São Paulo',
          'Aberto até 02:00', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/caipirinha.mp4', 'America/Sao_Paulo', true);


  insert into public.menu_categories (restaurant_id, nome, ordem)
  values (v_rest, 'Entradas', 0) returning id into c_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Panceta do Gula', 'Crocância por fora que você escuta na primeira mordida e carne macia e suculenta por dentro. Considerada por muitos uma das melhores pancetas de São Paulo.', 5900, null, 0, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'video', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/torresmo.mp4', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/torresmo.jpg', 9, 0);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/panceta.jpg', null, null, 1);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Coxinha do Gula', 'Douradinha e crocante por fora, recheio caprichado por dentro. 8 unidades daquele clássico com o jeitinho do Gula.', 3550, null, 1, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/coxinha.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Coxinha Gigante de Queijo', 'Uma coxinha só, do tamanho da mão, empanada na panko e recheada de queijo que escorre na primeira mordida.', 0, null, 2, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/coxinha-queijo.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Dadinhos de Tapioca', 'Crocantes por fora, macios por dentro. 8 unidades com geleia de pimenta.', 3700, null, 3, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/dadinho.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Bolinho de Cupim', 'Cupim cozido em baixa temperatura, em bolinhos dourados e suculentos. 8 unidades com maionese verde.', 3200, null, 4, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/bolinho-cupim.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Burrata cremosa gratinada', 'Burrata morna e bem cremosa em molho pomodoro com basílico, parmesão gratinado e torradas de ciabatta.', 3200, null, 5, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/burrata.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Ceviche De Salmão', 'Salmão em cubos marinado no suco de limão, com cebola roxa e um toque de pimenta dedo-de-moça.', 3500, null, 6, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/ceviche-salmao.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Ceviche de Morango', 'Peixe branco e salmão marinados no limão com morango fresco e cebola roxa.', 0, null, 7, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/ceviche-morango.jpg', null, null, 0);

  insert into public.menu_categories (restaurant_id, nome, ordem)
  values (v_rest, 'Porções', 1) returning id into c_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Porção de Fritas', 'Batata frita bem dourada e sequinha, salpicada de cebolinha, com maionese verde da casa.', 0, null, 0, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/fritas-1.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Fritas com Cheddar e Bacon', 'A porção de fritas coberta de cheddar cremoso e bacon crocante picado.', 0, null, 1, true) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/fritas-cheddar.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Mandioca Frita', 'Mandioca cozida e frita na hora, dourada por fora e macia por dentro.', 0, null, 2, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/mandioca-1.jpg', null, null, 0);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/mandioca-2.jpg', null, null, 2);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Camarão ao Alho e Óleo', 'Camarões salteados no alho dourado, com tomate cereja e cebolinha.', 0, null, 3, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/camarao-alho.jpg', null, null, 0);

  insert into public.menu_categories (restaurant_id, nome, ordem)
  values (v_rest, 'Comidas', 2) returning id into c_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Picanha no Rechaud', '500g de picanha no ponto escolhido, com farofa da casa, vinagrete e maionese. O carro-chefe da casa.', 12680, 16490, 0, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'video', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/picanha.mp4', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/picanha.jpg', 12, 0);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/picanha-1.jpg', null, null, 1);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/picanha-2.jpg', null, null, 3);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/picanha-3.jpg', null, null, 5);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Peixe frito do Gula', 'Bem dourado, crocante por fora e macio por dentro. Farto e feito para colocar no meio da mesa.', 6500, 9800, 1, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'video', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/tilapia.mp4', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/tilapia.jpg', 8, 0);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/peixe-1.jpg', null, null, 1);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Parmegiana do Gula', 'Carne empanada, molho e muito queijo gratinado, com arroz branco e fritas.', 5200, 6600, 2, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/parme-1.jpg', null, null, 0);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/parme-2.jpg', null, null, 2);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Costela Barbecue', 'Costela suculenta finalizada no molho barbecue, com arroz branco e batata rústica.', 11600, null, 3, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/costela-1.jpg', null, null, 0);
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/costela-2.jpg', null, null, 2);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Picanha na Chapa', 'Picanha fatiada no ponto, chiando na chapa quente com batata bolinha no bacon e alho assado.', 0, null, 4, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/picanha-chapa-1.jpg', null, null, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Salmão com Risoto', 'Salmão grelhado na pele, dourado por fora e rosado por dentro, com risoto cremoso.', 0, null, 5, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'foto', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/fotos/salmao-1.jpg', null, null, 0);

  insert into public.menu_categories (restaurant_id, nome, ordem)
  values (v_rest, 'Lanches', 3) returning id into c_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Picanha Burger', 'Hambúrguer de picanha 180g no brioche, queijo coalho com mel, geleia de bacon defumada, picles e rúcula.', 4900, null, 0, false) returning id into d_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Big Gula', 'Hambúrguer de 160g, cheddar derretido, cebola roxa caramelizada, bacon crocante e alface americana.', 4200, null, 1, false) returning id into d_id;

  insert into public.menu_categories (restaurant_id, nome, ordem)
  values (v_rest, 'Drinks', 4) returning id into c_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Perfeitinha', 'Gin, xarope de maracujá vermelho, maracujá, limão, tangerina, frutas vermelhas e hortelã.', 3300, null, 0, false) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'video', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/caipirinha.mp4', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/caipirinha.jpg', 12, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Maria liz', 'Gin, suco de abacaxi, limão, xarope de açúcar, morango e espuma de gengibre. Único e exclusivo da casa.', 3600, null, 1, false) returning id into d_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Aperol Spritz', 'Aperol, espumante e água com gás.', 2700, null, 2, false) returning id into d_id;

  insert into public.menu_categories (restaurant_id, nome, ordem)
  values (v_rest, 'Sobremesas', 5) returning id into c_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Esfera de Chocolate', 'Brownie em esfera com sorvete de creme, finalizado com calda de chocolate quente derramada na mesa.', 2900, null, 0, true) returning id into d_id;
  insert into public.dish_media (restaurant_id, dish_id, tipo, url, poster_url, duracao_s, ordem)
  values (v_rest, d_id, 'video', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/cupula.mp4', v_base || '/storage/v1/object/public/midia/aaaaaaaa-0000-0000-0000-000000000001/videos/cupula.jpg', 12, 0);
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Petit Gateau', 'Bolo de chocolate da casa quente com sorvete de creme e calda de chocolate.', 1900, null, 1, false) returning id into d_id;
  insert into public.dishes (restaurant_id, category_id, nome, descricao, preco_min_centavos, preco_max_centavos, ordem, destaque)
  values (v_rest, c_id, 'Pudim de Leite Ninho', 'Clássico da casa, cremoso e na medida certa.', 1800, null, 2, false) returning id into d_id;

  raise notice 'Cardápio do Gula criado. Suba as mídias no bucket "midia", dentro da pasta %', v_rest;
end
$seed$;
