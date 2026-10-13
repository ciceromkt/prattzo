# Prattzo — o que está no ar e o que falta

## Já montado

**Banco** — Supabase, projeto `pede-esse` (nome antigo, o projeto é este),
região São Paulo (`sa-east-1`), ref `gwyuorvifcdzbgqmiwqz`.
Tabelas com segurança por linha, funções de reordenação atômica, views de
métrica, trava de edição simultânea e o bucket `midia` com as três políticas.

**Código** — `github.com/ciceromkt/prattzo`, branch `main`.

**Vercel** — dois projetos, funções em `gru1` (São Paulo):

| Projeto | Root Directory | Vira |
|---|---|---|
| `prattzo` | `apps/cardapio` | o endereço que o cliente abre |
| `prattzo-painel` | `apps/painel` | o endereço onde você edita |

A *Vercel Authentication* foi **desligada** nos dois. Ela vem ligada por padrão
e exigiria login da Vercel para abrir a página — num cardápio isso seria fatal:
o cliente aponta o celular para o QR da mesa e cai numa tela de login de uma
empresa que ele nunca ouviu falar.

Variáveis já postas nos dois projetos: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `REVALIDAR_SEGREDO`, e os endereços cruzados
(`NEXT_PUBLIC_PAINEL_URL` num, `NEXT_PUBLIC_CARDAPIO_URL` no outro).

---

## Falta

### 1. A chave secreta do Supabase

Em **Settings → API Keys** do projeto, copie a chave marcada **secret /
service_role** e cole nos **dois** projetos da Vercel:

```
SUPABASE_SERVICE_ROLE_KEY=
```

Ela ignora toda a segurança por linha do banco, e por isso só existe no
servidor — nas rotas de pedido e de evento. Nunca numa variável que comece com
`NEXT_PUBLIC_`. Sem ela o cardápio abre e funciona, mas o pedido não é gravado.

### 2. As mídias

**Storage → bucket `midia`**. Descompacte `midias-do-gula.zip` e arraste a
pasta `aaaaaaaa-0000-0000-0000-000000000001` inteira, com esse nome.

O nome é a regra de segurança: o Storage só aceita escrita dentro da pasta cujo
nome é o id do restaurante. É o que impede um dono de mexer na mídia de outro
quando houver mais clientes.

### 3. Autenticação

No Supabase, **Authentication → URL Configuration**:

- **Site URL**: o endereço do painel
- **Redirect URLs**: `<endereço do painel>/auth/callback`

Sem isso o magic link chega no e-mail e volta para `localhost`.

### 4. A função da LGPD

A aprovação do Supabase barra qualquer migração com `delete from`, mesmo sendo
só a definição de uma função, que não apaga nada ao ser criada. Sem ela a rota
`/api/privacidade` dá erro. Cole no **SQL Editor**:

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

### 5. Entrar uma vez no painel

Isso cria o seu usuário no banco. Só depois dá para pôr o cardápio do Gula, que
fica amarrado a esse usuário.

---

## Conferindo que está tudo ligado

Marque um item como **Acabou** no painel e recarregue o cardápio: tem que
aparecer esgotado na hora, sem esperar.

Se demorar até um minuto, o `REVALIDAR_SEGREDO` ou o `NEXT_PUBLIC_CARDAPIO_URL`
estão diferentes entre os dois projetos. É o erro que mais engana, porque tudo
*parece* funcionar.

## Domínio próprio

*Settings → Domains* em cada projeto. Algo como `cardapio.prattzo.com.br` e
`painel.prattzo.com.br`. Lembre de atualizar as duas variáveis de endereço e as
Redirect URLs do Supabase junto.
