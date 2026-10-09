-- Categorias e lançamentos (Fatia 3, fase G1)
--
-- Mesmo molde de `accounts`/`credit_cards` (20261009122953): CHECK de escopo,
-- uma policy por ação, trigger que proíbe mudar dono/escopo e grants mínimos.
--
-- Decisões desta migration:
--   * `account_id`/`card_id` com `on delete restrict`: apagar uma conta que já
--     tem lançamento é bloqueado, e o histórico não some por engano
--     (`DOMAIN.md` §2, a pendência que a Fatia 3 tinha de responder).
--   * `category_id` com `on delete set null`: apagar uma categoria não pode
--     apagar o que já foi gasto — o lançamento fica sem categoria.
--   * `on_behalf_of_person_id` ("de quem é") só entra na Fatia 6, quando
--     existir a tabela de pessoas.
--   * Categorias básicas nascem junto com a **família**, não como lista global:
--     cada casal renomeia e apaga as suas sem tocar nas de ninguém. Personal
--     cada um cria quando quiser (e aí sim pelo app).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  )
);

comment on table public.categories is
  'Categorias de lançamento, por escopo (pessoal ou família). Nome único dentro do escopo, sem diferenciar maiúsculas.';

-- Nome único dentro do escopo: um "Mercado" só por pessoa, e um só por família,
-- sem diferenciar maiúsculas. Índice parcial porque as colunas de dono e de
-- família são exclusivas entre si (uma delas é sempre nula, e nulo não conta
-- como igual em índice único).
create unique index categories_personal_name_unique
  on public.categories (owner_user_id, lower(btrim(name)))
  where scope = 'personal';

create unique index categories_household_name_unique
  on public.categories (household_id, lower(btrim(name)))
  where scope = 'household';

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal',
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 80),
  category_id uuid references public.categories (id) on delete set null,
  total_cents integer not null check (total_cents > 0),
  occurred_on date not null,
  payment_method text not null check (
    payment_method in ('pix', 'cash', 'debit', 'boleto', 'credit')
  ),
  account_id uuid references public.accounts (id) on delete restrict,
  card_id uuid references public.credit_cards (id) on delete restrict,
  installments_count integer not null default 1 check (
    installments_count between 1 and 48
  ),
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and owner_user_id is null and household_id is not null)
  ),
  -- Crédito é sempre no cartão, sem conta; o resto é sempre numa conta, sem
  -- cartão. A Fatia 4 acrescenta as parcelas em cima de `installments_count`.
  constraint transactions_payment_target check (
    (
      payment_method = 'credit'
      and card_id is not null
      and account_id is null
    )
    or (
      payment_method <> 'credit'
      and account_id is not null
      and card_id is null
    )
  )
);

comment on table public.transactions is
  'Lançamentos de despesa. Dinheiro em centavos inteiros (DOMAIN.md §1). Apagar conta ou cartão com lançamento é recusado pelo banco (on delete restrict).';

create index transactions_personal_date_idx
  on public.transactions (owner_user_id, occurred_on desc)
  where scope = 'personal';

create index transactions_household_date_idx
  on public.transactions (household_id, occurred_on desc)
  where scope = 'household';

-- ---------------------------------------------------------------------------
-- Regras que não podem depender do app
-- ---------------------------------------------------------------------------

-- 1. Escopo e dono não mudam depois de criados (mesmo trigger das outras
--    tabelas com escopo) nem em categoria nem em lançamento.
create trigger categories_forbid_ownership_change
  before update on public.categories
  for each row execute function public.forbid_ownership_change();

create trigger transactions_forbid_ownership_change
  before update on public.transactions
  for each row execute function public.forbid_ownership_change();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- 2. O lançamento só pode apontar para conta, cartão e categoria do **mesmo
--    dono**. Isto é uma verificação de integridade referencial, e o RLS não
--    cobre esse caminho: a FK é checada como dona da tabela, então sem esta
--    função daria para gravar um lançamento apontando para a conta pessoal de
--    outra pessoa (bastaria conhecer o id).
create or replace function public.assert_transaction_references()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  if new.account_id is not null then
    select exists (
      select 1
      from public.accounts a
      where a.id = new.account_id
        and a.scope = new.scope
        and a.owner_user_id is not distinct from new.owner_user_id
        and a.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'A conta escolhida não é deste escopo.'
        using errcode = '22023';
    end if;
  end if;

  if new.card_id is not null then
    select exists (
      select 1
      from public.credit_cards c
      where c.id = new.card_id
        and c.scope = new.scope
        and c.owner_user_id is not distinct from new.owner_user_id
        and c.household_id is not distinct from new.household_id
    ) into ok;

    if not ok then
      raise exception 'O cartão escolhido não é deste escopo.'
        using errcode = '22023';
    end if;
  end if;

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

  return new;
end;
$$;

create trigger transactions_assert_references
  before insert or update on public.transactions
  for each row execute function public.assert_transaction_references();

-- 3. Categorias básicas ao criar a família. `security definer` porque roda no
--    meio do cadastro, antes de a pessoa ser "membro" para o RLS.
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (scope, household_id, name)
  values
    ('household', new.id, 'Mercado'),
    ('household', new.id, 'Casa'),
    ('household', new.id, 'Transporte'),
    ('household', new.id, 'Saúde'),
    ('household', new.id, 'Lazer'),
    ('household', new.id, 'Outros');

  return new;
end;
$$;

create trigger households_seed_default_categories
  after insert on public.households
  for each row execute function public.seed_default_categories();

-- Famílias que já existiam (a do casal) recebem as mesmas categorias agora.
insert into public.categories (scope, household_id, name)
select 'household', h.id, c.name
from public.households h
cross join (
  values ('Mercado'), ('Casa'), ('Transporte'), ('Saúde'), ('Lazer'), ('Outros')
) as c (name)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy categories_select_own_or_household
  on public.categories for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy categories_insert_own_or_household
  on public.categories for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy categories_update_own_or_household
  on public.categories for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy categories_delete_own_or_household
  on public.categories for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy transactions_select_own_or_household
  on public.transactions for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy transactions_insert_own_or_household
  on public.transactions for insert to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      or public.is_household_member(household_id)
    )
    and created_by = (select auth.uid())
  );

create policy transactions_update_own_or_household
  on public.transactions for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  )
  with check (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

create policy transactions_delete_own_or_household
  on public.transactions for delete to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );

revoke all on public.categories from anon, authenticated;
revoke all on public.transactions from anon, authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
