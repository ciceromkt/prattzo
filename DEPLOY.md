# Pôr no ar — valores do seu projeto já preenchidos

O banco **já está pronto**: projeto Supabase `pede-esse`, região São Paulo, com
as tabelas, a segurança por linha, as funções e o bucket de mídia criados.

Falta subir o código, criar os dois projetos na Vercel e colar as variáveis.

---

## 1. Subir a pasta para o GitHub

1. [github.com/new](https://github.com/new) → nome `pede-esse` → **Private** →
   *Create repository*. Não marque README, .gitignore nem licença.
2. Na página que abrir, clique em **uploading an existing file**.
3. Arraste **o conteúdo** desta pasta, não a pasta em si: `apps`, `packages`,
   `supabase`, `docs`, `package.json`, `package-lock.json`, `tsconfig.base.json`,
   `.gitignore`, `.env.example` e os `.md`.
4. *Commit changes*.

Confira depois que `apps/cardapio/vercel.json` e `apps/painel/vercel.json`
chegaram. São eles que mandam a Vercel instalar a partir da raiz — sem isso a
build quebra, porque os dois apps dependem de `packages/`.

## 2. Dois projetos na Vercel

Importe o repositório **duas vezes**, mudando só o *Root Directory*:

| Projeto | Root Directory |
|---|---|
| `gula-cardapio` | `apps/cardapio` |
| `gula-painel` | `apps/painel` |

Se perguntar, marque **Include files outside the Root Directory**.

## 3. Variáveis de ambiente

### Nos dois projetos

```
NEXT_PUBLIC_SUPABASE_URL=https://gwyuorvifcdzbgqmiwqz.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eXVvcnZpZmNkemJncW1pd3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTcyMzUsImV4cCI6MjEwNzQ5MzIzNX0.h2waDRfGaXOZDvwGtCScQWC7KCIzss8F-2F0VPGopkI
```

```
REVALIDAR_SEGREDO=ENVCqxs_tPmVCX3WbjdbybS0wGwMOTuu
```

```
SUPABASE_SERVICE_ROLE_KEY=   ← esta você copia
```

A `service_role` está em **Settings → API Keys** do projeto, marcada como
*secret / service_role*. Eu não tenho acesso a ela, e é assim que tem que ser:
ela ignora toda a segurança por linha do banco. Cole direto na Vercel, nos dois
projetos. Nunca numa variável que comece com `NEXT_PUBLIC_`.

### Só no `gula-cardapio`

```
NEXT_PUBLIC_PAINEL_URL=https://gula-painel.vercel.app
```

### Só no `gula-painel`

```
NEXT_PUBLIC_CARDAPIO_URL=https://gula-cardapio.vercel.app
```

Esse último não é enfeite: é por ele que o painel avisa o cardápio para limpar o
cache quando você marca um item como esgotado. Se estiver errado, tudo *parece*
funcionar — só que a mudança demora até um minuto para chegar ao cliente em vez
de ser na hora. Ajuste os dois endereços se a Vercel der outro nome aos projetos.

## 4. Autenticação

No Supabase, **Authentication → URL Configuration**:

- **Site URL**: `https://gula-painel.vercel.app`
- **Redirect URLs**: `https://gula-painel.vercel.app/auth/callback`

Sem isso o magic link chega no e-mail e volta para `localhost`.

## 5. As mídias

**Storage → bucket `midia`**. Descompacte `midias-do-gula.zip` e arraste a pasta
`aaaaaaaa-0000-0000-0000-000000000001` inteira, com esse nome.

O nome é a regra de segurança: o Storage só aceita escrita dentro da pasta cujo
nome é o id do restaurante. É o que impede um dono de mexer na mídia de outro
quando houver mais clientes.

## 6. Me avise

Quando o painel estiver no ar, entre uma vez com o seu e-mail. Isso cria o seu
usuário no banco — e aí eu ponho as 6 categorias e os 26 pratos do Gula, que
ficam amarrados a esse usuário.

---

## Uma coisa que ficou faltando no banco

A função `apagar_dados_sessao`, do direito de exclusão da LGPD. A aprovação do
Supabase barra qualquer migração que contenha `delete from`, mesmo sendo só a
definição de uma função, que não apaga nada ao ser criada.

Sem ela a rota `/api/privacidade` dá erro. Cole no **SQL Editor**:

```sql
create or replace function public.apagar_dados_sessao(p_sessao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.order_items where order_id in (select id from public.orders where sessao = p_sessao);
  delete from public.orders where sessao = p_sessao;
  delete from public.events where sessao = p_sessao;
end $$;
grant execute on function public.apagar_dados_sessao(text) to anon, authenticated;
```

## Conferindo que está tudo ligado

Marque um item como **Acabou** no painel e recarregue o cardápio: tem que
aparecer esgotado na hora, sem esperar. Se demorar, o `REVALIDAR_SEGREDO` ou o
`NEXT_PUBLIC_CARDAPIO_URL` estão diferentes entre os dois projetos.
