-- Preenche faturas e parcelas dos lançamentos no crédito que já existiam
-- (Fatia 4, fase 3/5)
--
-- Até a fase 1 desta fatia, uma compra no crédito era só uma linha em
-- `transactions`: sem fatura, sem parcela. A partir da fase 3, todo lançamento
-- no crédito nasce com as duas coisas — e este passo leva os lançamentos que
-- já existiam para o mesmo desenho. Sem ele, a tela da fatura (fase 5) não
-- mostraria as compras reais já feitas.
--
-- A regra do mês replica `resolveStatementMonth` (§4.1): compra até o dia do
-- fechamento (inclusive) fica na fatura do mês; depois, na seguinte — com dia
-- 31 valendo o último dia do mês curto. A divisão replica `splitInstallments`
-- (§4.2): `base = floor(total/n)`, resto na primeira parcela. Se algum cartão
-- tratar o dia do fechamento diferente (a validação prevista no §4.1), aquele
-- ajuste será na função do app; este passo é o retrato da regra em vigor hoje.
--
-- Só entram lançamentos sem parcela nenhuma (`not exists`), então rodar de
-- novo é inofensivo.

with credit_transactions as (
  select
    t.id,
    t.scope,
    t.owner_user_id,
    t.household_id,
    t.created_by,
    t.card_id,
    t.total_cents,
    t.installments_count,
    c.closing_day,
    c.due_day,
    case
      when extract(day from t.occurred_on) <= least(
        c.closing_day,
        extract(day from (date_trunc('month', t.occurred_on) + interval '1 month - 1 day'))::int
      )
      then date_trunc('month', t.occurred_on)::date
      else (date_trunc('month', t.occurred_on) + interval '1 month')::date
    end as first_month
  from public.transactions t
  join public.credit_cards c on c.id = t.card_id
  where t.payment_method = 'credit'
    and not exists (
      select 1
      from public.card_installments ci
      where ci.transaction_id = t.id
    )
),
month_rows as (
  select distinct on (ct.card_id, ms.month_start)
    ct.scope,
    ct.owner_user_id,
    ct.household_id,
    ct.created_by,
    ct.card_id,
    ct.closing_day,
    ct.due_day,
    ms.month_start
  from credit_transactions ct
  cross join lateral generate_series(1, ct.installments_count) as g(number)
  cross join lateral (
    select (ct.first_month + make_interval(months => g.number - 1))::date as month_start
  ) as ms
  order by ct.card_id, ms.month_start
)
insert into public.statements (
  scope,
  owner_user_id,
  household_id,
  card_id,
  reference_month,
  closing_date,
  due_date,
  created_by
)
select
  scope,
  owner_user_id,
  household_id,
  card_id,
  to_char(month_start, 'YYYY-MM'),
  month_start + (
    least(
      closing_day,
      extract(day from month_start + interval '1 month - 1 day')::int
    ) - 1
  ),
  (month_start + interval '1 month')::date + (
    least(
      due_day,
      extract(day from (month_start + interval '1 month') + interval '1 month - 1 day')::int
    ) - 1
  ),
  created_by
from month_rows
on conflict (card_id, reference_month) do nothing;

with credit_transactions as (
  select
    t.id,
    t.scope,
    t.owner_user_id,
    t.household_id,
    t.created_by,
    t.card_id,
    t.total_cents,
    t.installments_count,
    c.closing_day,
    case
      when extract(day from t.occurred_on) <= least(
        c.closing_day,
        extract(day from (date_trunc('month', t.occurred_on) + interval '1 month - 1 day'))::int
      )
      then date_trunc('month', t.occurred_on)::date
      else (date_trunc('month', t.occurred_on) + interval '1 month')::date
    end as first_month
  from public.transactions t
  join public.credit_cards c on c.id = t.card_id
  where t.payment_method = 'credit'
    and not exists (
      select 1
      from public.card_installments ci
      where ci.transaction_id = t.id
    )
),
installment_plan as (
  select
    ct.scope,
    ct.owner_user_id,
    ct.household_id,
    ct.created_by,
    ct.id as transaction_id,
    ct.card_id,
    g.number,
    (ct.first_month + make_interval(months => g.number - 1))::date as month_start,
    (ct.total_cents / ct.installments_count)
      + case
        when g.number = 1
        then ct.total_cents - (ct.total_cents / ct.installments_count) * ct.installments_count
        else 0
      end as amount_cents
  from credit_transactions ct
  cross join lateral generate_series(1, ct.installments_count) as g(number)
)
insert into public.card_installments (
  scope,
  owner_user_id,
  household_id,
  created_by,
  transaction_id,
  statement_id,
  number,
  amount_cents
)
select
  p.scope,
  p.owner_user_id,
  p.household_id,
  p.created_by,
  p.transaction_id,
  s.id,
  p.number,
  p.amount_cents
from installment_plan p
join public.statements s
  on s.card_id = p.card_id
  and s.reference_month = to_char(p.month_start, 'YYYY-MM');
