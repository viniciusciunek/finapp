-- =============================================================================
-- Pessoas e empréstimos (Fatia 6) — DOMAIN.md §2, §3, §4.7
-- =============================================================================
-- `people` são **privadas do dono** (§3): não têm escopo, e nenhum membro da
-- família lê as do outro. `person_ledger_entries` é a conta corrente de cada
-- pessoa: `charge` = o que ela passou a dever; `payment` = o que devolveu.
--
-- O que este arquivo garante sem depender do app:
--   * só o dono lê/escreve a pessoa e a conta corrente dela (RLS);
--   * o lançamento só aponta para pessoa do **próprio criador** (trigger):
--     o id de uma pessoa alheia não pode nem ser usado — privacidade não
--     depende de a tela esconder;
--   * a conta corrente bate com o lançamento: o charge de uma transação só
--     existe para a pessoa que o lançamento atribui, e a parcela tem que ser
--     da mesma transação;
--   * recebimento não tem origem de transação, cobrança não tem conta de
--     destino; parcela exige a transação junto;
--   * pessoa com lançamento **não se apaga** (restrict) — histórico é
--     histórico; a conta corrente vai junto com a pessoa (cascade).
--
-- A geração dos `charge`s (vencimento da fatura no cartão, cronograma mensal
-- no dinheiro/Pix) é do app (DOMAIN §4.7); o banco guarda e confere.
-- =============================================================================

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  relationship text check (
    relationship is null or length(btrim(relationship)) between 1 and 40
  ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.people is
  'Pessoas de quem o usuário é credor (Pai, Tio, Sogra...) — privadas do dono, sem escopo (DOMAIN.md §3). Apagar é recusado se houver lançamento (on delete restrict).';

-- Nome único por dono: "Pai" duplicado confundiria a conta corrente.
create unique index people_owner_name_unique
  on public.people (owner_user_id, lower(btrim(name)));

create table public.person_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  kind text not null check (kind in ('charge', 'payment')),
  amount_cents integer not null check (amount_cents > 0),
  entry_date date not null,
  source_transaction_id uuid references public.transactions (id) on delete cascade,
  source_installment_id uuid references public.card_installments (id) on delete cascade,
  received_into_account_id uuid references public.accounts (id) on delete set null,
  notes text check (notes is null or length(btrim(notes)) between 1 and 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_ledger_entries_kind_refs check (
    (kind = 'charge' and received_into_account_id is null)
    or (
      kind = 'payment'
      and source_transaction_id is null
      and source_installment_id is null
    )
  ),
  constraint person_ledger_entries_installment_needs_transaction check (
    source_installment_id is null or source_transaction_id is not null
  )
);

comment on table public.person_ledger_entries is
  'Conta corrente da pessoa: charge = o que ela deve; payment = o que devolveu. Saldo = charges vencidos − payments (DOMAIN.md §4.7); a quitação é FIFO por entry_date (P26).';

create index person_ledger_entries_person_date_idx
  on public.person_ledger_entries (person_id, entry_date);

create index person_ledger_entries_transaction_idx
  on public.person_ledger_entries (source_transaction_id)
  where source_transaction_id is not null;

-- O lançamento ganha "de quem é" (§4.7). Nulo = gasto próprio.
alter table public.transactions
  add column on_behalf_of_person_id uuid references public.people (id)
    on delete restrict;

comment on column public.transactions.on_behalf_of_person_id is
  'De quem é o gasto/empréstimo (DOMAIN.md §4.7). Nulo = próprio. Só aceita pessoa do criador (trigger transactions_assert_person_references).';

create index transactions_on_behalf_of_idx
  on public.transactions (on_behalf_of_person_id)
  where on_behalf_of_person_id is not null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

create trigger person_ledger_entries_set_updated_at
  before update on public.person_ledger_entries
  for each row execute function public.set_updated_at();

-- Pessoas não têm escopo, então o `forbid_ownership_change` genérico (que lê
-- scope/household_id) não serve: o dono e a autoria não mudam por um trigger
-- próprio. 42501 é um dos códigos que o app repassa ao usuário.
create or replace function public.forbid_people_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
     or new.created_by is distinct from old.created_by then
    raise exception 'O dono da pessoa não pode mudar depois da criação.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.forbid_people_owner_change() is
  'Impede trocar dono/autoria de uma pessoa já criada (as pessoas não têm escopo; o trigger genérico não serve).';

create trigger people_forbid_owner_change
  before update on public.people
  for each row execute function public.forbid_people_owner_change();

-- O lançamento só aponta para pessoa do **próprio criador**: sem isto, daria
-- para citar o id da pessoa de outro usuário (bastaria conhecê-lo) — e a
-- privacidade deixaria de valer para quem tentasse.
create or replace function public.assert_transaction_person_references()
returns trigger
language plpgsql
as $$
begin
  if new.on_behalf_of_person_id is not null then
    if not exists (
      select 1
      from public.people p
      where p.id = new.on_behalf_of_person_id
        and p.owner_user_id = new.created_by
    ) then
      raise exception 'A pessoa do empréstimo precisa ser sua.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_assert_person_references
  before insert or update on public.transactions
  for each row execute function public.assert_transaction_person_references();

-- A conta corrente tem que bater com o lançamento: o charge da transação só
-- existe para a pessoa que o lançamento atribui, e a parcela tem que ser da
-- mesma transação.
create or replace function public.assert_person_ledger_references()
returns trigger
language plpgsql
as $$
begin
  if new.source_transaction_id is not null then
    if not exists (
      select 1
      from public.transactions t
      where t.id = new.source_transaction_id
        and t.on_behalf_of_person_id = new.person_id
    ) then
      raise exception 'A transação de origem não é desta pessoa.'
        using errcode = '22023';
    end if;
  end if;

  if new.source_installment_id is not null then
    if not exists (
      select 1
      from public.card_installments i
      where i.id = new.source_installment_id
        and i.transaction_id = new.source_transaction_id
    ) then
      raise exception 'A parcela de origem não é desta transação.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger person_ledger_entries_assert_references
  before insert or update on public.person_ledger_entries
  for each row execute function public.assert_person_ledger_references();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.people enable row level security;
alter table public.person_ledger_entries enable row level security;

-- `people` — só o dono, em todas as ações (DOMAIN.md §3).
create policy people_select_own
  on public.people for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy people_insert_own
  on public.people for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and created_by = (select auth.uid())
  );

create policy people_update_own
  on public.people for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy people_delete_own
  on public.people for delete to authenticated
  using (owner_user_id = (select auth.uid()));

-- A conta corrente não tem dono próprio: o dono vem da pessoa.
create policy person_ledger_entries_select_own
  on public.person_ledger_entries for select to authenticated
  using (
    exists (
      select 1
      from public.people p
      where p.id = person_id
        and p.owner_user_id = (select auth.uid())
    )
  );

create policy person_ledger_entries_insert_own
  on public.person_ledger_entries for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.people p
      where p.id = person_id
        and p.owner_user_id = (select auth.uid())
    )
  );

create policy person_ledger_entries_update_own
  on public.person_ledger_entries for update to authenticated
  using (
    exists (
      select 1
      from public.people p
      where p.id = person_id
        and p.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.people p
      where p.id = person_id
        and p.owner_user_id = (select auth.uid())
    )
  );

create policy person_ledger_entries_delete_own
  on public.person_ledger_entries for delete to authenticated
  using (
    exists (
      select 1
      from public.people p
      where p.id = person_id
        and p.owner_user_id = (select auth.uid())
    )
  );

-- Grants mínimos: o app fala sempre como `authenticated`; `anon` não toca.
revoke all on public.people from anon, authenticated;
revoke all on public.person_ledger_entries from anon, authenticated;

grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.person_ledger_entries
  to authenticated;
