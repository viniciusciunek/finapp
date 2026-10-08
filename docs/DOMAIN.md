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
- `profiles` — id (= auth user), name, email.
- `households` — id, name.
- `household_members` — household_id, user_id, role (`owner`|`member`).
- `user_settings` — user_id, payday_rule (padrão: `nth_business_day`, 5).

### Contas e cartões
- `accounts` — scope, owner_user_id/household_id, name, bank, type (`checking`|`savings`|`cash`), balance_cents, balance_as_of (para saldo informado).
- `credit_cards` — scope, owner_user_id/household_id, name, closing_day (1–31), due_day (1–31), limit_cents (nulo).

### Pessoas e categorias
- `people` — owner_user_id, name, relationship (Pai, Tio, Sogra...). Pessoas são **privadas** do usuário que as criou.
- `categories` — scope/dono, name.

### Lançamentos
- `transactions` — scope, dono, description, category_id, `total_cents`, `occurred_on`, `payment_method` (`pix`|`cash`|`debit`|`boleto`|`credit`), `account_id` (nulo se crédito), `card_id` (só crédito), `installments_count` (padrão 1), `on_behalf_of_person_id` (nulo = gasto próprio), notes.
- `card_installments` — transaction_id, number (1..n), amount_cents, statement_id. Só existe para `payment_method = 'credit'`.

### Faturas
- `statements` — card_id, `reference_month` (mês em que a fatura **fecha**), closing_date, due_date, `actual_cents` (nulo até o usuário informar), paid_cents, paid_at, paid_from_account_id, status (`open`|`closed`|`paid`|`partial`).
  - `calculated_cents` **não é coluna**: é derivado (soma de `card_installments.amount_cents` da fatura). Pode ser exposto em uma view.
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
- Divisão exata em centavos: `base = floor(total / n)`; o **resto** vai para a **primeira** parcela (a soma das parcelas sempre é igual ao total).
- Editar ou excluir o lançamento recalcula as parcelas ainda não pagas; parcelas em fatura **paga** não mudam sem confirmação explícita.

### 4.3 Fatura: calculado vs. real
- O sistema soma sempre as parcelas. O usuário pode informar `actual_cents` a qualquer momento (normalmente no fechamento).
- A interface mostra: calculado, real e **não lançado** (diferença), além do histórico de lançamentos que compõem o calculado.
- O que vale para pagar e para os totais é `effective_cents`.
- Pagamento parcial → status `partial`; pagamento integral → `paid`. `paid_cents` é editável.
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
- `balance_cents` + `balance_as_of` = saldo informado. Saldo exibido = informado + movimentos (`pix`/`cash`/`debit`/`boleto` e pagamentos de fatura, menos; recebimentos, mais) com data **posterior** a `balance_as_of`.
- "Ajustar saldo" cria um novo ponto informado (não apaga histórico).

## 5. Casos de teste obrigatórios (unitários, funções puras)

1. Compra no dia anterior ao fechamento, no dia do fechamento e no dia seguinte, com fechamento dia 31 e em fevereiro.
2. Parcelamento: 3.000,00 em 10x; 100,00 em 3x (centavos que não dividem exato: 33,34 + 33,33 + 33,33).
3. Parcelas atravessando virada de ano.
4. Fatura com `actual_cents` maior e menor que o calculado.
5. 5º dia útil de meses que começam em sábado ou domingo.
6. Total a pagar com switch ligado e desligado, e com pagador diferente.
7. Saldo da pessoa: parcelas futuras não vencidas não entram no saldo devido, mas entram no contratado.
8. RLS: usuário B não lê nada pessoal do usuário A.
