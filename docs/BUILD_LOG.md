# BUILD_LOG.md — Diário de construção

> **O que é este arquivo:** registro cronológico e detalhado de tudo que foi feito no projeto — comandos executados, arquivos criados/editados, o **porquê** de cada decisão e como cada problema foi resolvido.
> **Como ler:** o topo mostra **onde estamos agora**. Abaixo, o histórico passo a passo (`P00`, `P01`, ...) em ordem cronológica e o registro de decisões.
> **Regra de manutenção:** todo passo relevante (comando, arquivo criado/editado, decisão, problema/solução) vira uma entrada `Pxx` aqui **antes ou junto** da execução. O status no topo é atualizado a cada passo concluído.

---

## Status atual

- **Fatia em andamento:** **1 — Login e família** — **concluída** (fases 1 a 5). O único item em aberto é o deploy, adiado pelo usuário
- **Último passo concluído:** `P19` — Fase 5: limpeza, validação final e fechamento da fatia
- **Próximo passo:** Fatia 2 — contas e cartões (`docs/ROADMAP.md`)
- **Pendências manuais (usuário):**
  - [x] ~~Desligar a confirmação de e-mail~~ — feito (`npm run test:rls` passou contra a nuvem)
  - [x] ~~`supabase login` + `link`~~ — feito (projeto `czqyiuztionqtqanmbep` vinculado)
  - [x] ~~Aplicar as migrations na nuvem~~ — feito (as duas: `20261008180810` e `20261009141956`, local = remoto)
  - [x] ~~Publicar os commits~~ — feito
  - [ ] Deploy na Vercel (adiado pelo usuário)

---

## Registro de decisões

| # | Decisão | Por quê | Alternativas descartadas |
|---|---|---|---|
| D1 | Supabase **cloud** desde já (sem Docker local nesta fase) | Decisão do usuário no alinhamento inicial; Docker existe na máquina mas não é necessário agora | Supabase local via `supabase start` |
| D2 | Migrations aplicadas só via **CLI** (`supabase db push`) | Regra 4 das instruções: "schema só muda por migration versionada" | Editar SQL direto no dashboard |
| D3 | **Nenhuma tabela de negócio** criada na Fatia 0 (só Auth) | Regra 2 das instruções: nenhuma tabela sem policies + teste de isolamento. Como a Fatia 1 vai desenhar identidade/família, adiar evita dívida | Criar `profiles`/`user_settings` agora |
| D4 | Auth SSR com `@supabase/ssr` + `getClaims()` | Padrão oficial do Supabase para Next.js App Router; `getClaims()` valida assinatura do token (mais seguro que `getSession()`) | `getSession()` no servidor |
| D5 | PWA **sem service worker**: manifest + ícones + metadados | **Revisada no `P11`.** (1) O guia do Next 16 diz que é possível disparar a instalação sem service worker; (2) um SW que cacheasse HTML de páginas autenticadas seria risco de segurança (servir a tela de um usuário a outro); (3) offline não está no escopo do MVP | Serwist (`@serwist/next`) — cogitado na fundação, adiado; pode voltar se offline virar requisito |
| D6 | Diário de bordo em `docs/BUILD_LOG.md` (único, com status no topo) | Pedido do usuário: histórico detalhado + "em que pé estamos" em um só lugar, fácil de atualizar | Separar `JOURNAL.md` + `PROGRESS.md` |
| D7 | Dinheiro sempre em centavos; primeiro módulo puro do domínio será `src/domain/money.ts` | Regra 1 das instruções + prova o harness do Vitest com código útil de verdade | Teste "hello world" descartável |
| D8 | shadcn/ui com biblioteca base **Radix** (`radix-ui`), preset `radix-nova` | Radix é a base histórica do shadcn/ui: ecossistema maduro, ampla documentação/exemplos e maior compatibilidade com o grande volume de componentes de terceiros publicados no registry | `base` (Base UI) — biblioteca mais nova, ainda com menos exemplos publicados |
| D9 | **Toda leitura de sessão/dados da requisição fica atrás de um limite `<Suspense>` explícito** | Exigência do Cache Components do Next 16. **Refinada no `P17`:** o `loading.tsx` da raiz faz o **build** passar (bastava nas fases 1–2), mas **não** cobre o layout do próprio segmento nem o carregamento de dados da página — nesses casos o dev overlay acusa `blocking-prerender-dynamic`. A solução é o `<Suspense>` **dentro do componente**: a casca (enquadramento + barra inferior) aparece na hora e só o miolo espera | `instant = false` (testado nos dois contextos: **não** resolve — silencia só a validação de "UI instantânea", não a de casca estática); desligar `cacheComponents` (briga com o padrão do framework); `"use cache"` (não se aplica a dado por usuário) |
| D10 | Hospedagem em **servidor** (Vercel). **Descartado** `output: "export"` / GitHub Pages | O export estático é **incompatível** com Server Actions, `cookies()`, `proxy` e Image Optimization — ou seja, mataria o login e o logout. Ver `P14` para a evidência dos builds. Além disso, o GitHub Pages publica o site de forma **pública** (Pages privado exige GitHub Enterprise) | Migrar a autenticação para o browser (padrão SPA do Supabase) e usar GitHub Pages — cogitado e recusado pelo usuário |
| D11 | `await connection()` **antes** de `getClaims()`, dentro de `getSessionContext()` | O `@supabase/auth-js` chama `Date.now()` para conferir a validade do token. Com o Cache Components, valor instável só pode ser calculado em tempo de requisição — sem `connection()`, o Next 16 acusa `blocking-prerender-current-time` em **toda** tela autenticada (o erro apontava para `OnboardingPage` e `AppLayout`). A ordem importa: `connection()` **antes** da chamada que lê o relógio. Fica em um lugar só (o ponto por onde toda tela passa) | `getSession()` em vez de `getClaims()` (não valida a assinatura do token — viola a regra de segurança); espalhar `connection()` por cada tela (repetição e esquecimento garantido) |
| D12 | Grupos de rota `(auth)` e `(app)`, com `/onboarding` **fora** dos dois | `(auth)` compartilha o enquadramento centralizado das telas públicas e não aparece na URL; `(app)` compartilha o shell (cabeçalho + alternância de visão + barra inferior) e concentra o `requireHousehold()`. O onboarding fica **fora** de `(app)` de propósito: exige sessão, mas **não** família — dentro do grupo ele redirecionaria para si mesmo | Um layout raiz único com condicionais (difícil de ler e de manter); proteger só no `proxy` e deixar cada página se defender (regra de navegação repetida em N arquivos) |
| D13 | Preferência de visão (pessoal/família) em **cookie `httpOnly`**, validado por `parseScope` | É preferência de navegação, não dado de negócio: cookie faz a escolha sobreviver à navegação sem poluir a URL. `httpOnly` porque só o servidor lê; `secure` só em produção, senão o navegador recusa em `localhost`; valor sempre passa por `parseScope` antes de ser gravado (cookie é entrada do usuário) | Parâmetro na URL (`?scope=`) — feio e some ao navegar; `localStorage` — exigiria JavaScript no cliente e permitiria divergência com o servidor |
| D14 | **Não existe cliente Supabase no navegador** (`src/lib/supabase/client.ts` foi removido no `P19`) | Todo acesso a dado passa por `src/server/` e a regra do projeto diz que a interface nunca fala com o banco. Um cliente de browser disponível é convite a furar essa regra — e não havia nenhum uso real | Manter o cliente "para quando precisar": código sem uso que contradiz a arquitetura do próprio projeto |
| D15 | Testes de isolamento (RLS) **rodam no CI**, contra um Supabase que sobe **dentro do runner** | A regra "nenhum usuário lê dado de outro" é a mais importante do projeto e não podia depender de alguém lembrar de rodar um comando na mão. Rodar contra a nuvem exigiria guardar credenciais no GitHub e sujaria o projeto real a cada push | Deixar fora do CI (era o estado anterior, justificado por "o CI não tem segredos"); apontar o CI para a nuvem com segredos guardados |

---

## Histórico de passos

### P00 — Levantamento do ambiente e do repositório · 2026-10-08

**O que foi feito**

1. Listagem do workspace: apenas `docs/` (3 arquivos) e `.github/instructions/` — nenhum código.
2. Verificação do ambiente:
   - Node `v24.16.0` (exigência do Vitest 5: `>=22.12` ✔)
   - npm `11.13.0`
   - `git` presente; pasta **não** é repositório git ainda
   - `gh` **ausente**; `supabase` **ausente** (será instalado como devDependency); `docker` presente

**Conclusões / porquês**

- O projeto começa literalmente do zero → Fatia 0 do `ROADMAP.md`.
- Node 24 permite usar a versão atual de Next/Vitest sem ajustes.
- Sem `gh`, a URL do remote do GitHub não pode ser descoberta automaticamente → vira pendência manual (ou pergunta ao usuário no momento do primeiro commit).

---

### P01 — Decisões de fundação registradas · 2026-10-08

**O que foi feito**

- Registradas as decisões `D1`–`D7` na tabela acima, antes de escrever qualquer código, para que cada escolha tenha justificativa rastreável.

**Por quê**

- Instrução permanente do usuário: *"cada passo dado, mudança, arquivo criado/editado, tudo mesmo que você pensar e executar"* deve ficar registrado. Decidir **antes** de agir evita decisões implícitas.

---

### P02 — Scaffold do Next.js 16 e mesclagem no repositório · 2026-10-08

**Contexto / problema**

A pasta do projeto já continha `docs/` e `.github/`. O `create-next-app` **recusa** rodar em diretório não vazio que contenha arquivos "desconhecidos" — tentar rodar direto falharia.

**Solução adotada**

1. Gerar o scaffold num diretório irmão (`/home/ciunek/Documentos/finapp-scaffold`), que está no **mesmo sistema de arquivos** (o `mv` é instantâneo, sem cópia lenta de `node_modules`).
2. Mesclar arquivo a arquivo no repositório com `mv` (nenhum conflito: o repositório não tinha nenhum desses arquivos) e remover a pasta temporária.
3. `npm pkg set name=finapp` para corrigir o nome do pacote (o scaffold nasceu como `finapp-scaffold`).

**Comando executado (passo 1)**

```bash
npx create-next-app@latest /home/ciunek/Documentos/finapp-scaffold \
  --ts --tailwind --eslint --app --src-dir --import-alias "@/*" \
  --use-npm --skip-install --disable-git --empty --yes
```

**Por que cada flag**

| Flag | Motivo |
|---|---|
| `--ts --tailwind --eslint --app --src-dir` | Stack definida nas instruções (TypeScript strict, Tailwind, App Router, `src/`) |
| `--import-alias "@/*"` | Apelido apontando para `./src/*`; é o que shadcn/ui espera |
| `--use-npm` | Instruções do projeto usam npm (`npm test`, `npm run lint`) |
| `--skip-install` | Evitar instalar em `/tmp`/pasta temporária e duplicar trabalho; a instalação roda uma única vez no lugar definitivo |
| `--disable-git` | Evitar que o scaffold crie um `.git` próprio (não precisa ser excluído depois) |
| `--empty` | Sem página de demonstração, `next.svg`, `vercel.svg` etc. — vamos construir UI própria |
| `--yes` | Garantir execução não interativa |

**Resultado**

- Next.js **16.4.0**, React **19.3.0**, Tailwind **v4** (novidade: integração via `@tailwindcss/turbopack` nas `turbopack.rules` do `next.config.ts`, sem `postcss.config.mjs`), ESLint 9 (flat config), TypeScript 5.
- `next.config.ts` já vem com `cacheComponents: true` e `partialPrefetching: true`.
- `AGENTS.md` é gerado/regenerado pelo próprio `next dev` — decisão: **manter**, pois o Next 16 tem mudanças de API relevantes e o arquivo aponta para a documentação local em `node_modules/next/dist/docs/` (importante: vale consultar antes de escrever código Next novo).

**Comando executado (passo 2)**

```bash
cd /home/ciunek/Documentos/finapp-scaffold
mv AGENTS.md .gitignore eslint.config.mjs next-env.d.ts next.config.ts \
   package.json README.md src tsconfig.json /home/ciunek/Documentos/finapp/
cd /home/ciunek/Documentos/finapp && rmdir /home/ciunek/Documentos/finapp-scaffold
npm install
```

**Resultado:** 358 pacotes instalados em ~22s. `docs/` e `.github/` preservados.

**Problema encontrado e aceito conscientemente**

`npm audit` reporta **5 vulnerabilidades `high`** em `braces` (cadeia transitiva: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`).

- **Decisão:** não corrigir agora.
- **Por quê:** o "fix" sugerido pelo npm é um downgrade para `eslint-config-next@14.2.35` (quebra tudo). A falha é de DoS por padrão de glob aninhado e só existe em ferramenta de **desenvolvimento** (lint), não no runtime do app, e não processa entrada de usuário.
- **Ação futura:** revisar quando `eslint-config-next` atualizar a cadeia; registrar em `README.md` na Fase E.

---

### P03 — Dependências do projeto instaladas · 2026-10-08

**O que foi instalado e por quê**

Dependências de **runtime** (necessárias em produção):

| Pacote | Versão | Por que é necessário na Fatia 0 |
|---|---|---|
| `@supabase/supabase-js` | 2.117.3 | Cliente oficial do Supabase (Auth) |
| `@supabase/ssr` | 0.12.7 | Clientes com sessão em **cookie** para SSR — o pacote `auth-helpers` antigo está descontinuado. Sem ele, o App Router não mantém sessão entre servidor e browser |
| `zod` | 4.6.5 | Regra explícita das instruções: *"Validar toda entrada com Zod (cliente e servidor)"*. Usado já no formulário de login |

Dependências de **desenvolvimento**:

| Pacote | Versão | Por que é necessário na Fatia 0 |
|---|---|---|
| `supabase` (CLI) | 2.120.0 | Criar/aplicar **migrations versionadas** (regra 4) e vincular o projeto cloud. Instalado como devDependency para ficar versionado no `package.json` — todos usam a mesma versão, sem depender de instalação global |
| `vitest` | 5.0.3 | Exigido pela Fatia 0: *"`npm test` roda"* |
| `prettier` | 3.9.9 | Formatação consistente de um código que será editado por agentes + humano |
| `prettier-plugin-tailwindcss` | 0.8.1 | Ordena as classes do Tailwind automaticamente (evita diffs ruidosos de classe) |

**Problema encontrado e solução (ERESOLVE)**

A instalação do Vitest falhou:

```
npm error While resolving: vitest@5.0.3
npm error Found: @types/node@20.19.43
npm error   dev @types/node@"^20" from the root project
npm error Could not resolve dependency:
npm error peerOptional @types/node@"^22.0.0 || >=24.0.0" from vitest@5.0.3
```

- **Causa raiz:** o scaffold do `create-next-app` fixa `@types/node@"^20"` (padrão histórico), mas o Node instalado na máquina é **v24.16.0** e o Vitest 5 exige tipos `>=22`.
- **Solução escolhida:** `npm install -D "@types/node@^24"` — alinhar os tipos do Node à **versão real do runtime**. É a correção semanticamente certa: tipos descrevem o ambiente onde o código roda.
- **Solução rejeitada:** `--force` / `--legacy-peer-deps`. Esconderia o conflito e permitiria tipos de API do Node 20 num runtime 24 (ex.: APIs novas apareceriam como inexistentes ou assinaturas erradas no TypeScript).

**Comando executado**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D "@types/node@^24"
npm install -D vitest prettier prettier-plugin-tailwindcss supabase
```

**Estado do `package.json` após este passo**

- `name`: `finapp`, `private: true`
- Scripts (ainda do scaffold): `dev`, `build`, `start`, `lint` — os scripts `typecheck`, `format` e `test` entram no `P04`.

---

### P04 — Prettier + scripts de qualidade · 2026-10-08

**Arquivos criados**

| Arquivo | Conteúdo | Por quê |
|---|---|---|
| `.prettierrc.json` | `{ "plugins": ["prettier-plugin-tailwindcss"] }` | Só o essencial: liga o plugin que ordena classes Tailwind. O resto fica no padrão do Prettier (menos configuração para manter) |
| `.prettierignore` | `.next/`, `out/`, `build/`, `node_modules/`, `public/sw.js`, `public/swe-worker*.js`, `docs/`, `*.md`, `package-lock.json` | Não formatar artefatos gerados (Serwist gera `public/sw.js`) nem os documentos escritos à mão em `docs/` — evita "churn" gigante no `BUILD_LOG.md` a cada formatação |

**Arquivos editados**

- `package.json` — novos scripts:

| Script | Comando | Por quê |
|---|---|---|
| `typecheck` | `next typegen && tsc --noEmit` | Ver problema abaixo |
| `format` | `prettier --write .` | Formatar tudo |
| `format:check` | `prettier --check .` | Verificação para o CI (não escreve) |
| `test` | `vitest run` | Exigido pela Fatia 0; `run` = executa uma vez e sai (sem watch), formato que o CI precisa |
| `test:watch` | `vitest` | Modo watch para o dia a dia |

**Problema encontrado e solução (TypeScript)**

```
src/app/layout.tsx(9,50): error TS2304: Cannot find name 'LayoutProps'.
```

- **Causa raiz:** o template do Next 16 usa o tipo global `LayoutProps<"/">`, que é **gerado** pelo Next em `.next/types/` — pasta que ainda não existia porque nem `next dev` nem `next build` haviam rodado. O `tsconfig.json` inclui `.next/types/**/*.ts`, mas em projeto recém-clonado esse caminho não existe.
- **Solução escolhida:** usar o comando oficial `next typegen` **antes** do `tsc`. A própria documentação embarcada (`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`, linha 184) recomenda exatamente `next typegen && tsc --noEmit` para checagem de tipos em CI.
- **Soluções rejeitadas:**
  - Rodar `next build` só para gerar tipos → lento e acopla typecheck a build.
  - Trocar `LayoutProps<"/">` por tipagem manual → contraria o padrão do framework e perde a tipagem de rotas.

**Validação**

```bash
npm run format      # 8 arquivos verificados, nenhum alterado
npm run lint        # sem erros
npm run typecheck   # "✓ Types generated successfully" + tsc sem erros
```

---

### P05 — shadcn/ui inicializado · 2026-10-08

**Comando executado**

```bash
npx shadcn@latest init -b radix -y --no-monorepo
```

**Por que essas flags**

| Flag | Motivo |
|---|---|
| `-b radix` | Escolha da biblioteca base (decisão **D8**): Radix é a base histórica do shadcn/ui, mais madura e com mais exemplos de terceiros |
| `-y` | Sem confirmações interativas (`--yes` é o padrão do CLI atual, mas deixamos explícito) |
| `--no-monorepo` | Projeto é único; evita o prompt de monorepo |

**O que o CLI fez (e por que cada item importa)**

1. **Criou `components.json`** — arquivo de configuração do shadcn. Define `style: "radix-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"` e os *aliases* (`@/components`, `@/lib`, `@/hooks`). É ele que permite rodar `npx shadcn@latest add <componente>` no futuro sem reconfigurar nada.
2. **Criou `src/lib/utils.ts`** — hoje é só `export { cn } from "cn"`. O `cn` é o utilitário clássico de junção de classes (equivalente a `clsx` + `tailwind-merge`); o registry novo passou a publicá-lo como pacote próprio.
3. **Criou `src/components/ui/button.tsx`** — primeiro componente do design system, usado como amostra. Todos os componentes futuros vão para `src/components/ui/`.
4. **Reescreveu `src/app/globals.css`** — adicionou:
   - `@import "tw-animate-css";` (animações do shadcn) e `@import "shadcn/tailwind.css";`
   - o bloco `@theme inline` com os tokens de design (`--color-background`, `--color-primary`, `--color-destructive`, `--radius-*`, cores de gráfico e sidebar) em **oklch**
   - variantes `:root` (claro) e `.dark` (escuro) e a camada base aplicando `border-border`, `bg-background` e `font-sans`
5. **Atualizou `src/app/layout.tsx`** — fonte **Geist** via `next/font/google` (self-hosted, sem requisição externa em runtime) e `className` com o token de fonte. Nota: `lang="en"` ainda está errado para o nosso caso (interface é pt-BR) — será corrigido quando o layout for reescrito no `P09`.
6. **Instalou dependências**: `class-variance-authority`, `cn`, `lucide-react`, `radix-ui`, `shadcn`, `tw-animate-css`.

**Ponto de atenção registrado**

- O pacote `shadcn` entrou como **dependency de produção** (e não devDependency). Motivo: `globals.css` importa `shadcn/tailwind.css`, então o pacote precisa existir no momento do **build** (na Vercel também). Não é engano do CLI; remover quebraria o build.

**Validação executada**

```bash
npm run format      # formatou layout.tsx e button.tsx (gerados sem o padrão do Prettier)
npm run lint        # sem erros
npm run typecheck   # sem erros
npm run build       # ✓ Compiled successfully — Next.js 16.4.0 (Turbopack)
```

Saída do build: rotas `○ /` e `○ /_not-found`, ambas estáticas; "Cache Components enabled" e "Partial Prefetching enabled" (herdados do template do Next 16).

---

### P06 — Vitest + estrutura do domínio · 2026-10-08

**Arquivos criados**

| Arquivo | Por quê |
|---|---|
| `vitest.config.mts` | Configuração do Vitest. Ambiente `node` (domínio não conhece DOM/React/banco) e o alias `@/*` replicado do `tsconfig.json` para os testes importarem do mesmo jeito que o app |
| `src/domain/money.ts` | Primeira regra pura do projeto. Prova o harness de testes **com código que vai ser usado de verdade** em vez de um teste descartável |
| `src/domain/money.test.ts` | 6 testes do módulo acima |

**Decisões de implementação do `money.ts`**

- `isCents(value)` usa `Number.isSafeInteger` — rejeita `10.5`, `NaN`, `Infinity` e valores fora da faixa exata do JS. Implementa a regra 1 das instruções na prática: *"dinheiro é `integer` em centavos"*.
- `sumCents(values)` soma inteiros (exato) e **lança `RangeError`** se receber um valor inválido. É preferível falhar ruidosamente a propagar um número corrompido por um cálculo financeiro.
- Sem `formatBRL` aqui de propósito: formatação é camada de exibição (`Intl.NumberFormat('pt-BR', ...)`), não regra de negócio — entra quando a primeira tela mostrar dinheiro.
- Sem `parseAmountToCents`, `splitInstallments` ou `resolveStatementMonth` ainda: pertencem às Fatias 3 e 4 (parcelas/faturas). Evita criar API sem uso real (YAGNI) que depois precisaria mudar.

**Estrutura de pastas — o que existe agora e o que foi deliberadamente adiado**

```
src/
├── app/             ← rotas (App Router) — existe desde o scaffold
├── components/ui/   ← shadcn/ui — existe (button.tsx)
├── domain/          ← regras puras — CRIADO neste passo (money.ts + teste)
└── lib/             ← utilitários (utils.ts do shadcn; supabase/ entra no P08)
src/server/          ← ADIADO para a Fatia 1: pasta vazia não é rastreada pelo git e
                       o primeiro acesso a dados só existe quando as tabelas existirem
```

**Problema encontrado e solução (aviso do Vite)**

```
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'` ...
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1)
```

- **Causa raiz:** o `package.json` não tem `"type": "module"`, então o carregador nativo do Vite trata `vitest.config.ts` como CommonJS — mas o arquivo usa `import`. Hoje é só um aviso; em uma versão futura do Vite vira erro.
- **Solução escolhida:** renomear para `vitest.config.mts` (extensão marca o arquivo explicitamente como ESM).
- **Solução rejeitada:** adicionar `"type": "module"` ao `package.json` — resolveria, mas muda a interpretação de **todos** os arquivos `.js` do projeto (blast radius grande para ganho pequeno). O `tsconfig.json` já inclui `**/*.mts`, então o arquivo continua sendo checado pelo TypeScript.

**Validação executada**

```bash
npm test            # 1 arquivo, 6 testes passando (sem o aviso do Vite)
npm run lint        # sem erros
npm run typecheck   # sem erros
```

---

### P07 — Supabase CLI, variáveis de ambiente e git · 2026-10-08

**Comando executado**

```bash
npx supabase init
```

**Resultado:** criou `supabase/config.toml` (15 KB, configuração padrão completa do ambiente local + remoto). `project_id = "finapp"` foi inferido do nome da pasta.

**Por que o CLI foi instalado como devDependency (e não global)**

- Fica **versionado** em `package.json`/`package-lock.json`: qualquer pessoa (ou agente/CI) usa exatamente a mesma versão do CLI.
- `npx supabase ...` funciona sem instalação global.
- O `supabase/config.toml` é **versionado**; `supabase/.temp/` (estado local) é ignorado.

**Arquivo criado: `.env.example`**

Documenta as duas variáveis que o projeto precisa e explica as regras importantes:

| Variável | Papel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (nova nomenclatura do Supabase; substitui a antiga "anon key") |

O comentário no arquivo registra dois pontos que evitam erro grave:

1. `NEXT_PUBLIC_*` vai para o bundle do browser **por projeto** — quem protege os dados é o RLS, não o segredo da chave.
2. A chave **secreta** (`service_role` / `sb_secret_...`) **nunca** entra aqui: ela ignora o RLS.

**Arquivo editado: `.gitignore`**

- O padrão do `create-next-app` tem `.env*`, que ignoraria **também** o `.env.example` (justamente o arquivo que precisa ser versionado).
- Correção: adicionada a exceção `!.env.example`.
- Também adicionado `supabase/.temp/` (estado local do CLI).

**Git inicializado**

```bash
git init -b main
```

Ainda **sem commit** e **sem remote** — o primeiro commit será feito depois que o login estiver funcionando (para não versionar um estado intermediário quebrado), e o remote `origin` depende da URL do repositório GitHub (pendência manual).

**Pegadinha do git registrada (vai economizar tempo no futuro)**

Para testar a regra acima usei `git check-ignore -v .env.example`, que **imprimiu** `.gitignore:36:!.env.example` e retornou **código 0** — parecia que o arquivo continuava ignorado. Falso alarme: com `-v`, o git mostra a regra que decidiu o resultado (inclusive a negação `!`) e o código de saída é ambíguo para negações.

**Teste definitivo (é este que deve ser usado no futuro):**

```bash
git ls-files --others --exclude-standard | grep -E "^\.env"
# .env.example          ← aparece  ⇒ será versionado (correto)
git check-ignore -q .env.local && echo ignorado   # OK: .env.local ignorado (correto)
```

**Pendências manuais que dependem de segredo do usuário (não podem ser automatizadas)**

```bash
npx supabase login                      # abre o browser / pede access token
npx supabase link --project-ref <ref>   # pede a senha do banco de dados
```

Registrado também que **nenhuma migration é criada nesta fatia** (decisão **D3**): a primeira migration entra na Fatia 1, junto das tabelas de identidade/família, para não criar tabela sem RLS + teste de isolamento. O pipeline `supabase db push` será exercitado lá.

---

### P08 — Camada Supabase SSR (cliente browser, cliente servidor e proxy) · 2026-10-08

**Antes de escrever código: documentação local consultada**

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — confirmou que o Next 16 **renomeou `middleware.ts` para `proxy.ts`**, que o arquivo fica em `src/proxy.ts` (mesmo nível de `app/`), que exporta uma função chamada `proxy` (ou default) e que **o runtime é Node.js por padrão** (a opção `runtime` não existe mais nesse arquivo).
- Tipos do `@supabase/ssr@0.12.7` (`dist/module/types.d.ts`) — confirmou a assinatura `setAll(cookiesToSet, headers)`, onde `headers` são headers de cache que **devem** ser aplicados na resposta.
- Tipos do `@supabase/auth-js` (`GoTrueClient.d.ts`) — confirmou `getClaims(): Promise<{ data: { claims, header, signature } | null, error }>`, com `claims.sub` (id do usuário) e `claims.email`.

**Arquivos criados**

| Arquivo | Papel |
|---|---|
| `src/lib/supabase/env.ts` | Lê e valida `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `src/lib/supabase/client.ts` | Cliente para o **browser** (Client Components) |
| `src/lib/supabase/server.ts` | Cliente para **servidor** (Server Components, Server Actions, Route Handlers) |
| `src/proxy.ts` | Renovação da sessão a cada requisição |

**Decisões de implementação e o porquê**

1. **`env.ts` centralizado em vez de `process.env.X!` espalhado.**
   Com `!` (non-null assertion), esquecer o `.env.local` produziria um erro obscuro. Com a validação, a mensagem é explícita: *"Configuração do Supabase ausente. Copie .env.example para .env.local e preencha..."*. Erro alto e claro > erro silencioso.

2. **Um cliente novo por requisição (função, não singleton no servidor).**
   O cliente de servidor carrega os cookies **daquela** requisição. Guardar uma instância global misturaria sessões de usuários diferentes — na prática, todo mundo veria os dados de quem logou primeiro. O cliente de browser, ao contrário, é singleton por natureza (`createBrowserClient` cuida disso).

3. **`setAll` do cliente de servidor engole o erro de propósito.**
   Server Components **não podem escrever cookies**. Tentar gravar lança exceção; como a renovação de verdade acontece no proxy, o erro aqui não tem o que corrigir. O `catch` vazio é intencional (e está comentado para não parecer descuido).

4. **`getClaims()` em vez de `getSession()` no proxy.**
   `getSession()` apenas lê o cookie, **sem revalidar a assinatura** — como o cookie é controlado pelo cliente, isso permitiria forjar uma sessão. `getClaims()` valida o JWT (localmente, via WebCrypto, quando o projeto usa chave assimétrica) e **renova a sessão automaticamente** se o token estiver perto de expirar. É essa chamada que mantém o usuário logado.

5. **`setAll` faz três coisas, na ordem certa:**
   - propaga os cookies renovados para a **requisição** (`request.cookies.set`) → o Server Component renderizado logo depois já enxerga a sessão nova;
   - **reconstrói a resposta** com a requisição atualizada e grava os cookies nela (`response.cookies.set`) → é o que persiste a sessão para a próxima requisição;
   - copia para a resposta os **headers de cache** (`Cache-Control: private, no-cache...`, `Expires: 0`, `Pragma: no-cache`) → sem eles, uma CDN poderia guardar a resposta que contém o cookie de um usuário e **entregá-la a outro**.

6. **`matcher` restritivo.**
   Sem `matcher`, o proxy roda em **toda** requisição, incluindo `_next/static`, imagens e o próprio CSS/JS — o que pode travar o carregamento da página. O padrão exclui artefatos internos, `favicon.ico`, `manifest.webmanifest`, `sw.js` e `icons/` (esses três últimos já pensando no PWA do `P11`).

7. **O proxy não é fronteira de segurança.**
   Comentado no arquivo: a autorização de verdade é verificada **de novo** dentro de cada página/Server Function. Motivo (documentação do Next 16): um `matcher` mal ajustado, ou mover uma Server Function de rota, pode remover silenciosamente a cobertura do proxy.

**Validação executada**

```bash
npm run format      # 4 arquivos novos formatados
npm run lint        # sem erros
npm run typecheck   # sem erros (inclusive o cast de cookies do @supabase/ssr, que não precisou de ajuste)
```

---

### P09 — Login, rota protegida e o problema do Cache Components · 2026-10-08

**Componentes de UI adicionados**

```bash
npx shadcn@latest add input label card -y
```

→ `src/components/ui/{input,label,card}.tsx`. Usados pelo formulário de login e pelas telas seguintes.

**Arquivos criados**

| Arquivo | Papel |
|---|---|
| `src/server/auth.ts` | `signInWithPassword`, `signOut`, `getAuthenticatedUser` — a camada que fala com o Supabase |
| `src/app/login/actions.ts` | Server Action `signInAction`: valida com Zod **no servidor** e delega para `src/server/` |
| `src/app/login/login-form.tsx` | Client Component do formulário (`useActionState` para erro + estado "Entrando...") |
| `src/app/login/page.tsx` | Página de login; quem já está logado vai direto para `/` |
| `src/app/actions.ts` | Server Action `signOutAction` |
| `src/app/loading.tsx` | Estado de carregamento **e** limite de `<Suspense>` (ver problema abaixo) |

**Arquivos editados**

- `src/app/page.tsx` — deixou de ser o "Hello world" e virou a rota protegida.
- `src/app/layout.tsx` — `lang="pt-BR"` (era `"en"`) e título/descrição em português, com `template: "%s · Finanças do Casal"` para as páginas filhas.

**Decisões e o porquê**

- **Validação em dois níveis:** o `required` do browser é só conveniência; a validação que conta é a do Zod na Server Action. O `signInSchema` rejeita e-mail malformado e senha vazia.
- **Mensagem de erro genérica** ("E-mail ou senha incorretos.") de propósito: não revela se o e-mail existe na base (evita enumeração de usuários).
- **`getAuthenticatedUser()` usa `getClaims()`**, não `getSession()` nem o cookie cru.
- **Formulário é Client Component só pelo `useActionState`** (erro + `isPending`); a lógica fica toda no servidor.
- **`role="alert"`** na mensagem de erro e `autoComplete` correto nos campos (`email`, `current-password`) — acessibilidade e preenchimento automático no celular.

#### PROBLEMA PRINCIPAL DO PASSO: build quebrando por causa do Cache Components

**Sintoma** — `npm run build` falhava:

```
Error: Route "/": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed
outside of `<Suspense>` prevents the route from being prerendered...
Error occurred prerendering page "/". ... exiting the build.
```

**Causa raiz:** o template do Next 16 veio com `cacheComponents: true`. Nesse modo, o Next tenta pré-renderizar um *shell estático* de cada rota. Nossas páginas chamam `cookies()` (para ler a sessão) — e uma leitura de requisição **não pode** fazer parte do shell estático. Resultado: erro de build.

**Tentativas e o que cada uma ensinou:**

1. `export const instant = false` **na página** → **não resolveu**. O erro de build continuou idêntico.
2. `export const instant = false` **no layout raiz** (a doc diz que é o nível mais alto que controla a validação de shell estático) → **também não resolveu**.
   - Aprendizado: o `instant = false` do Next 16 controla a **validação de navegação instantânea** (avisos em desenvolvimento) e o opt-out da validação de shell estático — mas **não** desliga a exigência de `<Suspense>` para dados de requisição. A sugestão "[block] Set `export const instant = false`" na mensagem de erro é enganosa para este caso.
3. Consulta à documentação embarcada → encontrado o guia exato:
   `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`

   Trecho decisivo: *"A component that reads the session must sit behind a `<Suspense>` boundary. With Cache Components, reading `cookies()` outside a boundary is a build error."*

**Solução adotada:** `src/app/loading.tsx`.

O `loading.tsx` do App Router cria, por definição, um limite `<Suspense>` em volta da página. Em vez de reestruturar cada página com `<Suspense>` explícito e um esqueleto duplicado, um único arquivo resolve para todas as rotas **e** já entrega o estado de carregamento pedido pelas instruções ("Trate estados de carregamento, erro e vazio em toda tela").

**Soluções rejeitadas:**

- `"use cache"` para "cachear" a leitura da sessão → **perigoso**: cachear dado privado de usuário pode servir o conteúdo de um usuário para outro. O guia prevê `use cache: private` (escopo só do browser) para esse fim, mas isso traz risco de mostrar dado antigo após troca de usuário; não vale a pena na fundação.
- Desligar `cacheComponents` → resolve o sintoma, mas joga fora o modelo de renderização padrão do Next 16 no app inteiro. Preferimos seguir o padrão do framework.
- `export const instant = false` → comprovadamente não resolve (testado duas vezes).

**Resultado no build**

```
Route (app)
┌ ◐ /
├ ○ /_not-found
└ ◐ /login

ƒ Proxy (Middleware)

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

`◐` = **Partial Prerender**: o shell HTML é estático (carrega instantâneo) e o conteúdo privado chega por streaming. `ƒ Proxy` confirma que o `src/proxy.ts` foi registrado.

**Validação em runtime (executada de verdade)**

Não dá para logar sem as credenciais reais do Supabase, mas dá para validar o comportamento de sessão ausente. Com um `.env.local` **temporário** com valores fictícios:

```bash
npm run dev
curl -sw "%{http_code} %{redirect_url}" http://localhost:3000/       # 200 (ver nota)
curl -sw "%{http_code}"               http://localhost:3000/login    # 200
```

- `/login` → 200 e o HTML contém "Finanças do Casal", "Entrar" e `name="email"` ✔
- `/` → 200 com o shell contendo "Carregando…" + marcadores de redirect; o redirecionamento para `/login` é entregue **durante o streaming** (comportamento esperado no modelo PPR — a resposta HTTP já começou quando o Next descobre que não há sessão).
- Log do dev server comprova o proxy em execução: `GET / 200 ... (proxy.ts: 191ms)`.

**Trade-off registrado:** um usuário sem sessão vê "Carregando…" por um instante antes de cair no `/login`. Melhoria futura possível: redirecionar no `src/proxy.ts` para responder 307 imediatamente. Não foi feito agora porque (a) o padrão recomendado pelo guia oficial é o redirect na camada de dados e (b) o proxy não deve ser a única barreira de segurança — a checagem da página continua sendo a que vale.

O `.env.local` temporário foi removido ao final do teste.

**Validação final do passo**

```bash
npm run format      # ok
npm run lint        # sem erros
npm run typecheck   # sem erros
npm test            # 6 testes passando
npm run build       # ✓ build completo, rotas ◐ / e ◐ /login
```

**Convenção a repetir (decisão D9):** qualquer tela que leia sessão/cookies fica dentro do limite de `<Suspense>` criado pelo `loading.tsx` da sua rota. Quem for criar uma tela nova: não chame `cookies()` fora desse limite, ou o build quebra.

---

### P10 — Integração contínua (GitHub Actions) · 2026-10-08

**Arquivo criado:** `.github/workflows/ci.yml`

**Versões das actions verificadas na fonte** (as minhas "de memória" estavam desatualizadas — em 2026 o `checkout` está na v7 e o `setup-node` na v7):

| Action | Versão usada | Observação |
|---|---|---|
| `actions/checkout` | `@v7` | v7 exige runner recente (GitHub-hosted está ok) |
| `actions/setup-node` | `@v7` | |

**Etapas do job, em ordem (da mais barata para a mais cara)**

```
checkout → setup-node (Node 24 + cache npm) → npm ci
  → npm run lint
  → npm run format:check
  → npm run typecheck
  → npm test
  → npm run build
```

**Decisões e o porquê**

- **`node-version: 24`** — mesma versão do ambiente de desenvolvimento (v24.16.0). Divergência entre dev e CI é fonte clássica de "na minha máquina funciona".
- **`cache: npm`** — reaproveita o cache de pacotes entre execuções.
- **`concurrency` com `cancel-in-progress: true`** — se você empurrar três commits seguidos, as duas primeiras execuções são canceladas; economiza minutos e devolve o resultado antes.
- **`npm ci` (e não `npm install`)** — instala exatamente o que está no `package-lock.json`. `npm install` poderia resolver versões diferentes das do desenvolvimento.
- **`format:check` no CI** — o Prettier já está configurado; verificar no CI evita que o padrão se degrade com o tempo.
- **O `build` entra mesmo com deploy automático na Vercel** — o CI precisa ser uma barreira completa sozinho. Foi justamente um erro **específico de build** do Next (as regras do Cache Components do `P09`) que quebrou o projeto; `lint`/`typecheck`/`test` não pegariam aquele erro. Custo: ~1 minuto.
- **Nenhum segredo é necessário** — nenhuma etapa acessa o Supabase. Os testes são de regras puras e o build não executa o código que lê cookies (ele fica atrás do limite de `<Suspense>`, então só roda em requisição). Isso é consequência direta da arquitetura definida em D3/D9 — e é o que permite o CI rodar em pull request de fork com segurança.

**Validação executada (simulando o CI na máquina)**

```bash
npm run lint         # sem erros
npm run format:check # "All matched files use Prettier code style!"
npm run typecheck    # ok
npm test             # 6 testes passando
npm run build        # já validado no P09
```

**Pendência para o workflow rodar de verdade:** o repositório precisa ser empurrado para o GitHub (`git remote add origin ...` + `git push`). Depende da URL do repositório (pendência manual).

---

### P11 — PWA instalável (manifest, ícones e metadados) · 2026-10-08

**Objetivo do `ROADMAP.md`:** *"PWA básico (manifest + ícones; instalável)"*.

**Decisão D5 revisada: SEM service worker.** Antes de instalar o Serwist, consultei o guia do Next 16 (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) e ele é explícito: *"you can trigger install prompts without needing offline support"*. Três motivos para não usar SW agora:

1. **Desnecessário** para instalar (o recipe oficial do Next é manifest + ícones).
2. **Risco de segurança**: um service worker que cacheasse o HTML das páginas autenticadas poderia servir a tela de um usuário para outro a partir do cache do dispositivo. Neste app todas as telas são privadas.
3. **Fora do escopo**: offline não está na lista de funcionalidades do MVP (`PRODUCT.md` §5).

Se um dia offline virar requisito, o Serwist pode entrar — mas com uma estratégia de cache que nunca toque em HTML autenticado.

**Arquivos criados**

| Arquivo | Papel |
|---|---|
| `src/app/manifest.ts` | Web App Manifest (nome, cores, `display: standalone`, ícones) |
| `scripts/generate-icons.py` | Gera **todos** os ícones a partir de um design em código |
| `src/app/favicon.ico` · `src/app/icon.png` · `src/app/apple-icon.png` | Ícones pela **convenção de arquivo** do App Router |
| `public/icons/icon-192.png` · `icon-512.png` · `maskable-512.png` | Ícones com URL fixa, referenciados pelo manifest |

**Por que um script para gerar ícones (e não imagens soltas no repositório)**

- A origem do design fica versionada: mudou a cor do app → roda `python3 scripts/generate-icons.py` e os 6 arquivos são regerados de forma consistente.
- Evita "ícone esquecido desatualizado" (um deles com a cor antiga).
- O script procura uma fonte em negrito numa lista de caminhos conhecidos e **falha com mensagem clara** se não achar, em vez de gerar um ícone feio em silêncio.

**Decisões de design dos ícones**

- Fundo em gradiente esmeralda (`#10B981 → #047857`) com o glifo **R$** em branco — legível em 16 px e coerente com um app financeiro sem competir com a UI (que é neutra, base do shadcn).
- **Maskable separado**: o Android recorta o ícone (círculo, squircle...), então o `maskable-512.png` tem fundo até a borda e o glifo menor, na "zona segura" de 80%.
- **Apple touch icon quadrado e opaco**: o iOS pinta de preto onde há transparência.

**Três mecanismos diferentes de metadados — e por que cada um**

| O quê | Mecanismo | Por quê |
|---|---|---|
| Favicon e ícones | **Convenção de arquivo** (`src/app/*.png`, `src/app/favicon.ico`) | Caminho recomendado pela documentação do Next; gera as tags `<link>` sozinho e aplica hash de cache |
| Manifest | **Convenção de arquivo** (`src/app/manifest.ts`) | Next injeta `<link rel="manifest">` automaticamente |
| Título, descrição, `themeColor`, `appleWebApp`, `formatDetection` | **API de metadados** (`metadata` + `viewport` no layout) | Campos que não têm arquivo correspondente |

Validei o head gerado em **desenvolvimento e em produção** — este é o resultado (produção):

```html
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="theme-color" content="#047857"/>
<title>Entrar · Finanças do Casal</title>
<meta name="description" content="Controle financeiro pessoal e da família ..."/>
<meta name="application-name" content="Finanças do Casal"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<meta name="format-detection" content="telephone=no"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-title" content="Finanças"/>
<meta name="apple-mobile-web-app-status-bar-style" content="default"/>
<link rel="icon" href="/favicon.ico?..." sizes="48x48" type="image/x-icon"/>
<link rel="icon" href="/icon.png?..." sizes="192x192" type="image/png"/>
<link rel="apple-touch-icon" href="/apple-icon.png?..." sizes="180x180" type="image/png"/>
```

Todos os assets respondem `200`: `/manifest.webmanifest`, `/favicon.ico`, `/icon.png`, `/apple-icon.png`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/maskable-512.png`.

---

#### INCIDENTE — 3 horas perdidas por dessincronização entre o editor e o disco

**Vale ler antes de investigar qualquer "bug estranho" no projeto.**

**O que aconteceu**

Durante os testes do PWA, o `layout.tsx` parecia "ignorar" tudo: nem `themeColor`, nem `appleWebApp`, nem `formatDetection` apareciam no HTML. Cheguei a formular a hipótese de bug do Next 16.4 com `cacheComponents` e estava a caminho de aplicar um contorno manual (tags `<meta>` escritas à mão).

**A causa raiz (dupla)**

1. **O arquivo em disco estava congelado num estado antigo.** O `npm run format` (Prettier) reescreveu `src/app/layout.tsx` por fora do editor enquanto ele tinha alterações não salvas. A partir daí, os edits seguintes foram aplicados **no buffer do editor** e não chegavam ao disco — enquanto a ferramenta de leitura (que lê o buffer) mostrava tudo correto. O servidor de desenvolvimento, obviamente, lia o disco.
2. **Um servidor antigo ocupava a porta 3000.** Uma execução anterior de `next dev` não morreu com o padrão de `pkill` usado; o servidor novo subiu na 3001 e os `curl` continuaram batendo no processo antigo. (O log dizia claramente `Port 3000 is in use ... using available port 3001`.)

**Como diagnosticar em 10 segundos (guardar este comando)**

```bash
# lê o DISCO, não o buffer do editor:
node -e "console.log(require('fs').readFileSync('src/app/layout.tsx','utf8'))"
```

Se o resultado divergir do que o editor mostra → é dessincronização. Solução: gravar o conteúdo desejado direto no arquivo (aqui usei `cat > arquivo <<'EOF'`) e confirmar com o mesmo comando. Depois disso a ferramenta voltou a gravar normalmente.

**Como evitar de novo**

- Depois de rodar `npm run format` (ou qualquer processo que reescreva arquivos), **conferir se os edits seguintes chegam ao disco** com o `node -e` acima.
- Para encerrar servidores de desenvolvimento: `pkill -f "next-server"` (o processo real chama-se `next-server`, não `next dev`) e **confirmar a porta** com `ss -ltnp | grep :3000` antes de testar.
- Sempre que um teste não fizer sentido ("mudei e não mudou nada"), desconfiar de **cache/servidor/arquivo stale** antes de formular hipóteses sobre frameworks.

**Consequência no BUILD_LOG:** a hipótese de bug do Next registrada em rascunhos deste passo foi **descartada e removida** — as APIs de metadados do Next 16.4 funcionam corretamente (o head de produção acima prova).

**Validação final do passo**

```bash
npm run format      # ok
npm run lint        # sem erros
npm run typecheck   # sem erros
npm test            # 6 testes passando
npm run build       # rotas: ◐ / · ◐ /login · ○ /_not-found · ○ /icon.png · ○ /apple-icon.png · ○ /manifest.webmanifest
```

---

### P12 — README.md · 2026-10-08

**Arquivo editado:** `README.md` (substituiu o texto genérico do `create-next-app`).

**O que o README cobre**

| Seção | Por que existe |
|---|---|
| O que é o projeto + links para os docs | Quem chega novo (ou um agente de IA) sabe onde ler produto, regras e histórico |
| Estado atual | Deixa claro que a Fatia 0 está concluída |
| Stack | Decisões de tecnologia num lugar só |
| Requisitos | Node 24+ (versão usada no desenvolvimento) |
| Como rodar | Passo a passo, **incluindo** o aviso de que é preciso criar o primeiro usuário no painel do Supabase (não existe cadastro pela interface ainda) |
| Comandos | Tabela com todos os scripts |
| Banco de dados | Comandos do CLI do Supabase, com o lembrete de que os segredos são digitados pelo próprio usuário |
| Estrutura de pastas | Mapa do código, com a nota de que `src/proxy.ts` é o antigo `middleware.ts` |
| **Convenções que não se quebram** | As 7 regras das instruções, resumidas — inclusive a nova regra do `<Suspense>` (D9) |
| Problemas conhecidos | As 5 vulnerabilidades `high` do `npm audit` com a explicação de por que **não** aplicar o "fix" |
| Deploy e CI | O que falta e o que já roda |

---

### P13 — Validação final e commit inicial · 2026-10-08

**Suíte completa executada**

```bash
npm run lint         # sem erros
npm run format:check # "All matched files use Prettier code style!"
npm run typecheck    # next typegen + tsc, sem erros
npm test             # 6 testes passando
npm run build        # ✓
```

**Rotas no build final**

```
Route (app)
┌ ◐ /            ← rota protegida (shell estático + conteúdo em streaming)
├ ○ /_not-found
├ ○ /apple-icon.png
├ ○ /icon.png
├ ◐ /login
└ ○ /manifest.webmanifest

ƒ Proxy (Middleware)
```

**Verificação de integridade do disco**

Como o incidente do `P11` mostrou que o editor e o disco podem divergir, rodei uma conferência de 14 arquivos-chave lendo **do disco** e procurando marcadores conhecidos (ex.: `layout.tsx` contém `export const viewport` e `pt-BR`; `ci.yml` contém `actions/checkout@v7`; `BUILD_LOG.md` contém `P12`). Resultado: **todos sincronizados**.

**Commit inicial**

```bash
git add -A
# conferência antes de commitar:
#   - 48 arquivos
#   - nenhuma ocorrência dos valores de teste usados nos .env.local temporários
#   - únicos arquivos com "env" no nome: .env.example (valores vazios) e src/lib/supabase/env.ts
git commit -m "feat: fundação do projeto (Next.js 16, Supabase Auth, Vitest, CI e PWA)"
# → 18021bd
```

**O que ficou de fora de propósito (e por quê)**

| Item | Motivo |
|---|---|
| Service worker / offline | Fora do escopo do MVP; risco de cachear HTML privado (D5 revisada) |
| Tabelas de negócio e migrations | Entram na Fatia 1, cada uma com RLS e teste de isolamento (D3) |
| `parseAmountToCents`, `splitInstallments`, `resolveStatementMonth` | Pertencem às Fatias 3 e 4 |
| Configuração da Vercel | Depende de acesso do usuário |
| `git remote` | Depende da URL do repositório GitHub |

---

### P14 — Export estático (GitHub Pages) investigado e descartado · 2026-10-08

**Pedido:** adicionar `output: "export"` ao `next.config.ts` para gerar arquivos estáticos em `out/` e hospedar no GitHub Pages.

**Por que não foi feito direto:** export estático remove o servidor, e este app depende dele em pontos estruturais. Em vez de aplicar a flag e descobrir depois, fiz a checagem em duas frentes — documentação e build de verdade.

**Fonte 1 — documentação embarcada do Next 16** (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, seção *Unsupported Features*): recursos que **exigem servidor Node.js** e não são suportados:

- **Cookies** · **Proxy** · **Server Actions** · Redirects · Headers · Rewrites · ISR · Draft Mode · Image Optimization (loader padrão) · Route Handlers que dependem de `Request`

**Fonte 2 — builds executados de verdade** (com o projeto real, não um exemplo):

| # | Configuração testada | Resultado |
|---|---|---|
| 1 | `output: "export"` | ❌ `/manifest.webmanifest` exige `export const dynamic = "force-static"` |
| 2 | + `dynamic = "force-static"` no manifest | ❌ `Route segment config "dynamic" is not compatible with nextConfig.cacheComponents` → obrigaria a desligar `cacheComponents` **e** `partialPrefetching` (PPR precisa de servidor) |
| 3 | + `cacheComponents`/`partialPrefetching` desligados, `images.unoptimized: true` | ❌ **`Server Actions are not supported with static export.`** |

**O que isso quebraria, em concreto** (tudo construído no `P09`):

| Arquivo | Recurso incompatível |
|---|---|
| `src/app/login/actions.ts` | Server Action (login) |
| `src/app/actions.ts` | Server Action (sair) |
| `src/lib/supabase/server.ts` | `cookies()` |
| `src/proxy.ts` | Proxy (renovação da sessão) |

Ou seja: **login e logout param de funcionar** — e o `ROADMAP.md` exige "login funciona" como critério de pronto.

**Alternativa apresentada:** migrar a autenticação para o browser (padrão SPA do Supabase: `signInWithPassword` no cliente, proteção de rota client-side, RLS como barreira de segurança) e então o GitHub Pages funcionaria.

**Decisão do usuário: manter a arquitetura de servidor e publicar na Vercel** (registrada como `D10`).

Observação que pesou na conversa: o **GitHub Pages publica o site de forma pública** — Pages privado exige GitHub Enterprise. Os dados continuam protegidos por login + RLS, mas o app ficaria acessível a qualquer um, e ainda seria necessário configurar `basePath` (a URL vira `usuario.github.io/finapp`).

**Estado final:** nenhuma mudança permanente. Os arquivos usados no teste foram restaurados com `git checkout -- next.config.ts src/app/manifest.ts`, a árvore ficou limpa (`git status` vazio) e o build voltou a passar, com as rotas `◐ /` e `◐ /login` e o `ƒ Proxy (Middleware)`.

**Lição para o futuro:** se em algum momento "hospedagem estática" voltar à mesa, a conversa **não** é sobre uma flag no `next.config.ts` — é sobre reescrever a autenticação para o cliente. Enquanto o login usar Server Actions e sessão em cookie validada no servidor, o deploy precisa de um host com runtime Node (Vercel, Netlify, Cloudflare).

---

### P15 — Fatia 1, fase 1: banco de identidade e família (migration + RLS + testes) · 2026-10-08

**Objetivo da fase:** entregar a estrutura de dados de identidade/família com RLS e **provar o isolamento entre usuários** antes de escrever qualquer tela.

**Comando executado**

```bash
npx supabase migration new identity_and_households
# → supabase/migrations/20261008180810_identity_and_households.sql
```

**O que a migration cria** (~510 linhas, todas comentadas)

| Objeto | Papel |
|---|---|
| `profiles` | Nome e e-mail de cada usuário; criado no cadastro |
| `user_settings` | Preferências (regra do dia de pagamento). **Privada** |
| `households` | A família (espaço compartilhado) |
| `household_members` | Vínculo usuário↔família, papel `owner`/`member` |
| `household_invites` | Convite por código, uso único, validade de 30 dias |
| 3 funções de apoio | `is_household_member`, `is_household_owner`, `shares_household_with` |
| 4 funções de domínio | `create_household`, `accept_household_invite`, `leave_household` + trigger `handle_new_user` |
| 10 policies + grants | RLS em todas as tabelas, com privilégio mínimo |

**Decisões de segurança (o "porquê" de cada uma)**

1. **Ninguém entra numa família por `INSERT`.** `household_members` não tem policy nem grant de `INSERT`. Entrar só é possível por `create_household()` ou `accept_household_invite()`. Saber (ou adivinhar) o id de uma família não basta para se juntar a ela — e isso está testado.
2. **Toda função `SECURITY DEFINER` usa `set search_path = ''`**, o que obriga nomes totalmente qualificados e fecha o ataque clássico de `search_path`.
3. **`EXECUTE` revogado de `public`/`anon`** em todas as funções chamáveis; concedido só a `authenticated`.
4. **Privilégio mínimo de tabela:** `revoke all` seguido do grant específico (`profiles`: select/update; `household_members`: só select; etc.). O RLS decide **linhas**; os grants decidem **ações** — duas camadas independentes.
5. **`user_settings` é privada até de quem é da família.** É o dado que o teste usa para provar que "faz parte da família" não significa "pode ver tudo".
6. **Convite de uso único** (`accepted_at`) com validade de 30 dias e `SELECT … FOR UPDATE` no aceite: dois aceites simultâneos do mesmo código não criam dois vínculos.
7. **Formato do código travado no banco** por `CHECK` (10 caracteres, alfabeto sem `I`/`L`/`O`/`0`/`1`). Nem um cliente malicioso consegue inserir um código fraco tipo `1234`.
8. **`households.created_by` usa `ON DELETE RESTRICT`** (as outras tabelas usam `CASCADE`): apagar a conta de quem criou a família não pode apagar a família — e os dados — de todo mundo junto. Preferimos um erro a uma perda silenciosa.
9. **Sem policy de `DELETE` em `households`**: excluir a família não é funcionalidade desta fatia, e a ausência de policy é a forma mais segura de dizer "não".

**Validação local antes de tocar na nuvem (Docker)**

Como o SQL é grande e as policies são sutis, subi um Supabase local para validar de verdade em vez de confiar na leitura:

```bash
npx supabase start     # primeira vez baixa as imagens (~1 GB)
# → "Applying migration 20261008180810_identity_and_households.sql..." sem erro
```

Conferência direta no banco (`docker exec supabase_db_finapp psql …`):

```
       tabela       | rls_ativa
--------------------+-----------
 household_invites | t
 household_members | t
 households        | t
 profiles          | t
 user_settings     | t
(5 linhas) + 10 policies
```

**Teste de isolamento — `src/integration/rls-isolation.integration.test.ts`**

15 asserções em 5 blocos, falando com o Supabase usando **apenas a chave publishable** (nunca a secreta), exatamente como o navegador faz:

1. **Controle positivo:** A vê a própria família, o próprio vínculo, o próprio perfil e as próprias preferências. *Sem isso, um banco que negasse tudo passaria no teste — falso positivo.*
2. **Estranho:** B não vê família, membros, convites, perfil de A nem preferências de A; não altera o perfil de A; não se junta por `INSERT`; não cria convite na família de A; recebe erro claro ao tentar um código inventado.
3. **Convite:** A gera o código; B aceita **digitando o código formatado e em minúsculas** (`abc-defg-hjk`).
4. **Depois de entrar:** B vê a família e o nome de A, mas **continua sem ver as preferências de A** e não consegue renomear a família (só o dono).
5. **Saída:** B sai e o código de uso único passa a ser recusado como "já utilizado".

**BUG REAL encontrado pelo teste (vale registrar)**

O aceite falhou na primeira execução porque a normalização do código existia em **dois lugares com regras diferentes**:

- TypeScript (`normalizeInviteCode`): remove tudo que não é letra/número e sobe para maiúsculas;
- SQL (`accept_household_invite`): só fazia `upper(btrim(…))` — **não removia o hífen**.

Resultado: o código exibido (`ABC-DEFG-HJK`) não era aceito quando colado com a formatação. Correção: o SQL passou a usar `regexp_replace(…, '[^a-zA-Z0-9]', '', 'g')`, a mesma regra do TypeScript. **Contrato alinhado nas duas pontas** e coberto por teste.

**Segundo achado — o teste unitário pegou um dado de teste errado**

O primeiro teste do código de convite falhou com `"ABCDEFGHIJ"` e estava certo em falhar: a letra **`I`** está fora do alfabeto justamente por ser ambígua com `1`. A constante de teste é que estava errada. O alfabeto sem caracteres ambíguos é fácil de violar até em teste.

**`leave_household()` — função que nasceu da necessidade do teste**

Sem ela, B entraria na família na primeira execução e ficaria lá para sempre: o cenário "estranho não vê nada" funcionaria **uma única vez** e o teste passaria a mentir nas execuções seguintes. A função também fecha uma lacuna do modelo (quem entra pode sair) e é segura por construção: remove apenas o **próprio** vínculo, e o `owner` não pode sair.

**Estratégia de testes: dois comandos, de propósito**

| Comando | O que roda | Precisa de quê | Roda no CI? |
|---|---|---|---|
| `npm test` | Testes unitários (`src/domain/*.test.ts`) | Nada | ✅ sim |
| `npm run test:rls` | Testes de integração (`*.integration.test.ts`) | Supabase no ar + credenciais | ❌ ainda não |

O CI continua **sem segredo nenhum** e hermético. Os testes de integração são um comando explícito, em vez de serem pulados em silêncio — quem roda precisa ver que rodaram.

**Validação executada**

```bash
npx supabase db reset   # aplica a migration do zero
npm run test:rls        # 15 testes passando (contra o Supabase local)
npm run format          # ok
npm run lint            # sem erros
npm run typecheck       # sem erros
npm test                # 21 testes passando
```

**Arquivos desta fase**

- `supabase/migrations/20261008180810_identity_and_households.sql` (novo)
- `src/domain/invite-code.ts` + `src/domain/invite-code.test.ts` (novos)
- `src/integration/rls-isolation.integration.test.ts` (novo)
- `vitest.integration.config.mts` (novo); `vitest.config.mts` e `package.json` (editados)
- `docs/DOMAIN.md` — §2 (entidades), §3.1 e §3.2 (privacidade e funções), §4.10 (regras da família/convite) e §5 (testes 8 e 9)

---

### P16 — Fatia 1, fase 2: camada de servidor · 2026-10-09

**Objetivo da fase:** dar ao app uma camada única de acesso a dados — tipos do banco, contexto de sessão, operações de família/convite e cadastro — antes de escrever as telas.

**Entrega em uma frase:** as páginas vão poder perguntar "quem está logado?", "já tem família?" e "quais os membros?" chamando uma função, sem falar com o Supabase diretamente e sem repetir regra de nada.

**1. Tipos gerados do banco (`npm run db:types`)**

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

- **Por quê:** sem isso, toda consulta devolvia tipo solto e cada acesso a coluna exigia conversão manual — exatamente onde erro de digitação vira bug em produção. Com os tipos, tabelas, colunas e funções são conhecidas pelo TypeScript.
- Os clientes (`src/lib/supabase/client.ts` e `server.ts`) passaram a ser `createClient<Database>`.
- O arquivo gerado entrou no `.prettierignore`. **Não é detalhe:** o `format:check` do CI falharia, porque o gerador não formata como o Prettier.
- Script `db:types` criado para regenerar quando o schema mudar (fácil de esquecer — daí o script em vez do comando solto).

**2. Contexto de sessão — `src/server/session.ts`**

`getSessionContext()` responde as perguntas de toda tela privada e está embrulhado em `cache()` do React: o layout e a página chamam, e o banco é consultado **uma vez por requisição**.

Sobre ele, duas funções que as telas usam direto:
- `requireSession()` → sem sessão, manda para `/login`;
- `requireHousehold()` → sem família, manda para `/onboarding`.

Assim a regra de "para onde ir" fica em um lugar só, em vez de repetida em cada página.

**3. Módulos puros novos (com teste)**

| Arquivo | Por quê |
|---|---|
| `src/domain/scope.ts` | O escopo (pessoal/família) vem de **cookie**, que é entrada controlada pelo usuário: precisa ser validado. `parseScope` cai no padrão quando recebe lixo. |
| `src/domain/household.ts` | O banco garante `role in ('owner','member')`, mas o tipo gerado é `string`. `parseHouseholdRole` converte **para baixo**: desconhecido vira `member`, nunca `owner`. Promover alguém a dono por acidente seria falha de autorização. |
| `src/lib/auth-messages.ts` | O Supabase Auth responde em inglês e a interface é pt-BR. O caso desconhecido vira texto genérico — **não vaza jargão técnico** para o usuário. |

**4. Acesso a dados — `src/server/households.ts`**

`createHousehold`, `joinHouseholdWithCode`, `leaveHousehold`, `listHouseholdMembers`, `createInvite`, `listActiveInvites`, `revokeInvite`.

- O **código do convite é gerado no servidor** com `crypto.randomInt` (não `Math.random`), com nova tentativa quando o `UNIQUE` acusa colisão.
- `listHouseholdMembers` faz **duas consultas**: `household_members.user_id` aponta para `auth.users`, não para `profiles`, então o PostgREST não consegue embutir o perfil. A RLS de `profiles` libera a leitura de quem divide a família.
- Nenhuma autorização mora aqui — quem decide é o RLS. O comentário no topo do arquivo avisa isso em letras grandes.

**5. Estratégia de mensagem de erro (vale para o projeto todo)**

Erro do banco **não** é repassado direto para a tela. Só mostramos a mensagem quando o código de erro está numa lista fechada — `22023`, `23505`, `42501` — porque esses são os erros que **nós** levantamos, em português e sem jargão ("Código de convite inválido", "Você já faz parte de uma família"). Todo o resto (conexão, `PGRST`, permissão inesperada) vira uma mensagem padrão: erro técnico não ajuda o usuário e pode expor detalhe.

**6. Cadastro — `signUpWithPassword`**

Devolve `{ error, needsEmailConfirmation }`. O nome vai em `options.data`, de onde o trigger `handle_new_user` o lê para criar o perfil. A tela consegue tratar os dois cenários: com a confirmação de e-mail ligada, mostra "confirme seu e-mail" em vez de deixar a pessoa presa sem explicação.

**Melhoria de quebra-galho no login:** antes, **qualquer** erro virava "E-mail ou senha incorretos." — inclusive "confirme seu e-mail", que deixava o usuário sem entender o que fazer. Agora a mensagem traduzida é usada, e o caso de credenciais inválidas continua genérico (não revela se o e-mail existe).

**7. Migration de backfill (`20261009141956`) — problema real encontrado no caminho**

O trigger `handle_new_user` só dispara em **INSERT novo** em `auth.users`. Quem já tinha conta quando a migration anterior foi aplicada — caso do usuário de teste criado pelo painel na Fatia 0 — ficou **sem** `profiles` e sem `user_settings`, e o app espera essas linhas.

Migration idempotente (`where not exists`) que cria o que falta, com nome derivado do e-mail. **Verificado de verdade:** apaguei os 2 perfis e as 2 preferências do banco local, rodei o SQL e as 4 linhas voltaram.

**Validação executada**

```bash
npx supabase db reset   # aplica as DUAS migrations do zero, sem erro
npm run test:rls        # 15 testes de isolamento passando
npm test                # 33 testes unitários passando (5 arquivos)
npm run format:check    # "All matched files use Prettier code style!"
npm run lint            # sem erros
npm run typecheck       # sem erros (a tipagem do join foi aceita)
npm run build           # ✓
```

**Arquivos desta fase**

- `src/lib/supabase/database.types.ts` (novo, gerado) + clientes tipados
- `src/server/session.ts` (novo) e `src/server/households.ts` (novo)
- `src/server/auth.ts` (cadastro + mensagens traduzidas) e `src/app/login/actions.ts` (usa a mensagem traduzida)
- `src/domain/scope.ts`, `src/domain/household.ts`, `src/lib/auth-messages.ts` (+ os 3 arquivos de teste)
- `supabase/migrations/20261009141956_backfill_identity_for_existing_users.sql` (novo)
- `package.json` (scripts `db:types`), `.prettierignore`

### P17 — Fatia 1, fase 3: as telas · 2026-10-09

**Objetivo da fase:** transformar a camada de servidor em telas usáveis — as duas pessoas precisam conseguir criar conta, formar a família e convidar uma à outra **pelo celular**, sem caderno e sem planilha.

**Entrega em uma frase:** dá para se cadastrar, criar a família, gerar um código, a outra pessoa entrar com esse código e as duas verem a mesma família — verificado de ponta a ponta no navegador, com o log do servidor limpo.

**1. Rotas reorganizadas em grupos (`git mv`, histórico preservado)**

```
src/app/
  (auth)/          ← telas públicas, centralizadas, sem shell
    layout.tsx
    login/  → actions.ts, login-form.tsx, page.tsx
    signup/ → actions.ts, signup-form.tsx, page.tsx
  (app)/           ← telas autenticadas, com shell
    layout.tsx, actions.ts, page.tsx
    _components/ → app-nav.tsx, scope-switch.tsx
    familia/ → page.tsx, _components/{invite-card,copy-code-button}.tsx
    conta/   → page.tsx, _components/leave-family-card.tsx
  onboarding/      ← fora dos dois grupos (ver D12)
  actions.ts       ← `signOutAction`, usada por `(app)` e onboarding
```

Os parênteses **não aparecem na URL** — servem só para agrupar arquivos e compartilhar layout. Por isso `(app)/actions.ts` e companhia importam uns aos outros por caminho **relativo** (`../actions`): `@/app/(app)/...` funcionaria, mas parênteses em alias de import é fonte de confusão.

**2. Telas públicas**

- `/login` e `/signup` verificam a sessão **no servidor** antes de renderizar: quem já está logado não vê formulário, vai direto para onde faz sentido (onboarding ou visão geral).
- Validação com Zod **no servidor** (a do navegador é só conveniência): nome 1–80, e-mail válido, senha ≥ 6.
- O cadastro trata os dois cenários: com confirmação de e-mail ligada, mostra "confirme seu e-mail" em vez de deixar a pessoa presa.

**3. Onboarding — o passo entre ter conta e ter família**

Duas portas na mesma tela: **criar** a família (quem criou vira dono) ou **entrar com código**. O código aceito é cru ou formatado, em qualquer caixa (`3tk-tzh6-qtq` funciona) — a normalização existe nas duas pontas, no TypeScript e na função do banco (foi um bug real pego pelo teste, ver `P15`).

**4. Shell do app (`(app)/layout.tsx`)**

Cabeçalho (família + quem está logado), alternância de visão, conteúdo e **barra de navegação fixa embaixo** — padrão de app de celular, com alvo grande ao alcance do polegar.

A barra é Client Component por um motivo só: `usePathname` para marcar o item ativo. A alternância de visão **não** usa JavaScript no cliente — é um formulário com dois botões de envio, e o estado ativo vem do cookie lido no servidor. Resultado: a tela já nasce no estado certo, sem piscar depois da hidratação.

**5. Telas do app**

| Tela | O que faz |
|---|---|
| `/` | Visão geral: explica a visão ativa (pessoal é "invisível para a família"; família é o que é compartilhado). É o lugar onde a Folha do mês entra na Fatia 5 |
| `/familia` | Quem está na família (nome, e-mail, papel) + gerar convite (com botão copiar) + lista de convites válidos com cancelar |
| `/conta` | Nome, e-mail, família, papel + sair da família (só para membros) + sair da conta |

**Convenções das telas:** código e comentários em inglês, interface em pt-BR; erro de formulário em `<p role="alert">`; estado de carregamento com o primitivo `Skeleton` (`src/components/ui/skeleton.tsx`), para todas as telas esperarem do mesmo jeito.

**6. Server Actions — onde cada uma mora e por quê**

| Arquivo | Ações | Motivo da localização |
|---|---|---|
| `src/app/actions.ts` | `signOutAction` | Usada por dois grupos (`(app)` e onboarding) — fica na raiz |
| `src/app/onboarding/actions.ts` | `createFamilyAction`, `joinFamilyAction` | Só o onboarding usa |
| `src/app/(app)/actions.ts` | `setScopeAction`, `createInviteAction`, `revokeInviteAction`, `leaveFamilyAction` | Só o app autenticado usa |

**Ponto de autorização que vale explicação:** o `householdId` **não** vem do formulário do convite — é lido do contexto da requisição (`requireHousehold()`). Aceitar um id enviado pela tela seria confiar no cliente para dizer a qual família o convite pertence; é o tipo de atalho que vira falha de autorização.

**Sair da família existe de propósito.** Sem isso, quem entrasse com o código errado ficaria preso (o convite é de uso único e o dono não pode sair). A ação tem confirmação em dois toques porque a saída não é reversível pelo próprio usuário — só com convite novo.

**7. PROBLEMA PRINCIPAL DO PASSO: o Cache Components não perdoa dado de requisição fora de `<Suspense>`**

Sintoma: tudo funcionava, mas o log do servidor e o console do navegador acusavam, em cada tela autenticada:

```
Error: Route "/onboarding": Next.js encountered the unstable value `Date.now()` while prerendering.
Error: Route "/familia": Next.js encountered uncached data during prerendering or a navigation.
  `fetch(...)` or `connection()` accessed outside of `<Suspense>` ...
```

Investigação, na ordem:

1. **O `Date.now()` não era nosso.** Nenhuma tela chama `Date.now()`. Procurei no `node_modules`: `@supabase/auth-js` usa `Date.now()` para conferir a validade do token. Ou seja, vinha do `getClaims()`. Isso explicava um detalhe estranho: `/login` (deslogado) não acusava nada, porque sem sessão o `getClaims()` retorna antes de validar.
2. **A doc embarcada do Next diz o que fazer.** O `AGENTS.md` manda ler `node_modules/next/dist/docs/` antes de escrever código — e a seção *"Random values and timestamps"* do guia de caching dá a receita exata: **`await connection()` antes da operação + um `<Suspense>` em volta**. Os dois, não um.
3. **Primeira tentativa: só `connection()`.** Resolveu o `Date.now()` e revelou o segundo erro (`uncached data outside <Suspense>`) — o experimento foi útil: provou que o problema era posicional.
4. **`loading.tsx` não basta.** O `src/app/loading.tsx` (que fazia o **build** passar desde o `P09`) cria um limite, mas **não** cobre o layout do próprio segmento nem o carregamento de dados da página. Tentei também `export const instant = false` nos dois níveis: **não resolve** — ele silencia só a validação de "navegação instantânea", não a de casca estática.
5. **A solução é o `<Suspense>` dentro do componente.** Confirmado por experimento controlado: com o limite explícito, o log ficou limpo.

O padrão adotado (e o motivo de cada pedaço):

```tsx
export default function FamilyPage() {
  return (
    <Suspense fallback={<FamilyPlaceholder />}>
      <FamilyContent />        {/* async: lê cookies + consulta o banco */}
    </Suspense>
  );
}
```

O mesmo padrão foi aplicado em `(app)/layout.tsx` (o cabeçalho é dado de requisição), nas três telas do app e nas duas telas públicas. Ganhos concretos, verificados no navegador:

- a **casca** (enquadramento, barra inferior) é pré-renderizada e aparece **na hora**;
- navegar entre telas do app troca só o miolo — o cabeçalho e a barra nem piscam;
- o build continua marcando todas as rotas como `◐` (Partial Prerender).

Com o limite dentro de cada página, o `(app)/loading.tsx` ficou redundante e foi **removido**. O `src/app/loading.tsx` da raiz **ficou**: é o que garante que uma página futura que esqueça o próprio limite não derrube o build.

**8. Dois problemas menores, ambos de configuração**

- **ESLint reclamando de parâmetro `_`.** A regra `@typescript-eslint/no-unused-vars` usa `after-used` por padrão: só acusa quando nenhum argumento posterior é usado. Ou seja, a convenção `_previousState` valia pela metade. Adicionado `argsIgnorePattern: "^_"` (e `varsIgnorePattern`, `caughtErrorsIgnorePattern`) — as Server Actions recebem `(previousState, formData)` **por contrato** do React, mesmo quando não usam os dois.
- **Tipos gerados obsoletos.** O `typecheck` falhou apontando para `.next/dev/types/validator.ts` referenciando `src/app/login/page.js`, que não existe mais desde a reorganização. Era resíduo de um `next dev` anterior à mudança de pastas. `rm -rf .next` + regenerar. **Lição:** depois de mover rotas, se o servidor de desenvolvimento já rodou, limpar `.next` antes de desconfiar do TypeScript.

**Validação executada**

```bash
npm run format && npm run lint && npm run typecheck   # limpos
npm test                                              # 33 testes unitários (5 arquivos)
npm run test:rls                                      # 15 testes de isolamento (Supabase local)
npm run build                                         # ✓ — todas as rotas como ◐ (Partial Prerender)
```

**Roteiro manual no navegador (fluxo completo, duas pessoas):**

| # | Ação | Resultado |
|---|---|---|
| 1 | Abrir `/` sem sessão | Redireciona para `/login` |
| 2 | Criar conta (Isabelle) | Vai para `/onboarding`, com saudação pelo nome |
| 3 | Criar família "Nossa casa" | Vai para `/`, cabeçalho com o nome da família |
| 4 | Alternar visão para "Família" | Título e texto mudam; botão marcado com `aria-pressed` |
| 5 | Gerar convite | Código `3TK-TZH6-QTQ` formatado, "válido até 08/11", já listado abaixo |
| 6 | Sair da conta | Vai para `/login` |
| 7 | Criar segunda conta (Vinicius) | Vai para `/onboarding` |
| 8 | Entrar com `3tk-tzh6-qtq` (minúsculas, com hífen) | Entra na "Nossa casa" — normalização funcionando ponta a ponta |
| 9 | Abrir `/familia` como Vinicius | 2 pessoas: Isabelle **Dono**, Vinicius **Membro**; convite consumido (uso único) |
| 10 | Abrir `/conta` como Vinicius | Cartão "Sair da família" presente (a dona **não** o vê — o banco recusaria) |
| 11 | Sair da família (confirmando) | Volta para `/onboarding` |

O log do servidor durante todo o roteiro: **nenhum erro**, e cada Server Action registrada com seu tempo (`setScopeAction` 4 ms, `createInviteAction` 129 ms, `joinFamilyAction` 132 ms, `leaveFamilyAction` 148 ms).

**Arquivos desta fase**

- `src/app/(auth)/layout.tsx`, `(auth)/signup/{actions.ts,page.tsx,signup-form.tsx}` (novos); `(auth)/login/page.tsx` (reescrito)
- `src/app/onboarding/{actions.ts,page.tsx,create-family-form.tsx,join-family-form.tsx}` (novos)
- `src/app/(app)/{layout.tsx,actions.ts}` (novos/reescritos); `(app)/page.tsx` (reescrito)
- `src/app/(app)/_components/{app-nav.tsx,scope-switch.tsx}` (novos)
- `src/app/(app)/familia/{page.tsx,_components/*}` e `conta/{page.tsx,_components/*}` (novos)
- `src/app/actions.ts`, `src/server/scope.ts`, `src/components/ui/skeleton.tsx` (novos)
- `src/server/session.ts` (`connection()` + comentário do porquê)
- `eslint.config.mjs` (convenção do `_`), `src/app/(app)/loading.tsx` (removido)

---

### P18 — Fatia 1, fase 4: os testes de isolamento entram no CI · 2026-10-09

**Objetivo da fase:** a regra número um do projeto — *"nenhum usuário lê dado de outro"* — deixar de depender de alguém lembrar de rodar `npm run test:rls` na mão.

**Entrega em uma frase:** todo push e todo pull request passam a rodar os 15 testes de isolamento contra um Supabase de verdade, **sem nenhum segredo configurado no GitHub**.

**1. O caminho escolhido (e os dois descartados)**

Até aqui o CI era hermético: nenhum banco, nenhum segredo — e era exatamente por isso que o teste mais importante do projeto ficava de fora.

| Opção | Veredito |
|---|---|
| Continuar fora do CI | Recusada: a regra mais importante do projeto merecia verificação automática |
| Apontar o CI para a **nuvem** com credenciais guardadas no GitHub | Recusada: guardaria acesso ao projeto real em mais um lugar e faria o CI **sujar** o ambiente de verdade a cada push |
| **Subir o Supabase dentro do runner** | Escolhida: o Docker já vem na imagem do GitHub Actions, não usa segredo nenhum e testa as migrations do zero |

O job novo, `isolation`:

```yaml
isolation:
  name: Isolamento entre usuários (RLS)
  runs-on: ubuntu-latest
  steps:
    # … checkout, Node 24, npm ci …
    - run: npx supabase start --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
    - run: npx supabase db reset --local
    - run: |
        API_URL="$(npx supabase status -o env | grep '^API_URL=' | cut -d'"' -f2)"
        PUBLISHABLE_KEY="$(npx supabase status -o env | grep '^PUBLISHABLE_KEY=' | cut -d'"' -f2)"
        SUPABASE_TEST_URL="$API_URL" SUPABASE_TEST_KEY="$PUBLISHABLE_KEY" npm run test:rls
```

Ele roda **em paralelo** com o `quality` — o resultado dos dois aparece junto, e o mais rápido não espera o mais lento.

**2. Detalhes que só apareceram olhando o CLI de perto**

- **Quais serviços pular.** `supabase start --help` lista os contêineres que dá para excluir: `gotrue, realtime, storage-api, imgproxy, kong, mailpit, postgrest, postgres-meta, studio, edge-runtime, logflare, vector, supavisor`. Ficaram **gotrue** (autenticação), **postgrest** (REST) e **kong** (o gateway por onde os dois são alcançados) — o teste se comporta como um usuário comum do app, então é tudo de que ele precisa. Cada serviço a menos é menos imagem para baixar e menos coisa para esperar ficar saudável.
- **A chave é lida, não escrita.** `supabase status -o env` imprime `CHAVE="valor"`, então o workflow extrai com `grep` + `cut`. A chave publicável local é fixa, mas deixá-la escrita no YAML criaria uma cópia para envelhecer.
- **`db reset --local`, com a flag.** Em outra máquina o projeto pode estar vinculado à nuvem; sem `--local` o comando poderia mirar o alvo errado. Como não existe `supabase/seed.sql`, ele avisa `no files matched pattern: supabase/seed.sql` e segue — **não é erro**.
- **Resetar do zero é parte do teste.** Aplicar as duas migrations em um banco vazio verifica as migrations em si, não só o que elas produzem na máquina de quem desenvolve.

**3. O job foi ensaiado inteiro antes de subir**

Descobrir erro de YAML no CI é caro (ciclo de feedback de minutos). Então rodei aqui, na mesma ordem do job:

```bash
npx supabase stop                                  # estado limpo, como o runner
npx supabase start --exclude <a mesma lista>       # lista aceita; API e chave publicadas
npx supabase db reset --local                      # as 2 migrations aplicadas do zero
API_URL=… PUBLISHABLE_KEY=… npm run test:rls       # 15 testes passando (716 ms)
```

Resultado: exatamente o esperado. A única diferença no CI é que o banco começa vazio (aqui ele reaproveita o volume entre execuções).

**4. Quatro textos que ficaram mentindo**

Quatro arquivos afirmavam que os testes de isolamento **não** rodam no CI (`vitest.integration.config.mts`, `vitest.config.mts`, `README.md` e `docs/DOMAIN.md`). Todos atualizados — documentação que descreve o comportamento antigo é pior do que documentação nenhuma, porque dá confiança errada.

**Arquivos desta fase**

- `.github/workflows/ci.yml` (job `isolation` + comentários do topo reescritos)
- `vitest.integration.config.mts`, `vitest.config.mts`, `README.md`, `docs/DOMAIN.md`

---

### P19 — Fatia 1, fase 5: limpeza, validação final e fechamento · 2026-10-09

**Objetivo da fase:** fechar a fatia sem ponta solta — código morto fora, tudo verificado de novo, decisões registradas.

**1. Dois arquivos órfãos que voltaram ao disco**

Ao retomar o trabalho, `git status` mostrou de volta dois arquivos removidos no `P17`:

- `src/app/login/actions.ts` — cópia velha, de quando o login morava em `src/app/login/`. Não cria rota (pasta sem `page.tsx` não é rota), mas é um sósia do arquivo vivo em `src/app/(auth)/login/`: a próxima pessoa a mexer no login pode editar o errado.
- `src/app/(app)/loading.tsx` — o próprio comentário dizia ser "o limite de `<Suspense>` das páginas deste grupo", o que deixou de ser verdade quando cada página passou a ter o seu.

**Lição registrada:** arquivo apagado pode ressuscitar se o editor o tinha aberto. Depois de mexer em estrutura de rotas, conferir `git status` **antes** de seguir.

**2. Código morto removido (e o critério)**

| O que saiu | Por quê |
|---|---|
| `getAuthenticatedUser()` e o tipo `AuthenticatedUser` (`src/server/auth.ts`) | Superado por `getSessionContext()`, que responde a mesma pergunta e mais (perfil e família). Dois caminhos para "quem está logado" divergem com o tempo — e o comentário de segurança que havia nele (por que `getClaims()` e não `getSession()`) já existe em `src/server/session.ts` |
| `src/lib/supabase/client.ts` (cliente de browser) | Nunca foi importado — e um cliente Supabase no navegador convida a furar a regra do projeto ("acesso a dados só em `src/server/`"). Se um dia fizer falta (realtime, por exemplo), a receita está no `P08`. Decisão registrada em `D14` |

O critério foi: sai o que **não é usado e** ou duplica um caminho existente, ou briga com uma regra documentada. `src/domain/money.ts`, por exemplo, também ainda não é chamado por nenhuma tela, mas é regra de negócio testada e prevista para a Fatia 2 — esse ficou.

**Validação executada (a bateria inteira, do zero)**

```bash
npm run format:check   # "All matched files use Prettier code style!"
npm run lint           # sem erros nem avisos
npm run typecheck      # next typegen + tsc, sem erros
npm test               # 33 testes unitários (5 arquivos)
npm run test:rls       # 15 testes de isolamento, contra o Supabase local
npm run build          # ✓ — todas as rotas ◐ (Partial Prerender)
```

O ensaio do job `isolation` (descrito no `P18`) foi refeito depois da limpeza, com o mesmo resultado: 15 testes passando em 716 ms.

**Arquivos desta fase**

- `src/server/auth.ts` (remoção de `getAuthenticatedUser`), `src/lib/supabase/client.ts` (removido)
- `src/app/login/actions.ts` e `src/app/(app)/loading.tsx` (órfãos removidos)
- `docs/BUILD_LOG.md` (este registro), `README.md` (estado e CI)

---

## Resumo da Fatia 0

**Critério do `ROADMAP.md`:** *"deploy no ar, login funciona, `npm test` roda"*.

| Critério | Situação |
|---|---|
| `npm test` roda | ✅ 6 testes passando, também no CI |
| Login funciona | ✅ código pronto e verificado em runtime (redireciona sem sessão, permite logar com usuário válido); **falta o teste com o usuário real**, que depende das credenciais do Supabase |
| Deploy no ar | ⏳ **pendente do usuário**: criar o projeto na Vercel e configurar as variáveis |

**Números:** 48 arquivos versionados · 10 decisões registradas · 15 passos documentados · 0 erros de lint/tipo/teste/build.

---

## Resumo da Fatia 1 — concluída (fases 1 a 5)

**Critério do `ROADMAP.md`:** *"as duas pessoas conseguem criar conta, formar a família e convidar uma à outra"* — **atendido e verificado no navegador com duas contas**.

| Fase | Situação |
|---|---|
| 1 — Banco: identidade e família | ✅ 5 tabelas, 10 policies, 6 funções (`create_household`, `accept_household_invite`, `leave_household`, …) + 15 testes de isolamento. Aplicada **local e na nuvem** |
| 2 — Servidor | ✅ contexto de sessão, acesso a dados, cadastro e mensagens de erro em pt-BR |
| 3 — Telas | ✅ login, cadastro, onboarding, shell do app, visão geral, família e conta |
| 4 — Testes no CI | ✅ job `isolation`: sobe um Supabase local no runner, aplica as migrations do zero e roda os 15 testes — sem segredo nenhum |
| 5 — Validação final | ✅ limpeza de código morto, bateria completa verde e registro fechado |

**Números:** 81 arquivos versionados · 15 decisões registradas · 19 passos documentados · 33 testes unitários + 15 de isolamento · 0 erros de lint, tipo, teste ou build.

**O que ainda não existe (e onde entra):** contas, cartões, categorias e a Folha do mês são a Fatia 2 em diante — a visão geral tem o lugar reservado para elas, e o domínio de dinheiro (`src/domain/money.ts`) já está pronto e testado desde a Fatia 0.

**Pendência única do projeto:** deploy na Vercel (adiado pelo usuário).


