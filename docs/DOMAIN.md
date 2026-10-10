# DOMAIN.md — Modelo de dados e regras de negócio

> Fonte da verdade das regras. Se uma tarefa mexe em fatura, parcela, folha, empréstimo ou privacidade, **leia este arquivo antes** e escreva testes para as regras tocadas.
> Convenção: tabelas/colunas/código em **inglês**; textos da interface em **português (pt-BR)**.

## 1. Convenções gerais

- Dinheiro: `integer` em **centavos** (`amount_cents`). Nunca `float`/`decimal` no código.
- Moeda: somente BRL.
- Datas de calendário (`date`) sem fuso; instantes (`timestamptz`) para auditoria.
- Toda tabela tem `id (uuid)`, `created_at`, `updated_at`, `created_by`.
- Mês de referência é guardado como `date` no dia 1 (ex.: `2026-09-01`).
- Escopo: `scope in ('personal','household')`. Se `personal`, `owner_user_id` é obrigatório e `household_id` é nulo. Se `household`, `household_id` é obrigatório e `owner_user_id` é nulo.

## 2. Entidades

### Identidade e família
- `profiles` — id (= auth user), name, email. Criado automaticamente no cadastro (trigger `handle_new_user`), junto de `user_settings`.
- `households` — id, name. Criada **somente** pela função `create_household()` — nunca por `INSERT` direto.
- `household_members` — household_id, user_id, role (`owner`|`member`). **Uma família por usuário no MVP.** Vínculos só nascem por `create_household()`/`accept_household_invite()` e só somem por `leave_household()`.
- `user_settings` — user_id, payday_rule (padrão: `nth_business_day`) + payday_business_day (padrão: 5 = 5º dia útil). **Privada**: nem membro da família lê (§3.1).
- `household_invites` — household_id, `code` (10 caracteres do alfabeto sem ambíguos, único), role, expires_at (padrão: +30 dias), accepted_at, accepted_by. Convite **de uso único**.

### Contas e cartões (Fatia 2)
- `accounts` — scope, owner_user_id/household_id, name, bank (nulo para dinheiro em espécie), type (`checking`|`savings`|`cash`), balance_cents, balance_as_of.
  - As colunas de saldo existem desde a Fatia 2, mas ficam **nulas**: quem define a regra do saldo informado é a Fatia 8 (§4.9).
- `credit_cards` — scope, owner_user_id/household_id, name, closing_day (1–31), due_day (1–31), limit_cents (nulo).
- **Escopo:** `personal` exige `owner_user_id` e proíbe `household_id`; `household` exige o contrário. Garantido por CHECK na tabela — não existe linha sem dono nem linha ambígua com os dois.
- **Dono e escopo são imutáveis** depois de criados (trigger `forbid_ownership_change`). Sem isso, um membro poderia “puxar” para o pessoal dele uma conta que era da família — sumindo com ela para o outro sem apagar nada.
- `created_by` é **anulável** nestas tabelas (`on delete set null`), diferente das tabelas de identidade: são linhas que podem ser compartilhadas, e apagar a conta de quem as criou não pode levar junto a conta bancária da família. O ciclo de vida delas vem do dono (`owner_user_id`/`household_id`, ambos `on delete cascade`).

### Pessoas e categorias
- `people` — owner_user_id, name, relationship (Pai, Tio, Sogra...). Pessoas são **privadas** do usuário que as criou.
- `categories` — scope/dono, name.

### Lançamentos
- `transactions` — scope, dono, description, category_id, `total_cents`, `occurred_on`, `payment_method` (`pix`|`cash`|`debit`|`boleto`|`credit`), `account_id` (nulo se crédito), `card_id` (só crédito), `installments_count` (padrão 1), `on_behalf_of_person_id` (nulo = gasto próprio), notes.
  - **Pendência para a Fatia 3:** decidir o `ON DELETE` de `account_id`/`card_id`. Apagar uma conta que já tem lançamento não pode apagar histórico — o mais provável é `restrict` (bloquear) com a interface explicando o motivo.
- `card_installments` — scope, dono, transaction_id, number (1..n), amount_cents, statement_id. Só existe para `payment_method = 'credit'` (garantido por trigger no banco). Apagar o lançamento apaga as parcelas (cascade); fatura com parcela não é apagada (restrict).

### Faturas
- `statements` — scope, dono, card_id, `reference_month` (mês em que a fatura **fecha**, texto `AAAA-MM`), closing_date, due_date, `actual_cents` (nulo até o usuário informar), paid_cents, paid_at, paid_from_account_id, status (`open`|`closed`|`paid`|`partial`). Uma fatura por cartão e mês; criada automaticamente quando um lançamento no crédito precisar dela (§4.1).
  - `calculated_cents` **não é coluna**: é derivado (soma de `card_installments.amount_cents` da fatura), calculado na leitura — nunca desencontra das parcelas. Pode ser exposto em uma view.
  - `effective_cents = coalesce(actual_cents, calculated_cents)`.
  - `unlogged_cents = actual_cents − calculated_cents` (apenas se `actual_cents` não for nulo).

### Folha do mês
- `month_sheets` — scope, dono, `reference_month`, `planned_close_date`, status (`open`|`closed`). Única por (dono/escopo, mês).
- `recurring_templates` — scope, dono, name, category_id, default_amount_cents, due_day, `payer_user_id` (para itens da família), frequency (`monthly`|`yearly`), yearly_month (se anual), active.
- `sheet_items` — sheet_id, `source` (`template`|`statement`|`one_off`), template_id (nulo), statement_id (nulo), name, `expected_cents`, `actual_cents` (nulo), due_date, `payer_user_id`, `paid_cents`, `paid_at`, `paid_from_account_id` (nulo), status (calculado — ver §4.5), carried_from_item_id (nulo).

### Empréstimos / terceiros
- `person_ledger_entries` — person_id, kind (`charge`|`payment`), amount_cents, entry_date, source_transaction_id (nulo), source_installment_id (nulo), received_into_account_id (só `payment`), notes.
  - `charge`: algo que a pessoa passou a dever (parcela de cartão que venceu na fatura, ou parcela combinada de empréstimo em dinheiro).
  - `payment`: recebimento.

### Reserva
- `savings_pots` — household_id, name.
- `pot_entries` — pot_id, kind (`deposit`|`withdrawal`|`yield`), amount_cents, entry_date, made_by_user_id, notes. Saldo = depósitos + rendimentos − retiradas.

## 3. Privacidade (RLS no Postgres/Supabase)

- Toda tabela tem **Row Level Security ativada**. Sem exceção.
- `scope = 'personal'`: só o `owner_user_id` lê e escreve.
- `scope = 'household'`: qualquer membro da família lê e escreve.
- `people` e `person_ledger_entries`: só o dono.
- `savings_pots`/`pot_entries`: membros da família.
- Teste obrigatório: um usuário **não** consegue ler nem inferir dados pessoais do outro por nenhuma tabela, view ou função.

### 3.1 Regras por tabela de identidade (Fatia 1)
- `profiles`: o dono lê e edita o próprio; membros da **mesma família** leem o nome e o e-mail uns dos outros — é o que permite mostrar quem é quem na família. Ninguém edita o perfil alheio.
- `user_settings`: **só o dono**. Nem o cônjuge lê.
- `households` / `household_members` / `household_invites`: leitura apenas para membros da família. Qualquer membro pode gerar e cancelar convite; **renomear a família, só o `owner`**. Excluir a família não é funcionalidade (não há policy de `DELETE`) — evita perda acidental de dados.
- **Privilégios mínimos:** além do RLS, os `grant` de tabela são só os necessários. Em particular `household_members` **não tem** `INSERT`/`UPDATE`/`DELETE` liberados: entrar numa família só é possível pelas funções abaixo — nem sabendo o id da família alguém se adiciona por `INSERT` direto.

### 3.2 Funções que atravessam o RLS (SECURITY DEFINER)
São necessárias porque uma policy em `household_members` que consultasse a própria tabela entraria em recursão infinita. Todas usam `set search_path = ''` (obrigando nomes qualificados) e têm `EXECUTE` revogado de `anon`/`public`.
- `is_household_member(hid)`, `is_household_owner(hid)`, `shares_household_with(user_id)` — devolvem apenas `boolean`; são a base das policies.
- `create_household(name)` — cria a família e o vínculo de dono na mesma transação; recusa quem já tem família.
- `accept_household_invite(code)` — normaliza o código (tira hífen/espaço, sobe para maiúsculas), valida existência, uso e validade, cria o vínculo e marca o convite como usado. Trava a linha (`for update`) para dois aceites simultâneos do mesmo código não criarem dois vínculos.
- `leave_household()` — remove o **próprio** vínculo. O `owner` não pode sair (a família ficaria sem quem a administre).

### 3.3 Regras por tabela de contas e cartões (Fatia 2)
- `accounts` e `credit_cards`: lê e escreve **o dono** (escopo `personal`) ou **qualquer membro** da família (escopo `household`).
- Cada ação tem a sua policy (select/insert/update/delete): escopo novo não pode nascer “pela metade”, com uma ação esquecida.
- No `INSERT`, `created_by` precisa ser quem está inserindo — ninguém cria linha em nome de outro.
- Teste obrigatório em `src/integration/accounts-isolation.integration.test.ts`, **com controle positivo**: o membro da família vê o que é compartilhado e continua sem ver o que é pessoal do outro. Só o lado negativo passaria num banco que negasse tudo.

## 4. Regras de negócio

### 4.1 Qual fatura recebe uma compra no crédito
- `reference_month` da fatura = mês em que ela **fecha**. A fatura de setembro fecha em setembro e vence em outubro; é a que o usuário paga no início de outubro.
- Compra feita em `d` do mês `m`:
  - se `d <= closing_day` → fatura com `reference_month = m`;
  - senão → fatura com `reference_month = m + 1`.
- O tratamento do **próprio dia de fechamento** pode variar por banco: manter isolado em uma função pura (`resolveStatementMonth`) e validar com uma compra real de cada cartão.
- Se a fatura ainda não existir, criar automaticamente (`closing_date` e `due_date` calculados a partir dos dias do cartão; dia 31 em mês curto → último dia do mês).

### 4.2 Parcelamento
- Compra de `total_cents` em `n` parcelas gera `n` registros em `card_installments`, a parcela `k` na fatura de `reference_month + (k − 1)` meses.
- Divisão exata em centavos: `base = floor(total / n)`; o **resto** vai para a **primeira** parcela (a soma das parcelas sempre é igual ao total). Cada parcela tem ao menos 1 centavo: a compra não se divide em mais parcelas do que centavos.
- Editar ou excluir o lançamento recalcula as parcelas ainda não pagas; parcelas em fatura **paga** não mudam sem confirmação explícita.

### 4.3 Fatura: calculado vs. real
- O sistema soma sempre as parcelas. O usuário pode informar `actual_cents` a qualquer momento (normalmente no fechamento).
- A interface mostra: calculado, real e **não lançado** (diferença), além do histórico de lançamentos que compõem o calculado.
- O que vale para pagar e para os totais é `effective_cents`.
- Pagamento parcial → status `partial`; pagamento integral → `paid`. `paid_cents` é editável.
- Fechar por **data** não muda o registro: a tela deriva "aberta/fechada" de `closing_date` (função pura `isStatementOpen`); o `status` gravado acompanha o **pagamento** (`open`/`partial`/`paid`; `closed` existe no CHECK para o futuro, mas o app ainda não o grava).
- Se o saldo de contas estiver ativo, pagar fatura debita `paid_cents` da conta escolhida. **Compra no cartão nunca mexe no saldo de conta; o pagamento da fatura mexe.** Isso evita contar a despesa duas vezes.

### 4.4 Folha do mês
- Gerar a folha de `reference_month = M` (por escopo):
  1. um `sheet_item` para cada `recurring_template` ativo aplicável ao mês, com `expected_cents` = valor real do mesmo template no mês anterior, ou `default_amount_cents` se não houver;
  2. um `sheet_item` (`source = 'statement'`) para cada cartão do escopo, apontando para a fatura com `reference_month = M` (criando-a se necessário), com `expected_cents = calculated_cents`;
  3. itens pontuais adicionados manualmente.
- `planned_close_date` = **5º dia útil do mês seguinte a M** (configurável em `user_settings`). Calcular dias úteis ignorando sábado e domingo; feriados são ajuste manual no MVP.
- Itens de fatura mantêm o valor sincronizado com `effective_cents` da fatura (a fonte é a fatura, não o item).
- **Fechar a folha:** exige que todo item esteja `paid` ou explicitamente levado para o mês seguinte (`carried`). Depois de fechada, a folha fica somente leitura; reabrir exige confirmação.
- Itens levados criam um item novo na folha do próximo mês com `carried_from_item_id`.

### 4.5 Status de item
- `paid`: `paid_cents >= effective` (onde `effective = coalesce(actual_cents, expected_cents)`).
- `partial`: `0 < paid_cents < effective`.
- `overdue`: não `paid` e `due_date < hoje`.
- `pending`: caso contrário.
- Status é **calculado**, não digitado.

### 4.6 Totais e o switch da família
- **Total a pagar pelo usuário U** na folha pessoal = soma de `effective` dos itens pessoais de U **+**, se o switch estiver ligado, soma de `effective` dos itens da família cujo `payer_user_id = U`.
- Mostrar sempre: **total**, **já pago**, **falta pagar**.
- A visão da família (sem switch) lista todos os itens da família com o pagador de cada um. Itens da família com pagador diferente de U **não** entram no total de U.
- Não existe rateio percentual: o modelo é "quem paga".

### 4.7 Empréstimos a terceiros
- **Gasto no cartão para terceiro** (`on_behalf_of_person_id` preenchido, `payment_method = 'credit'`): cada `card_installment` gera um `charge` para a pessoa, com `entry_date` = `due_date` da fatura onde a parcela caiu (ou, mais simples no MVP, a data da fatura).
- **Empréstimo em dinheiro/Pix** com `installments_count > 1`: gera `charge`s mensais a partir da data do empréstimo (cronograma de pagamento combinado). Com 1 parcela, gera um único `charge` na data do empréstimo.
- **Recebimento** = `payment` na conta corrente da pessoa, com `received_into_account_id` obrigatório quando houver saldo de contas.
- **Saldo da pessoa** = soma(`charge` com `entry_date <= hoje`) − soma(`payment`). Também mostrar o **saldo contratado** (total ainda não vencido).
- **Cruzamento com a fatura:** dentro de um item de fatura, mostrar quanto é de terceiros (por pessoa) e se o `charge` correspondente já foi quitado. Não perguntar nada ao usuário no momento do recebimento.
- **Retroativo:** permitido; a geração de `charge`s para datas passadas funciona igual. Não é prioridade na interface.

### 4.8 Reserva
- Aporte da Isabelle (a "sobra" que ela envia) é um `deposit` com `made_by_user_id` dela.
- Sem rendimento automático; `yield` é lançado à mão.

### 4.9 Saldo de contas (opcional)
- **As colunas `balance_cents`/`balance_as_of` já existem em `accounts` desde a Fatia 2**, mas ficam nulas e nenhuma tela as mostra: a regra abaixo é da Fatia 8.
- `balance_cents` + `balance_as_of` = saldo informado. Saldo exibido = informado + movimentos (`pix`/`cash`/`debit`/`boleto` e pagamentos de fatura, menos; recebimentos, mais) com data **posterior** a `balance_as_of`.
- "Ajustar saldo" cria um novo ponto informado (não apaga histórico).

### 4.10 Família, convite e entrada na família (Fatia 1)
- **Cadastro:** qualquer pessoa cria conta (nome, e-mail, senha). O `profiles` e o `user_settings` nascem junto com a conta. **Sem família, o usuário não vê absolutamente nada** — as consultas retornam vazio por RLS, não por filtro da interface.
- **Criar família:** quem cria vira `owner`. Uma família por usuário no MVP; tentar criar a segunda é recusado com erro.
- **Convite por código:** qualquer membro gera um código de 10 caracteres (alfabeto sem `I`, `L`, `O`, `0` e `1`, que se confundem ao digitar). Vale **30 dias** e serve **uma única vez**. Quem entrega o código é o próprio membro (WhatsApp, etc.) — o sistema **não envia e-mail**.
- **Aceitar convite:** é preciso estar autenticado. O código pode ser digitado com ou sem hífen, em maiúsculas ou minúsculas. Entrar na família é **sempre** pelo código: não existe "adicionar pelo e-mail" nem entrada automática.
- **Sair:** o membro comum pode sair quando quiser; o `owner` não (a família ficaria sem quem a administre). Um convite já usado não pode ser reaproveitado.
- **Visão pessoal × família:** é preferência de navegação do usuário (guardada em cookie, não é dado de negócio). A visão pessoal mostra o que é do usuário; a da família, o que é compartilhado.

## 5. Casos de teste obrigatórios

> Os itens 1–7 são funções puras (Vitest, `npm test`). Os itens 8–9 existem como testes de verdade no repositório e cobrem o isolamento entre usuários — rodam também no CI, contra um Supabase local que sobe dentro do próprio runner.

1. Compra no dia anterior ao fechamento, no dia do fechamento e no dia seguinte, com fechamento dia 31 e em fevereiro.
2. Parcelamento: 3.000,00 em 10x; 100,00 em 3x (centavos que não dividem exato: 33,34 + 33,33 + 33,33).
3. Parcelas atravessando virada de ano.
4. Fatura com `actual_cents` maior e menor que o calculado.
5. 5º dia útil de meses que começam em sábado ou domingo.
6. Total a pagar com switch ligado e desligado, e com pagador diferente.
7. Saldo da pessoa: parcelas futuras não vencidas não entram no saldo devido, mas entram no contratado.
8. **RLS — implementado** em `src/integration/rls-isolation.integration.test.ts` (`npm run test:rls`), com controles positivos para não passar por engano: o usuário B não lê família, membros, convites, perfil nem preferências de A; não consegue entrar na família por `INSERT` direto nem com código inventado; não altera dados de A. Depois de entrar com o código, continua **sem** ler as preferências de A e sem poder renomear a família.
9. **Código de convite — implementado** em `src/domain/invite-code.test.ts`: normalização (hífen, espaço, maiúsculas), rejeição dos caracteres ambíguos, formato de exibição `ABC-DEFG-HJK` e o ciclo gerar → exibir → normalizar → validar.
