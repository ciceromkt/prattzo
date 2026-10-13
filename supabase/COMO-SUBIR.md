# Subir o Prattzo no Supabase (do zero)

O projeto do Gula **já está no ar** — isto aqui serve para montar um banco novo,
para outro cliente ou para recomeçar do zero. Leva uns 10 minutos. Você não precisa me passar nenhuma senha nem chave secreta:
tudo aqui é copiar e colar no painel do Supabase.

---

## 1. Criar o projeto

Em **supabase.com** → *New project*.

- **Region: South America (São Paulo)** — importa de verdade. O Gula é em
  Heliópolis; banco nos Estados Unidos põe uns 150 ms em cada consulta, e o
  cliente sente isso no celular dele, no 4G, dentro do rooftop.
- Guarde a senha do banco que ele pede. Você não vai usar agora, mas perder dá
  trabalho.

## 2. Criar as tabelas

*SQL Editor* → *New query* → cole **`supabase-01-estrutura.sql`** inteiro → *Run*.

São as 5 migrações do projeto: tabelas, segurança por linha, métricas, bucket de
mídia, reordenação atômica e a trava de edição simultânea. Pode rodar duas vezes
sem quebrar nada — testei exatamente isso.

## 3. Criar o seu usuário

*Authentication* → *Users* → *Add user* → *Create new user*, com o seu e-mail e
uma senha qualquer. Marque **Auto Confirm User**.

(Dá para fazer entrando no painel pelo magic link, mas aí você precisa do app no
ar primeiro. Criar aqui é mais rápido e dá no mesmo.)

## 4. Pôr o cardápio do Gula

Abra **`supabase-02-cardapio-gula.sql`** e troque só a primeira linha:

```sql
v_base  text := 'https://SEU-PROJETO.supabase.co';   -- Settings > API > Project URL
v_email text := 'ciceromktdigital@gmail.com';        -- o e-mail do passo 3
```

Cole no SQL Editor e rode. Entram 6 categorias, 26 pratos e 28 mídias.

O arquivo inteiro roda dentro de uma transação: se qualquer linha falhar, nada é
gravado pela metade. E ele apaga e recria o restaurante, então pode rodar de novo
quando quiser voltar ao estado inicial.

## 5. Subir as fotos e os vídeos

*Storage* → bucket **midia** (o passo 2 já criou, já público).

Descompacte **`midias-do-gula.zip`** e arraste para dentro do bucket a pasta
`aaaaaaaa-0000-0000-0000-000000000001` inteira — com esse nome, sem renomear.

O nome não é enfeite: a política de segurança do Storage só deixa escrever dentro
da pasta cujo nome é o id do restaurante. É o que impede um dono de mexer na
mídia de outro quando houver mais clientes.

Depois disso as URLs do passo 4 passam a apontar para arquivo que existe.

## 6. As chaves, para quando o app for ao ar

*Settings* → *API*:

| Onde | O quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave **anon** — pode aparecer no navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** — **nunca** no navegador, nunca no chat |
| `REVALIDAR_SEGREDO` | invente uma frase longa, a mesma nos dois apps |

A `service_role` ignora toda a segurança por linha. Ela só existe no servidor,
nas rotas de pedido e de evento. Se ela vazar, qualquer pessoa lê e escreve tudo.

## 7. Autenticação (só quando houver endereço público)

*Authentication* → *URL Configuration*:

- **Site URL**: o endereço do painel
- **Redirect URLs**: `https://SEU-PAINEL/auth/callback`

Sem isso o magic link chega no e-mail e volta para `localhost`.

---

## Como saber que deu certo

No *Table Editor*:

- `restaurants` → 1 linha, `publicado = true`
- `dishes` → 26 linhas, 8 delas com `preco_min_centavos = 0` (os que faltam preço)
- `dish_media` → 28 linhas, todas com URL do seu projeto

E no SQL Editor, a visão que alimenta a tela de pendências do painel:

```sql
select * from v_atencao_pratos limit 10;
```

## O que ainda falta para o cliente conseguir abrir

O banco pronto não põe o site no ar — faltam os dois apps hospedados
(`cardapio` e `painel`). É o passo seguinte.
