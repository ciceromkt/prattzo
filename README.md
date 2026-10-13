# Pede Esse

Cardápio digital com vídeo vertical por prato. O cliente assiste, vai separando
o que quer e chega no garçom com a própria lista pronta.

> **Nome provisório.** Está num único arquivo (`packages/core/src/brand.ts`).

## O que é

Dois aplicativos sobre a mesma base:

- **Cardápio** (cliente): abre pelo QR Code da mesa. Capa com vídeo de ambiente,
  grade de categorias, stories em tela cheia, lista corrida e carrinho.
- **Painel** (dono): itens, categorias, capas, fotos e vídeos, esgotado do dia,
  ordem, publicação e medição de atenção.

## As três decisões de produto

1. **Nada de IA.** Nenhuma recomendação, nenhuma pergunta ao cliente. O que faz
   pedir é ver o prato, não ser aconselhado.
2. **Preço some de dentro do carrinho.** Está na lista e no vídeo, onde o cliente
   compara e decide. Na hora de fechar, a soma na tela só assusta e tira item.
3. **A tela final é do cliente, não do garçom.** "O que você escolheu", não
   "mostre ao garçom": se o garçom lesse a tela e errasse, a culpa seria dele.
   Ele anota como sempre; o app só evita o "era o quê mesmo?".

## Estrutura

```
pede-esse/
├── apps/
│   ├── cardapio/      Next.js — app do cliente (porta 3000)
│   └── painel/        Next.js — painel do dono (porta 3001)
├── packages/
│   ├── core/          Regras e testes, sem dependência de framework
│   ├── db/            Clientes Supabase, tipos e consultas
│   └── ui/            Tokens de design
├── supabase/
│   ├── migrations/    Esquema, RLS, métricas e storage
│   └── seed.sql       Cardápio de demonstração
└── docs/
    ├── DEPLOY.md      Como colocar no ar
    └── PILOTO.md      Passo a passo do piloto no Gula
```

## Onde moram as regras

Tudo que decide o que o cliente vê está em `packages/core`, puro e testado:

| Regra | Arquivo | Teste |
| --- | --- | --- |
| Preço, faixa e total do pedido | `src/price.ts` | `test/price.test.ts` |
| Ordem, capa, esgotado e pendências | `src/menu.ts` | `test/menu.test.ts` |

28 testes. `npm test` na raiz.

Três comportamentos que o código garante:

1. **Item sem preço nunca vira "R$ 0,00".** A tela diz "Preço a confirmar" e o
   painel conta quantos são.
2. **O total do pedido é piso, nunca teto.** Item com faixa marca o total como
   "a partir de" — o cliente nunca recebe conta menor do que a tela mostrou.
3. **Esgotado volta sozinho às 6h.** Ninguém lembra de desmarcar no dia
   seguinte, e é assim que um item some do cardápio por uma semana.

## Rodar local

```bash
npm install
cp .env.example apps/cardapio/.env.local
cp .env.example apps/painel/.env.local   # preencha os dois
npm run dev:painel     # http://localhost:3001
npm run dev:cardapio   # http://localhost:3000
```

## Comandos

```bash
npm test          # testes do núcleo
npm run typecheck # TypeScript em todos os pacotes
npm run build     # build dos dois apps
```

As migrações têm teste próprio, contra um Postgres de verdade: ver
`docs/DEPLOY.md`, seção "Testar as migrações antes de subir".
