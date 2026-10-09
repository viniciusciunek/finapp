# Instruções para o Copilot — Finanças do Casal

> Salvar este arquivo em `.github/copilot-instructions.md`. Os demais ficam em `docs/` (`PRODUCT.md`, `DOMAIN.md`, `ROADMAP.md`).

## Contexto
Sistema de finanças pessoais e da família para duas pessoas (Vinícius e Isabelle), substituindo um caderno e uma planilha. O coração do produto é a **Folha do mês** (fechamento mensal). Leia `docs/PRODUCT.md` para o produto, `docs/DOMAIN.md` para as regras e `docs/ROADMAP.md` para saber em que fatia estamos.

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui
- Supabase: Postgres, Auth e Row Level Security
- Zod para validação; date-fns para datas; Vitest para testes
- PWA, mobile-first; deploy na Vercel

## Idioma
- Código, nomes de tabelas, colunas, variáveis, commits e comentários técnicos em **inglês**.
- Textos visíveis ao usuário em **português (pt-BR)**.

## Regras que nunca se quebram
1. **Dinheiro em centavos inteiros** (`amount_cents`, `number`/`bigint`). Nunca `float`. Formatar para BRL só na camada de exibição (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
2. **Toda tabela tem RLS ativada.** Nenhuma tabela é criada sem policies e sem teste de isolamento entre usuários.
3. **Regras de negócio ficam em funções puras** em `src/domain/` (sem acesso a banco, sem React), com testes Vitest. Componentes e rotas apenas chamam essas funções.
4. **Schema só muda por migration** versionada em `supabase/migrations/`. Nunca editar o banco "na mão" sem migration.
5. **Status de item é calculado**, não armazenado digitado (ver `DOMAIN.md` §4.5).
6. **Compra no cartão não mexe no saldo de conta; pagamento de fatura mexe.**
7. Dados pessoais de um usuário nunca podem ser lidos por outro, nem por views, funções ou joins.
8. **Nada de teste no projeto de verdade.** O `.env.local` aponta para o Supabase **real**: um cadastro feito com o app aberto cria conta de verdade, e conta criada assim só sai pelo painel (apagar usuário exige a chave secreta). Por isso:
   - teste automatizado de banco roda com `npm run test:rls`, que só aceita banco descartável;
   - teste de fluxo no navegador roda com `npm run dev:local` (app apontando para o Supabase local);
   - se algo escapar, `npm run db:cleanup` encontra e apaga — e a conta nova precisa entrar na lista `TEST_EMAILS` de `scripts/cleanup-test-data.mjs`.

## Como trabalhar
- Trabalhe **uma fatia do `ROADMAP.md` por vez**, em passos pequenos. Antes de codar, diga em poucas linhas o plano e quais arquivos vai tocar.
- Se a tarefa tocar fatura, parcela, folha, empréstimo ou privacidade, releia a seção correspondente de `DOMAIN.md` e **escreva os testes primeiro** (ou junto).
- Se uma regra estiver ambígua ou faltando em `DOMAIN.md`, **pergunte** em vez de inventar; depois proponha a atualização do documento.
- Não adicione dependências sem justificar. Prefira o que já está no projeto.
- Não crie funcionalidades fora do escopo do `PRODUCT.md`.
- Formulários e telas **mobile-first**; lançar despesa deve ser rápido (poucos campos obrigatórios, valores padrão inteligentes).
- Trate estados de carregamento, erro e vazio em toda tela.
- Mensagens de erro ao usuário em português, claras e sem jargão.

## Padrões de código
- Validar toda entrada com Zod (cliente e servidor).
- Acesso ao banco em uma camada separada (`src/server/` ou `src/lib/db/`), nunca direto dentro de componentes de UI.
- Funções pequenas e nomes descritivos; evitar `any`.
- Commits no formato `tipo: descrição` (`feat`, `fix`, `test`, `refactor`, `docs`, `chore`).

## Definição de pronto de uma tarefa
- Compila sem erros de TypeScript e `npm run lint` passa.
- Testes novos e antigos passam (`npm test`).
- RLS verificada quando houver tabela ou consulta nova.
- O critério "Pronta quando" da fatia atual no `ROADMAP.md` continua verdadeiro.
- `DOMAIN.md`/`PRODUCT.md` atualizados se alguma regra mudou.
