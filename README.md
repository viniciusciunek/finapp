# Finanças do Casal

Sistema de finanças pessoais e da família para o Vinícius e a Isabelle — substitui o caderno de um e a planilha do outro. O coração do produto é a **Folha do mês** (o fechamento mensal).

- **Produto:** [`docs/PRODUCT.md`](docs/PRODUCT.md)
- **Regras de negócio e modelo de dados:** [`docs/DOMAIN.md`](docs/DOMAIN.md)
- **Ordem de construção (fatias):** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Histórico detalhado do que foi feito e por quê:** [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)

> **Estado atual:** Fatia 0 (Fundação) concluída. Fatia 1 (Login e família) em andamento — **banco e camada de servidor prontos e validados** (família, convites, RLS com teste de isolamento); faltam as telas de cadastro, onboarding e família.

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript (strict) |
| Estilo | Tailwind CSS v4 + shadcn/ui (base Radix) |
| Banco e autenticação | Supabase (Postgres + Auth + Row Level Security) |
| Validação | Zod (cliente e servidor) |
| Testes | Vitest |
| Qualidade | ESLint + Prettier + GitHub Actions |

## Requisitos

- **Node.js 24+** (desenvolvido com v24.16.0)
- **npm** (o projeto usa `package-lock.json`)
- **Docker** — opcional, só se você quiser rodar o Supabase local

## Como rodar

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env.local
#    Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#    (Dashboard do Supabase → Project Settings → API)

# 3. Servidor de desenvolvimento
npm run dev
# http://localhost:3000
```

Sem um usuário cadastrado não dá para entrar: crie um em **Supabase → Authentication → Users → Add user** (e-mail + senha, marcando *Auto Confirm User*). O perfil é criado automaticamente. A tela de cadastro própria entra na Fatia 1.

### Configuração necessária no painel do Supabase

| O quê | Onde | Por quê |
|---|---|---|
| **"Confirm email" desligado** | Authentication → Sign In / Providers → Email | Com a confirmação ligada, o cadastro não entra direto e o plano gratuito limita o envio de e-mails. Religar quando o app for usado de verdade. |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next (`next typegen`) e roda o `tsc` |
| `npm test` | Testes unitários (Vitest, executa uma vez e sai) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:rls` | Testes de **integração** (isolamento entre usuários) contra um Supabase de verdade — precisa de credenciais |
| `npm run format` | Formata tudo com Prettier |
| `npm run format:check` | Só verifica a formatação (usado no CI) |
| `npm run db:types` | Regenera os tipos do banco (`src/lib/supabase/database.types.ts`) a partir do schema |
| `python3 scripts/generate-icons.py` | Regera os ícones do PWA |

## Banco de dados

O schema **só muda por migration versionada** (regra do projeto). As migrations ficam em `supabase/migrations/` e são aplicadas com o CLI:

```bash
# Uma vez: autenticar e vincular ao projeto (pede segredos — faça você mesmo)
npx supabase login
npx supabase link --project-ref <project-ref>

# Aplicar migrations no projeto remoto
npx supabase db push

# Criar uma migration nova
npx supabase migration new nome_da_migration
```

> Não há migrations ainda: a primeira entra na Fatia 1, junto das tabelas de identidade/família (cada tabela nasce com RLS **e** teste de isolamento).

### Migrations existentes

| Arquivo | O que cria |
|---|---|
| `20261008180810_identity_and_households.sql` | `profiles`, `user_settings`, `households`, `household_members`, `household_invites`, as funções de associação (`create_household`, `accept_household_invite`, `leave_household`) e as **10 policies de RLS** |
| `20261009141956_backfill_identity_for_existing_users.sql` | Cria `profiles`/`user_settings` para contas que existiam antes do trigger de cadastro (idempotente) |

> Depois de mudar o schema e aplicar a migration, rode `npm run db:types` para os tipos acompanharem.

### Testar o banco localmente (opcional, recomendado)

Útil para mexer em SQL sem tocar no projeto da nuvem:

```bash
npx supabase start      # sobe o Supabase local (Docker; ~1 GB na primeira vez)
npx supabase db reset   # aplica todas as migrations do zero
npx supabase stop       # derruba os contêineres
```

### Teste de isolamento (RLS)

A regra do projeto é que **nenhum usuário leia dado pessoal de outro** — e isso é verificado por teste, não por leitura de código:

```bash
npm run test:rls        # usa o Supabase configurado no .env.local

# ou apontando para o Supabase local:
SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_KEY=<publishable key do supabase start> npm run test:rls
```

O teste cria **uma única vez** (e reaproveita nas execuções seguintes) dois usuários `rls-teste+…@example.com` e uma família "Família de teste (RLS)". Ele **não** roda no CI de propósito: o CI não tem segredos. Para limpar o resíduo, apague a família de teste e depois os dois usuários no painel do Supabase.

## Estrutura

```
src/
├── app/                 Rotas (App Router), layout, manifest da PWA
│   ├── login/           Página e Server Action de login
│   ├── loading.tsx      Estado de carregamento + limite de <Suspense>
│   └── proxy.ts*        (na raiz de src/) Renovação da sessão a cada requisição
├── components/ui/       Componentes do shadcn/ui
├── domain/              Regras de negócio puras (sem banco, sem React) + testes
├── lib/                 Utilitários e clientes do Supabase
└── server/              Acesso a dados (as páginas/actions chamam daqui)
supabase/                Configuração do CLI e migrations
scripts/                 Geração de assets (ícones)
```

\* `src/proxy.ts` é o antigo `middleware.ts`, renomeado no Next 16.

## Convenções que não se quebram

1. **Dinheiro é sempre inteiro, em centavos** (`amount_cents`). Nunca `float`. Formatar para BRL só na exibição.
2. **Toda tabela tem RLS ativada**, com policies e teste de isolamento entre usuários.
3. **Regra de negócio vive em `src/domain/`**, como função pura, com teste. Componentes só chamam.
4. **Schema só muda por migration** versionada.
5. **Status de item é calculado**, nunca digitado.
6. **Compra no cartão não mexe no saldo da conta; o pagamento da fatura mexe.**
7. **Toda tela que lê sessão fica dentro de um limite `<Suspense>`** (o `loading.tsx` cria esse limite) — o Cache Components do Next 16 trata leitura de cookies fora de `<Suspense>` como **erro de build**.

## Problemas conhecidos

- **`npm audit` reporta 5 vulnerabilidades `high`** em `braces`, dependência **de desenvolvimento** (cadeia do `eslint-config-next`). É uma falha de DoS por padrão de glob aninhado, sem exposição em runtime nem entrada de usuário. O "fix" sugerido pelo npm faria downgrade do ESLint para a v14 — não aplicar. Revisar quando o `eslint-config-next` atualizar a cadeia.

## Deploy

Pendente (passo manual). O plano é **Vercel** ligada ao repositório do GitHub, com as mesmas variáveis do `.env.local` configuradas no painel.

> ⚠️ **Este app não funciona como site estático.** `output: "export"` (GitHub Pages, S3, etc.) é incompatível com **Server Actions**, **cookies**, **proxy** e Image Optimization — recursos que o login e a sessão usam. Testado: o build falha com `Server Actions are not supported with static export`. O deploy precisa de um host com runtime Node (Vercel, Netlify, Cloudflare). Detalhes em [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md), passo `P14`.

## CI

O workflow `.github/workflows/ci.yml` roda em todo push na `main` e em pull requests: **lint → formatação → tipos → testes → build**. Não precisa de segredos.
