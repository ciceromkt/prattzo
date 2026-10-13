# Deploy

Do zero ao cardápio no ar. Cerca de 30 minutos na primeira vez.

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) na região
   **South America (São Paulo)** — latência menor no celular do cliente.
2. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**só no servidor**)
3. Rode as migrações na ordem, pelo SQL Editor ou pela CLI:
   ```
   supabase/migrations/20261012000100_schema.sql
   supabase/migrations/20261012000200_rls.sql
   supabase/migrations/20261012000300_metricas_storage.sql
   ```
   ```bash
   npx supabase link --project-ref SEU_REF && npx supabase db push
   ```
4. Em **Authentication → URL Configuration**, adicione em *Redirect URLs*:
   ```
   http://localhost:3001/auth/callback
   https://painel.SEUDOMINIO.com.br/auth/callback
   ```

A terceira migração cria o bucket `midia` e as políticas dele. Não há outro
serviço de arquivo: foto e vídeo vão direto do navegador para o Storage, por URL
assinada, sem passar pelo servidor do painel.

### Testar as migrações antes de subir

As migrações rodam contra um Postgres local, sem Supabase. Isto achou cinco
problemas que não apareciam em revisão de código — vale rodar sempre que mexer
no esquema ou nas políticas:

```bash
# Postgres 16 local, mesma versão do Supabase
initdb -D /tmp/pgtest -U postgres --auth=trust
pg_ctl -D /tmp/pgtest -o "-p 5433 -k /tmp" start

sh supabase/teste/recriar.sh                                  # ambiente + migrações
psql -h /tmp -p 5433 -U postgres -d pede_esse -f supabase/teste/10_rls.sql
sh supabase/teste/recriar.sh
psql -h /tmp -p 5433 -U postgres -d pede_esse -f supabase/teste/20_fluxo.sql
```

`supabase/teste/00_ambiente_supabase.sql` reproduz o que o Supabase traz pronto
(papéis `anon`/`authenticated`/`service_role`, `auth.uid()`, schema `storage`).
Não vai para produção.

### Conferir o isolamento entre restaurantes

É a proteção que impede um dono de ver o cardápio do outro. Teste na mão:

1. Crie duas contas e um restaurante em cada.
2. Logado na conta A, no SQL Editor com papel `authenticated`, rode
   `select * from dishes;`. Só os pratos de A podem aparecer.
3. Deixe o restaurante B em rascunho e abra `/r/slug-do-b` deslogado:
   tem que dar "cardápio não encontrado".

## 2. Vercel

Dois projetos, mesmo repositório:

| | Cardápio | Painel |
| --- | --- | --- |
| Root Directory | `apps/cardapio` | `apps/painel` |
| Build Command | `npm run build` | `npm run build` |
| Install Command | `npm install` (na raiz) | `npm install` (na raiz) |
| Domínio | `menu.seudominio.com.br` | `painel.seudominio.com.br` |

**Cardápio:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PAINEL_URL`, `ERROR_WEBHOOK_URL` (opcional).

**Painel:** as três de Supabase, `NEXT_PUBLIC_CARDAPIO_URL`, `ERROR_WEBHOOK_URL` (opcional).

Depois do primeiro deploy, volte ao Supabase e inclua
`https://painel.seudominio.com.br/auth/callback` nas Redirect URLs.

## 3. Monitoramento

Os dois apps escrevem log estruturado em JSON, visível em **Vercel → Logs**.
`ERROR_WEBHOOK_URL` (Slack ou Discord) recebe erro de servidor na hora. Vale
configurar antes do piloto.

## 4. Cardápio de demonstração (opcional)

```bash
# Crie um usuário pelo painel, pegue o id em Authentication > Users
psql "$DATABASE_URL" -v owner="'UUID-DO-USUARIO'" -f supabase/seed.sql
```

Sete itens do Gula, incluindo um propositalmente incompleto para a tela de
pendências ter o que apontar na demonstração.

## Checklist antes do primeiro serviço

- [ ] Migrações rodadas e isolamento entre restaurantes conferido na mão
- [ ] Uma foto e um vídeo enviados com sucesso pelo painel, do celular
- [ ] Capa escolhida em todas as categorias
- [ ] Zero itens na lista de pendências
- [ ] Cardápio publicado (Configurações → Publicar)
- [ ] QR Code escaneado por um celular que não é o seu, no 4G, fora do Wi-Fi do bar
- [ ] Botão "Acabou" testado: o item aparece esgotado e não entra no pedido
- [ ] `ERROR_WEBHOOK_URL` apontando para um canal que alguém olha
