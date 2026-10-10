-- Folhas do mês, modelos recorrentes e itens (Fatia 5, fase 1/8)
--
-- Mesmo molde das tabelas anteriores: escopo com CHECK, uma policy por ação,
-- forbid_ownership_change, set_updated_at, asserts próprios (o RLS não cobre
-- FK — lição da D25) e grants mínimos.
--
-- Decisões desta migration (`DOMAIN.md` §2 "Folha do mês" e §4.4):
--   * `month_sheets`: uma por escopo e mês (índices únicos parciais, como as
--     categorias). `planned_close_date` é **congelada** na criação — na folha
--     da família, vale para os dois membros (pergunta respondida em 2026-10-10).
--   * `recurring_templates`: nome único por escopo; anual exige `yearly_month`.
--     O uso normal **desativa** (`active = false`), não apaga; o FK
--     `on delete set null` existe só para não travar uma exclusão direta, e o
--     item guarda o nome como retrato.
--   * `sheet_items`: `source` com CHECK de referências (fatura exige
--     `statement_id`; template pode ficar sem `template_id` depois de o modelo
--     ser apagado). Únicos por (folha, template) e (folha, fatura) — é o que
--     sustenta a geração idempotente. `carried_from_item_id` liga a cópia
--     "levada" ao item de origem.
--   * Pagador: precisa ser **membro da família** (trigger); pessoal não tem
--     pagador (CHECK). No banco pode ficar nulo numa linha de família (ex.:
--     conta de membro apagada); o app exige no cadastro e na geração.

create table public.month_sheets (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  reference_month text not null check (
    reference_month ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  planned_close_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint month_sheets_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  )
);

comment on table public.month_sheets is
  'Folha do mês por escopo (DOMAIN.md §4.4) — a página do caderno. planned_close_date é congelada na criação; fechada (status = closed) vira somente leitura na tela.';

create unique index month_sheets_personal_month_unique
  on public.month_sheets (owner_user_id, reference_month)
  where scope = 'personal';

create unique index month_sheets_household_month_unique
  on public.month_sheets (household_id, reference_month)
  where scope = 'household';

create table public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  category_id uuid references public.categories (id) on delete set null,
  default_amount_cents integer not null check (default_amount_cents > 0),
  due_day integer not null check (due_day between 1 and 31),
  payer_user_id uuid references auth.users (id) on delete set null,
  frequency text not null default 'monthly' check (
    frequency in ('monthly', 'yearly')
  ),
  yearly_month integer check (yearly_month between 1 and 12),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_templates_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  ),
  constraint recurring_templates_yearly_month check (
    (frequency = 'monthly' and yearly_month is null)
    or (frequency = 'yearly' and yearly_month is not null)
  ),
  constraint recurring_templates_personal_payer check (
    scope = 'household' or payer_user_id is null
  )
);

comment on table public.recurring_templates is
  'Modelos recorrentes — água, luz, internet, condomínio, mensalidade (DOMAIN.md §4.4). Não se apaga no uso normal: desativa com active = false; a folha de cada mês guarda o retrato.';

create unique index recurring_templates_personal_name_unique
  on public.recurring_templates (owner_user_id, lower(btrim(name)))
  where scope = 'personal';

create unique index recurring_templates_household_name_unique
  on public.recurring_templates (household_id, lower(btrim(name)))
  where scope = 'household';

create table public.sheet_items (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.month_sheets (id) on delete cascade,
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  source text not null check (source in ('template', 'statement', 'one_off')),
  template_id uuid references public.recurring_templates (id) on delete set null,
  statement_id uuid references public.statements (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  expected_cents integer not null check (expected_cents >= 0),
  actual_cents integer check (actual_cents is null or actual_cents >= 0),
  due_date date,
  payer_user_id uuid references auth.users (id) on delete set null,
  paid_cents integer not null default 0 check (paid_cents >= 0),
  paid_at timestamptz,
  paid_from_account_id uuid references public.accounts (id) on delete restrict,
  carried_from_item_id uuid references public.sheet_items (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sheet_items_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  ),
  -- Referências por tipo. `template` aceita template_id nulo de propósito:
  -- apagar um modelo deixa o histórico como retrato (o nome fica). `statement`
  -- exige o vínculo — é a fonte do valor (§4.4).
  constraint sheet_items_source_refs check (
    (source = 'statement' and statement_id is not null and template_id is null)
    or (source = 'template' and statement_id is null)
    or (source = 'one_off' and template_id is null and statement_id is null)
  ),
  -- A geração idempotente depende destes dois: o top-up não duplica.
  constraint sheet_items_sheet_template_unique unique (sheet_id, template_id),
  constraint sheet_items_sheet_statement_unique unique (sheet_id, statement_id),
  constraint sheet_items_personal_payer check (
    scope = 'household' or payer_user_id is null
  )
);

comment on table public.sheet_items is
  'Itens da folha (DOMAIN.md §2 e §4.4): de modelo, de fatura (espelho — a fonte é o statement) ou pontuais. O status é CALCULADO (§4.5), não coluna. Itens de modelo/fatura não são apagados pelo app; pontuais sim.';

-- ---------------------------------------------------------------------------
-- Regras que não podem depender do app
-- ---------------------------------------------------------------------------

create trigger month_sheets_forbid_ownership_change
  before update on public.month_sheets
  for each row execute function public.forbid_ownership_change();

create trigger month_sheets_set_updated_at
  before update on public.month_sheets
  for each row execute function public.set_updated_at();

create trigger recurring_templates_forbid_ownership_change
  before update on public.recurring_templates
  for each row execute function public.forbid_ownership_change();

create trigger recurring_templates_set_updated_at
  before update on public.recurring_templates
  for each row execute function public.set_updated_at();

create trigger sheet_items_forbid_ownership_change
  before update on public.sheet_items
  for each row execute function public.forbid_ownership_change();

create trigger sheet_items_set_updated_at
  before update on public.sheet_items
  for each row execute function public.set_updated_at();

-- O RLS não cobre a chave estrangeira (lição da D25): sem estas funções daria
-- para apontar item para folha/modelo/fatura alheios, ou nomear pagador quem
-- **não é da família** — bastaria conhecer o id.
create or replace function public.assert_recurring_template_references()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  if new.category_id is not null then
    select exists (
      select 1
      from public.categories c
      where c.id = new.category_id
        and c.scope = new.scope
        and c.owner_user_id is not distinct from new.owner_user_id
        and c.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'A categoria escolhida não é deste escopo.'
        using errcode = '22023';
    end if;
  end if;

  if new.scope = 'household' and new.payer_user_id is not null then
    select exists (
      select 1
      from public.household_members m
      where m.household_id = new.household_id
        and m.user_id = new.payer_user_id
    ) into ok;

    if not ok then
      raise exception 'O pagador precisa ser membro da família.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger recurring_templates_assert_references
  before insert or update on public.recurring_templates
  for each row execute function public.assert_recurring_template_references();

create or replace function public.assert_sheet_item_references()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  -- A folha manda no escopo do item.
  select exists (
    select 1
    from public.month_sheets s
    where s.id = new.sheet_id
      and s.scope = new.scope
      and s.owner_user_id is not distinct from new.owner_user_id
      and s.household_id is not distinct from new.household_id
  ) into ok;

  if not ok then
    raise exception 'A folha do item não é deste escopo.'
      using errcode = '22023';
  end if;

  if new.template_id is not null then
    select exists (
      select 1
      from public.recurring_templates t
      where t.id = new.template_id
        and t.scope = new.scope
        and t.owner_user_id is not distinct from new.owner_user_id
        and t.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'O modelo do item não é deste escopo.'
        using errcode = '22023';
    end if;
  end if;

  if new.statement_id is not null then
    select exists (
      select 1
      from public.statements st
      where st.id = new.statement_id
        and st.scope = new.scope
        and st.owner_user_id is not distinct from new.owner_user_id
        and st.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'A fatura do item não é deste escopo.'
        using errcode = '22023';
    end if;
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

  if new.carried_from_item_id is not null then
    select exists (
      select 1
      from public.sheet_items i
      where i.id = new.carried_from_item_id
        and i.scope = new.scope
        and i.owner_user_id is not distinct from new.owner_user_id
        and i.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'O item de origem não é deste escopo.'
        using errcode = '22023';
    end if;
  end if;

  if new.scope = 'household' and new.payer_user_id is not null then
    select exists (
      select 1
      from public.household_members m
      where m.household_id = new.household_id
        and m.user_id = new.payer_user_id
    ) into ok;

    if not ok then
      raise exception 'O pagador precisa ser membro da família.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger sheet_items_assert_references
  before insert or update on public.sheet_items
  for each row execute function public.assert_sheet_item_references();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.month_sheets enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.sheet_items enable row level security;

create policy month_sheets_select_own_or_household
  on public.month_sheets for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy month_sheets_insert_own_or_household
  on public.month_sheets for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy month_sheets_update_own_or_household
  on public.month_sheets for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy month_sheets_delete_own_or_household
  on public.month_sheets for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy recurring_templates_select_own_or_household
  on public.recurring_templates for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy recurring_templates_insert_own_or_household
  on public.recurring_templates for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy recurring_templates_update_own_or_household
  on public.recurring_templates for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy recurring_templates_delete_own_or_household
  on public.recurring_templates for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy sheet_items_select_own_or_household
  on public.sheet_items for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy sheet_items_insert_own_or_household
  on public.sheet_items for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy sheet_items_update_own_or_household
  on public.sheet_items for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy sheet_items_delete_own_or_household
  on public.sheet_items for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

revoke all on public.month_sheets from anon, authenticated;
revoke all on public.recurring_templates from anon, authenticated;
revoke all on public.sheet_items from anon, authenticated;

grant select, insert, update, delete on public.month_sheets to authenticated;
grant select, insert, update, delete on public.recurring_templates to authenticated;
grant select, insert, update, delete on public.sheet_items to authenticated;
