# BUILD_LOG.md — Diário de construção

> **O que é este arquivo:** registro cronológico e detalhado de tudo que foi feito no projeto — comandos executados, arquivos criados/editados, o **porquê** de cada decisão e como cada problema foi resolvido.
> **Como ler:** o topo mostra **onde estamos agora**. Abaixo, o histórico passo a passo (`P00`, `P01`, ...) em ordem cronológica e o registro de decisões.
> **Regra de manutenção:** todo passo relevante (comando, arquivo criado/editado, decisão, problema/solução) vira uma entrada `Pxx` aqui **antes ou junto** da execução. O status no topo é atualizado a cada passo concluído.

---

## Status atual

- **Fatia em andamento:** **0 — Fundação** (`docs/ROADMAP.md`)
- **Último passo concluído:** `P12` — `README.md` escrito (setup, comandos, estrutura, convenções, problemas conhecidos)
- **Próximo passo:** `P13` — Validação final da Fatia 0 + commit inicial
- **Pendências manuais (usuário):**
  - [ ] Informar a URL do repositório GitHub (remote `origin`) — ainda não configurado localmente
  - [ ] Preencher `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.local`
  - [ ] Rodar `npx supabase link --project-ref <ref>` (pede a senha do banco — segredo, só o usuário digita)
  - [ ] Criar um usuário de teste no dashboard do Supabase (Auth → Users) para validar o login
  - [ ] Criar o projeto na Vercel e configurar as variáveis de ambiente (Fase E)

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
| D9 | **Toda leitura de sessão/cookies fica atrás de um limite `<Suspense>`** (no caso das rotas atuais, via `loading.tsx`) | Exigência do Cache Components do Next 16: ler `cookies()` fora de um limite `<Suspense>` **quebra o build**. Além disso o shell estático da página carrega instantâneo e só o conteúdo privado espera a requisição | `instant = false` (testado: NÃO resolve o erro de build, só silencia a validação); desligar `cacheComponents` (briga com o padrão do framework) |

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


