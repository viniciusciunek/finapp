-- Faturas e parcelas de cartão (Fatia 4, fase 1/5)
--
-- Mesmo molde das tabelas anteriores (20261009150000): CHECK de escopo, uma
-- policy por ação, trigger que proíbe mudar dono/escopo e grants mínimos.
--
-- Decisões desta migration (`DOMAIN.md` §2 "Faturas" e §4):
--   * `calculated_cents` NÃO é coluna: é a soma de `card_installments` feita na
--     leitura. Guardar o número criaria um segundo valor para desencontrar das
--     parcelas — e é exatamente isso que o §4.3 proíbe.
--   * `reference_month` como texto 'AAAA-MM': é o formato que o app inteiro já
--     usa (`src/domain/month.ts`) e evita conversão de data com fuso. O CHECK
--     garante o formato e o mês de 01 a 12.
--   * `card_installments.transaction_id` com `on delete cascade`: a parcela é
--     parte do lançamento (editar/excluir recalcula — §4.2). `statement_id` e
--     `statements.card_id` com `restrict`: fatura com parcela — e cartão com
--     fatura — não são apagados por engano, mesmo espírito da D22.
--   * Uma fatura por cartão e mês (`unique (card_id, reference_month)`); uma
--     parcela por número dentro do lançamento (`unique (transaction_id, number)`).
--   * Asserts próprios (o RLS não cobre FK — lição da D25): o cartão e a conta
--     de pagamento da fatura, bem como o lançamento e a fatura da parcela,
--     precisam ser do mesmo escopo. Parcela só existe para lançamento no
--     crédito, e a fatura da parcela é a do mesmo cartão do lançamento.

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  card_id uuid not null references public.credit_cards (id) on delete restrict,
  reference_month text not null check (
    reference_month ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  closing_date date not null,
  due_date date not null,
  actual_cents integer check (actual_cents is null or actual_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  paid_at timestamptz,
  paid_from_account_id uuid references public.accounts (id) on delete restrict,
  status text not null default 'open' check (
    status in ('open', 'closed', 'paid', 'partial')
  ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint statements_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  ),
  constraint statements_card_month_unique unique (card_id, reference_month)
);

comment on table public.statements is
  'Faturas de cartão, uma por cartão e mês de fechamento (DOMAIN.md §4.1). O calculado não é coluna: é a soma das parcelas na leitura; o que vale para pagar é coalesce(actual_cents, soma) — §4.3.';

comment on column public.statements.reference_month is
  'Mês em que a fatura FECHA, texto AAAA-MM (a de setembro fecha em setembro e vence em outubro).';

comment on column public.statements.status is
  'open = aberta; closed = fechada; partial = pagamento parcial; paid = paga. Calculado pela camada de aplicação (§4.3).';

create index statements_personal_month_idx
  on public.statements (owner_user_id, reference_month desc)
  where scope = 'personal';

create index statements_household_month_idx
  on public.statements (household_id, reference_month desc)
  where scope = 'household';

create table public.card_installments (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  statement_id uuid not null references public.statements (id) on delete restrict,
  number integer not null check (number >= 1),
  amount_cents integer not null check (amount_cents > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_installments_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  ),
  constraint card_installments_transaction_number_unique
    unique (transaction_id, number)
);

comment on table public.card_installments is
  'Parcelas de compra no crédito: cada parcela pertence a um lançamento e a uma fatura (DOMAIN.md §4.2). Só existe para payment_method = credit — garantido por trigger.';

create index card_installments_statement_idx
  on public.card_installments (statement_id);

-- ---------------------------------------------------------------------------
-- Regras que não podem depender do app
-- ---------------------------------------------------------------------------

create trigger statements_forbid_ownership_change
  before update on public.statements
  for each row execute function public.forbid_ownership_change();

create trigger card_installments_forbid_ownership_change
  before update on public.card_installments
  for each row execute function public.forbid_ownership_change();

create trigger statements_set_updated_at
  before update on public.statements
  for each row execute function public.set_updated_at();

create trigger card_installments_set_updated_at
  before update on public.card_installments
  for each row execute function public.set_updated_at();

-- O RLS não cobre a chave estrangeira (lição da D25): sem estas funções daria
-- para criar fatura apontando para o cartão de outra pessoa, ou parcela ligada
-- a lançamento/fatura alheios — bastaria conhecer o id.
create or replace function public.assert_statement_references()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  select exists (
    select 1
    from public.credit_cards c
    where c.id = new.card_id
      and c.scope = new.scope
      and c.owner_user_id is not distinct from new.owner_user_id
      and c.household_id is not distinct from new.household_id
  ) into ok;

  if not ok then
    raise exception 'O cartão da fatura não é deste escopo.'
      using errcode = '22023';
  end if;

  if new.paid_from_account_id is not null then
    select exists (
      select 1
      from public.accounts a
      where a.id = new.paid_from_account_id
        and a.scope = new.scope
        and a.owner_user_id is not distinct from new.owner_user_id
        and a.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'A conta de pagamento não é deste escopo.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger statements_assert_references
  before insert or update on public.statements
  for each row execute function public.assert_statement_references();

create or replace function public.assert_installment_references()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  select exists (
    select 1
    from public.transactions t
    where t.id = new.transaction_id
      and t.scope = new.scope
      and t.owner_user_id is not distinct from new.owner_user_id
      and t.household_id is not distinct from new.household_id
  ) into ok;

  if not ok then
    raise exception 'O lançamento da parcela não é deste escopo.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.transactions t
    where t.id = new.transaction_id
      and t.payment_method = 'credit'
  ) into ok;

  if not ok then
    raise exception 'Parcela só existe para lançamento no crédito.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.statements s
    where s.id = new.statement_id
      and s.scope = new.scope
      and s.owner_user_id is not distinct from new.owner_user_id
      and s.household_id is not distinct from new.household_id
  ) into ok;

  if not ok then
    raise exception 'A fatura da parcela não é deste escopo.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.transactions t
    join public.statements s on s.id = new.statement_id
    where t.id = new.transaction_id
      and t.card_id = s.card_id
  ) into ok;

  if not ok then
    raise exception 'A parcela liga um lançamento à fatura de outro cartão.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger card_installments_assert_references
  before insert or update on public.card_installments
  for each row execute function public.assert_installment_references();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.statements enable row level security;
alter table public.card_installments enable row level security;

create policy statements_select_own_or_household
  on public.statements for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy statements_insert_own_or_household
  on public.statements for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy statements_update_own_or_household
  on public.statements for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy statements_delete_own_or_household
  on public.statements for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy card_installments_select_own_or_household
  on public.card_installments for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy card_installments_insert_own_or_household
  on public.card_installments for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy card_installments_update_own_or_household
  on public.card_installments for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy card_installments_delete_own_or_household
  on public.card_installments for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

revoke all on public.statements from anon, authenticated;
revoke all on public.card_installments from anon, authenticated;

grant select, insert, update, delete on public.statements to authenticated;
grant select, insert, update, delete on public.card_installments to authenticated;
