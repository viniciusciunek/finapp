# Finanças do Casal

Sistema de finanças pessoais e da família para o Vinícius e a Isabelle — substitui o caderno de um e a planilha do outro. O coração do produto é a **Folha do mês** (o fechamento mensal).

- **Produto:** [`docs/PRODUCT.md`](docs/PRODUCT.md)
- **Regras de negócio e modelo de dados:** [`docs/DOMAIN.md`](docs/DOMAIN.md)
- **Ordem de construção (fatias):** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Histórico detalhado do que foi feito e por quê:** [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)

> **Estado atual:** **Fatia 1 (Login e família) concluída.** Dá para criar conta, formar a família, convidar a outra pessoa por código e alternar entre a visão pessoal e a da família — com os testes de isolamento rodando no CI a cada push. Falta só o deploy (adiado). Próxima fatia: contas e cartões.

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

Não é preciso criar usuário na mão: a tela de **`/signup`** cria a conta em segundos. Depois de entrar, a pessoa **cria a família** ou usa um **código de convite** recebido da outra.

### Testar fluxo de cadastro sem sujar o projeto real

O `npm run dev` fala com o projeto do `.env.local` — o de verdade. Para testar cadastro, convite e afins sem criar conta real, suba o Supabase local e use o outro comando:

```bash
npx supabase start     # uma vez (usa Docker)
npm run dev:local      # o app passa a apontar para http://127.0.0.1:54321
```

O `dev:local` troca apenas as variáveis de ambiente do processo — o `.env.local` fica intacto.

### Configuração necessária no painel do Supabase

| O quê | Onde | Por quê |
|---|---|---|
| **"Confirm email" desligado** | Authentication → Sign In / Providers → Email | Com a confirmação ligada, o cadastro não entra direto e o plano gratuito limita o envio de e-mails. Religar quando o app for usado de verdade. |

## Telas

| Rota | O que tem |
|---|---|
| `/login` · `/signup` | Entrada e cadastro (quem já está logado é levado direto para o app) |
| `/onboarding` | Criar a família ou entrar com um código de convite |
| `/` | Visão geral — o lugar onde a Folha do mês entra na Fatia 5 |
| `/contas` | Contas e cartões do escopo ativo (só seus ou da família) |
| `/familia` | Quem está na família, gerar convite (com botão copiar) e cancelar convites em aberto |
| `/perfil` | Nome, e-mail, papel na família, sair da família e sair da conta |

A alternância no topo (**Pessoal / Família**) troca a visão ativa e a escolha fica guardada em cookie.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (usa o projeto do `.env.local`) |
| `npm run dev:local` | Servidor de desenvolvimento apontando para o **Supabase local** — use este para testar cadastro e convite |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next (`next typegen`) e roda o `tsc` |
| `npm test` | Testes unitários (Vitest, executa uma vez e sai) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:rls` | Testes de **integração** (isolamento entre usuários). Rodam no Supabase local e **recusam** qualquer outro alvo sem confirmação |
| `npm run format` | Formata tudo com Prettier |
| `npm run format:check` | Só verifica a formatação (usado no CI) |
| `npm run db:types` | Regenera os tipos do banco (`src/lib/supabase/database.types.ts`) a partir do schema |
| `npm run db:cleanup` | Lista (e com `-- --delete`, apaga) contas de teste que tenham ido parar num projeto — ver abaixo |
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

> Depois de mudar o schema e aplicar a migration, rode `npm run db:types` para os tipos acompanharem.

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
npx supabase start     # o alvo padrão é o Supabase local
npm run test:rls
```

O teste **cria dados**: dois usuários `rls-teste+…@example.com` e a família "Família de teste (RLS)". Por isso ele só roda contra bancos **descartáveis** — apontar para qualquer outro host falha antes de rodar um único teste:

```bash
# bloqueado, com instruções na tela:
SUPABASE_TEST_URL=https://<ref>.supabase.co npm run test:rls

# contra um projeto real só com confirmação explícita:
RLS_ALLOW_REMOTE=true SUPABASE_TEST_URL=https://<ref>.supabase.co npm run test:rls
```

Essa trava existe por um motivo concreto: o padrão antigo caía no `.env.local` — o projeto de verdade — e criava contas reais lá. Elas só saem pelo painel, porque apagar usuário exige a chave secreta, que o teste não usa.

No CI o teste roda contra um Supabase que sobe **dentro do runner** (job `isolation`), sem nenhum segredo configurado.

### Limpar contas de teste que tenham subido para um projeto

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SECRET_KEY=sb_secret_... \
npm run db:cleanup                 # só lista o que encontrou

npm run db:cleanup -- --delete     # lista e apaga
```

- Só considera os e-mails da lista `TEST_EMAILS` em `scripts/cleanup-test-data.mjs` — **anote lá** toda conta de teste nova, senão a limpeza não a encontra.
- Família que tenha alguém fora dessa lista é **pulada**, não apagada: apagar levaria junto o vínculo de uma pessoa de verdade.
- A chave secreta (Dashboard → Project Settings → API Keys) ignora o RLS e **nunca** entra no repositório: ela vai na linha de comando, vale para aquela execução e não fica registrada em lugar nenhum.

## Estrutura

```
src/
├── app/                 Rotas (App Router)
│   ├── (auth)/          Telas públicas: login e cadastro (o grupo não aparece na URL)
│   ├── (app)/           Telas autenticadas: visão geral, família e conta
│   ├── onboarding/      Criar/entrar na família (exige sessão, mas não família)
│   ├── actions.ts       Server Actions compartilhadas (sair da conta)
│   └── layout.tsx       Layout raiz + loading.tsx (limite de <Suspense>)
├── components/ui/       Componentes do shadcn/ui (+ skeleton.tsx)
├── domain/              Regras de negócio puras (sem banco, sem React) + testes
├── lib/                 Utilitários e clientes do Supabase
├── server/              Acesso a dados (as páginas/actions chamam daqui)
└── proxy.ts             (na raiz de src/) Renovação da sessão a cada requisição
supabase/                Configuração do CLI e migrations
scripts/                 Utilitários: ícones, `dev:local` e limpeza de contas de teste
```

`src/proxy.ts` é o antigo `middleware.ts`, renomeado no Next 16.

## Convenções que não se quebram

1. **Dinheiro é sempre inteiro, em centavos** (`amount_cents`). Nunca `float`. Formatar para BRL só na exibição.
2. **Toda tabela tem RLS ativada**, com policies e teste de isolamento entre usuários.
3. **Regra de negócio vive em `src/domain/`**, como função pura, com teste. Componentes só chamam.
4. **Schema só muda por migration** versionada.
5. **Status de item é calculado**, nunca digitado.
6. **Compra no cartão não mexe no saldo da conta; o pagamento da fatura mexe.**
7. **Toda leitura de sessão ou de dados da requisição fica dentro de um limite `<Suspense>` explícito**, no próprio componente. O Cache Components do Next 16 trata esse acesso fora de `<Suspense>` como erro (aceita pela validação do dev overlay e potencialmente como erro de build), e o `loading.tsx` da raiz **não** cobre o layout do segmento nem o carregamento da página. Ver `P17` no `BUILD_LOG.md`.

## Problemas conhecidos

- **`npm audit` reporta 5 vulnerabilidades `high`** em `braces`, dependência **de desenvolvimento** (cadeia do `eslint-config-next`). É uma falha de DoS por padrão de glob aninhado, sem exposição em runtime nem entrada de usuário. O "fix" sugerido pelo npm faria downgrade do ESLint para a v14 — não aplicar. Revisar quando o `eslint-config-next` atualizar a cadeia.

## Deploy

Pendente (passo manual). O plano é **Vercel** ligada ao repositório do GitHub, com as mesmas variáveis do `.env.local` configuradas no painel.

> ⚠️ **Este app não funciona como site estático.** `output: "export"` (GitHub Pages, S3, etc.) é incompatível com **Server Actions**, **cookies**, **proxy** e Image Optimization — recursos que o login e a sessão usam. Testado: o build falha com `Server Actions are not supported with static export`. O deploy precisa de um host com runtime Node (Vercel, Netlify, Cloudflare). Detalhes em [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md), passo `P14`.

## CI

O workflow `.github/workflows/ci.yml` roda em todo push na `main` e em pull requests, em dois trabalhos paralelos:

| Trabalho | O que faz |
|---|---|
| `quality` | lint → formatação → tipos → testes unitários → build |
| `isolation` | sobe um Supabase **local dentro do runner**, aplica as migrations do zero e roda `npm run test:rls` (isolamento entre usuários) |

Nenhum dos dois usa segredos: o trabalho de isolamento aponta para o Supabase local, nunca para o projeto da nuvem.
