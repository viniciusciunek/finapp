-- =============================================================================
-- Fatia 2 — Contas e cartões
-- =============================================================================
-- Cria as duas tabelas que dizem ONDE o dinheiro mora: contas (banco, poupança,
-- dinheiro em espécie) e cartões de crédito (com dia de fechamento e de
-- vencimento).
--
-- Estas são as PRIMEIRAS tabelas do projeto com escopo (`personal`/`household`).
-- O padrão que nasce aqui — CHECK de escopo, policies de dono-ou-família,
-- dono imutável — vale para todas as que vierem: lançamentos, categorias,
-- faturas e folhas.
--
-- Convenções (docs/DOMAIN.md §1): nomes em inglês; dinheiro em centavos
-- inteiros; toda tabela tem id/created_at/updated_at/created_by. As mensagens
-- de exceção estão em pt-BR porque SÃO exibidas ao usuário pelo aplicativo.
--
-- Resumo das decisões de segurança (detalhadas junto de cada item):
--   1. O escopo é garantido por CHECK: pessoal exige dono e proíbe família;
--      família exige família e proíbe dono. Não existe linha "sem dono" — e
--      também não existe linha com os dois, que seria ambígua na leitura.
--   2. O RLS decide as LINHAS: cada um lê e escreve no que é seu ou da sua
--      família, e em nada mais.
--   3. Dono, escopo e autoria são IMUTÁVEIS depois de criados (trigger). Sem
--      isso, um membro poderia "puxar" para o pessoal dele uma conta que era
--      da família — sumindo com ela para o outro.
--   4. `created_by` é anulável aqui, diferente das tabelas da Fatia 1: estas
--      linhas podem ser COMPARTILHADAS, e apagar a conta de quem as criou não
--      pode levar junto a conta bancária da família.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

-- accounts — onde o dinheiro entra e sai.
-- `bank` é anulável de propósito: dinheiro em espécie não tem banco.
-- `balance_cents`/`balance_as_of` nascem agora, mas ficam nulos: a regra de
-- saldo informado é a Fatia 8 (DOMAIN.md §4.9). A coluna existir desde já
-- mantém a tabela igual ao que o DOMAIN.md §2 descreve.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal'
    check (scope in ('personal', 'household')),
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  bank text,
  type text not null default 'checking'
    check (type in ('checking', 'savings', 'cash')),
  balance_cents integer,
  balance_as_of date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint accounts_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and household_id is not null and owner_user_id is null)
  )
);

comment on table public.accounts is
  'Contas onde o dinheiro mora (banco, poupança, espécie). Pessoais ou da família.';

comment on column public.accounts.type is
  'checking = conta corrente; savings = poupança; cash = dinheiro em espécie.';

comment on column public.accounts.balance_cents is
  'Saldo informado, em centavos. Nulo até a Fatia 8 (DOMAIN.md §4.9).';

-- credit_cards — cartões de crédito.
-- Sem coluna de banco: o nome do cartão já é "Nubank", "Banco do Brasil"...
-- closing_day/due_day vão de 1 a 31 porque o cadastro guarda o DIA escolhido;
-- o que fazer quando o mês é mais curto é regra do cálculo da fatura (Fatia 4).
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal'
    check (scope in ('personal', 'household')),
  owner_user_id uuid references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  limit_cents integer check (limit_cents is null or limit_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint credit_cards_scope_ownership check (
    (scope = 'personal' and owner_user_id is not null and household_id is null)
    or (scope = 'household' and household_id is not null and owner_user_id is null)
  )
);

comment on table public.credit_cards is
  'Cartões de crédito, com o dia de fechamento e o de vencimento. Pessoais ou da família.';

comment on column public.credit_cards.closing_day is
  'Dia do mês em que a fatura fecha (1 a 31). Meses curtos são tratados no cálculo (Fatia 4).';

-- -----------------------------------------------------------------------------
-- 2. Índices de apoio
-- -----------------------------------------------------------------------------
-- As policies filtram por dono ou por família: sem índice, toda consulta viraria
-- varredura de tabela.
create index accounts_owner_user_id_idx on public.accounts (owner_user_id);
create index accounts_household_id_idx on public.accounts (household_id);
create index credit_cards_owner_user_id_idx on public.credit_cards (owner_user_id);
create index credit_cards_household_id_idx on public.credit_cards (household_id);

-- -----------------------------------------------------------------------------
-- 3. Triggers
-- -----------------------------------------------------------------------------

-- updated_at: reaproveita o utilitário criado na Fatia 1.
create trigger set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.credit_cards
  for each row execute function public.set_updated_at();

-- Dono, escopo e autoria não mudam depois de criados.
-- Por que um trigger e não uma policy: a policy de UPDATE compara a linha NOVA
-- (`with check`) e a ANTIGA (`using`), mas nunca as duas entre si — não dá para
-- expressar "o dono tem que ser o mesmo de antes" por policy. E o grant é por
-- tabela, não por coluna, então também não dá para simplesmente negar o UPDATE
-- nessas colunas sem complicar todo o resto.
--
-- O código 42501 (insufficient_privilege) é um dos que o app repassa ao usuário
-- (src/server/errors.ts): se isso disparar, a pessoa lê o motivo em português.
create or replace function public.forbid_ownership_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scope is distinct from old.scope
     or new.owner_user_id is distinct from old.owner_user_id
     or new.household_id is distinct from old.household_id
     or new.created_by is distinct from old.created_by then
    raise exception 'O dono e o escopo não podem mudar depois da criação.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.forbid_ownership_change() is
  'Impede trocar dono/escopo/autoria numa linha já criada. Não é SECURITY DEFINER: só compara a linha em atualização.';

create trigger forbid_ownership_change before update on public.accounts
  for each row execute function public.forbid_ownership_change();
create trigger forbid_ownership_change before update on public.credit_cards
  for each row execute function public.forbid_ownership_change();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.credit_cards enable row level security;

-- A condição de leitura/escrita é sempre a mesma, e por isso está repetida de
-- forma idêntica nas quatro ações de cada tabela:
--   - linha pessoal: é minha;
--   - linha da família: eu faço parte dessa família.
-- `is_household_member` é SECURITY DEFINER (Fatia 1) — sem ele, uma policy que
-- consultasse household_members entraria em recursão.
--
-- Para evitar repetição: (select auth.uid()) é avaliado uma única vez por
-- consulta (initplan), e não a cada linha — recomendação do próprio Supabase.

-- accounts ---------------------------------------------------------------
create policy "accounts_select_own_or_household"
  on public.accounts
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy "accounts_insert_own_or_household"
  on public.accounts
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      owner_user_id = (select auth.uid())
      or (household_id is not null and public.is_household_member(household_id))
    )
  );

create policy "accounts_update_own_or_household"
  on public.accounts
  for update
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  )
  with check (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy "accounts_delete_own_or_household"
  on public.accounts
  for delete
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

-- credit_cards -----------------------------------------------------------
create policy "credit_cards_select_own_or_household"
  on public.credit_cards
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy "credit_cards_insert_own_or_household"
  on public.credit_cards
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      owner_user_id = (select auth.uid())
      or (household_id is not null and public.is_household_member(household_id))
    )
  );

create policy "credit_cards_update_own_or_household"
  on public.credit_cards
  for update
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  )
  with check (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy "credit_cards_delete_own_or_household"
  on public.credit_cards
  for delete
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (household_id is not null and public.is_household_member(household_id))
  );

-- -----------------------------------------------------------------------------
-- 5. Privilégios (menor privilégio)
-- -----------------------------------------------------------------------------
-- O RLS decide as LINHAS; os grants decidem as AÇÕES. As duas camadas são
-- independentes, então concedemos aqui só o que o app realmente usa — e o
-- `revoke all` primeiro dá o mesmo resultado mesmo com
-- `auto_expose_new_tables` ligado (padrão da nuvem).

revoke all on public.accounts from anon, authenticated;
grant select, insert, update, delete on public.accounts to authenticated;

revoke all on public.credit_cards from anon, authenticated;
grant select, insert, update, delete on public.credit_cards to authenticated;

-- A função de trigger não recebe grant: é disparada pelo banco, não chamada
-- pelo app (mesmo critério de set_updated_at e handle_new_user na Fatia 1).
