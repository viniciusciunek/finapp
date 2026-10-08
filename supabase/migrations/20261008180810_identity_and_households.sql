-- =============================================================================
-- Fatia 1 — Identidade e família
-- =============================================================================
-- Cria a base de identidade do app: perfil, preferências, família, membros e
-- convites. TODAS as tabelas nascem com Row Level Security ativada e com
-- policies explícitas (regra 2 das instruções do projeto).
--
-- Princípio que guia este arquivo (regra 7): nenhum usuário pode ler dados
-- pessoais de outro, nem por tabela, view, função ou join. As únicas leituras
-- cruzadas permitidas são entre membros da MESMA família, e apenas do que é
-- compartilhado (nome e e-mail de quem faz parte dela).
--
-- Convenções (docs/DOMAIN.md §1): nomes em inglês; toda tabela tem
-- id/created_at/updated_at/created_by. As mensagens de exceção estão em pt-BR
-- porque SÃO exibidas ao usuário pelo aplicativo.
--
-- Resumo das decisões de segurança (detalhadas junto de cada item):
--   1. Ninguém entra numa família inserindo uma linha: INSERT em
--      household_members não tem policy — só as funções SECURITY DEFINER abaixo
--      criam vínculos.
--   2. `user_settings` é privada: cada usuário lê e escreve apenas a sua.
--   3. Toda função SECURITY DEFINER usa `set search_path = ''` (obriga nomes
--      qualificados e evita ataques de search_path) e tem EXECUTE revogado de
--      `anon`/`public`.
--   4. Privilégios de tabela concedidos no mínimo necessário — e o RLS decide
--      as LINHAS, de forma independente dos grants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Utilitário: manter `updated_at` correto
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Preenche updated_at a cada UPDATE. Não é SECURITY DEFINER: só altera a própria linha em atualização.';

-- -----------------------------------------------------------------------------
-- 2. Tabelas
-- -----------------------------------------------------------------------------

-- profiles — o que o app precisa exibir de cada usuário.
-- O e-mail é uma cópia de auth.users.email, mantida pelo trigger de cadastro.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade
);

comment on table public.profiles is
  'Perfil de cada usuário (nome e e-mail). Criado automaticamente no cadastro. Legível pelo dono e pelos membros da mesma família.';

-- user_settings — preferências privadas de cada usuário.
-- payday_rule + payday_business_day definem o fechamento da folha (DOMAIN.md §4.4):
-- "nth_business_day" = 5 → 5º dia útil do mês seguinte.
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payday_rule text not null default 'nth_business_day'
    check (payday_rule in ('nth_business_day')),
  payday_business_day smallint not null default 5
    check (payday_business_day between 1 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade
);

comment on table public.user_settings is
  'Preferências PRIVADAS do usuário. Nenhum outro usuário pode ler, nem membros da família.';

-- households — a família é um espaço compartilhado, não um usuário (PRODUCT.md §5.1).
-- created_by usa ON DELETE RESTRICT de propósito: apagar a conta de quem criou a
-- família não pode apagar a família (e os dados) de todo mundo junto.
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict
);

comment on table public.households is
  'Família (espaço compartilhado). Criada apenas pela função create_household() — nunca por INSERT direto.';

-- household_members — quem participa de qual família.
-- SEM policy de INSERT/UPDATE/DELETE: vínculos só são criados pelas funções
-- SECURITY DEFINER. É isso que impede alguém de se adicionar a uma família
-- alheia apenas sabendo (ou adivinhando) o id dela.
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade,
  constraint household_members_unique_user unique (household_id, user_id)
);

comment on table public.household_members is
  'Vínculo usuário↔família. Somente leitura pelo app; criação/remoção passam por funções SECURITY DEFINER.';

-- household_invites — convite por código (decisão da Fatia 1).
-- Código de uso único: aceito uma vez (accepted_at) e com validade de 30 dias.
-- Formato fixado por CHECK: 10 caracteres do alfabeto sem letras ambíguas
-- (sem I, L, O, 0, 1). O alfabeto e o tamanho vivem em
-- `src/domain/invite-code.ts` — se mudar lá, muda aqui por migration.
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique
    check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$'),
  role text not null default 'member' check (role in ('owner', 'member')),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade,
  constraint household_invites_accepted_together
    check ((accepted_at is null) = (accepted_by is null))
);

comment on table public.household_invites is
  'Convites por código, de uso único e validade de 30 dias. Aceitos somente pela função accept_household_invite().';

-- -----------------------------------------------------------------------------
-- 3. Índices de apoio
-- -----------------------------------------------------------------------------
create index household_members_user_id_idx on public.household_members (user_id);
create index household_members_household_id_idx on public.household_members (household_id);
create index household_invites_household_id_idx on public.household_invites (household_id);

-- -----------------------------------------------------------------------------
-- 4. updated_at automático
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.household_members
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.household_invites
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Funções de apoio ao RLS
-- -----------------------------------------------------------------------------
-- Por que SECURITY DEFINER: uma policy em household_members que consultasse
-- household_members seria recursiva (o PostgreSQL aborta com
-- "infinite recursion detected in policy"). A função roda como o dono da
-- tabela, ignora o RLS por dentro e devolve apenas um boolean.

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_household_member(uuid) is
  'true se o usuário da requisição pertence à família informada.';

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

comment on function public.is_household_owner(uuid) is
  'true se o usuário da requisição é dono da família informada.';

create or replace function public.shares_household_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs
      on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
  );
$$;

comment on function public.shares_household_with(uuid) is
  'true se o usuário da requisição divide alguma família com o usuário informado.';

-- -----------------------------------------------------------------------------
-- 6. Funções de domínio (chamadas pelo app via RPC)
-- -----------------------------------------------------------------------------

-- Cria a família já com o criador como dono, em uma única transação.
-- Impede que o mesmo usuário crie (ou acumule) mais de uma família no MVP.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(household_name, ''));
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'É preciso estar autenticado para criar uma família.'
      using errcode = '42501';
  end if;

  if length(v_name) = 0 then
    raise exception 'Informe um nome para a família.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.household_members m where m.user_id = v_user_id
  ) then
    raise exception 'Você já faz parte de uma família.' using errcode = '23505';
  end if;

  insert into public.households (name, created_by)
  values (v_name, v_user_id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role, created_by)
  values (v_household_id, v_user_id, 'owner', v_user_id);

  return v_household_id;
end;
$$;

comment on function public.create_household(text) is
  'Cria uma família com o usuário da requisição como dono (atômico). Uma família por usuário no MVP.';

-- Aceita um convite pelo código.
-- `for update` tranca a linha do convite: dois aceites simultâneos do MESMO
-- código não podem criar dois vínculos (o código é de uso único).
create or replace function public.accept_household_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  -- Normalização IDÊNTICA à de `src/domain/invite-code.ts` (normalizeInviteCode):
  -- tira qualquer coisa que não seja letra/número e sobe para maiúsculas, para
  -- que o usuário possa digitar ou colar o código com hífen, espaço ou minúsculas.
  v_code text := upper(regexp_replace(coalesce(invite_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_invite public.household_invites;
begin
  if v_user_id is null then
    raise exception 'É preciso estar autenticado para aceitar um convite.'
      using errcode = '42501';
  end if;

  select *
    into v_invite
    from public.household_invites i
   where i.code = v_code
     for update;

  if not found then
    raise exception 'Código de convite inválido.' using errcode = '22023';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Este convite já foi utilizado.' using errcode = '22023';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Este convite expirou. Peça um novo.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.household_members m
     where m.household_id = v_invite.household_id
       and m.user_id = v_user_id
  ) then
    raise exception 'Você já faz parte desta família.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.household_members m where m.user_id = v_user_id
  ) then
    raise exception 'Você já faz parte de uma família.' using errcode = '23505';
  end if;

  insert into public.household_members (household_id, user_id, role, created_by)
  values (v_invite.household_id, v_user_id, v_invite.role, v_user_id);

  update public.household_invites
     set accepted_at = now(),
         accepted_by = v_user_id
   where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

comment on function public.accept_household_invite(text) is
  'Valida o código, cria o vínculo e marca o convite como usado (uso único).';

-- Sai da família atual.
-- Existe para fechar o ciclo do modelo de associação (quem entra pode sair) e
-- para tornar o teste de isolamento repetível — sem isso, o usuário de teste
-- ficaria membro para sempre e o cenário "estranho não vê nada" só funcionaria
-- uma vez. Só remove o PRÓPRIO vínculo; o dono não pode sair (a família ficaria
-- sem quem a administre).
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
begin
  if v_user_id is null then
    raise exception 'É preciso estar autenticado.' using errcode = '42501';
  end if;

  select m.role
    into v_role
    from public.household_members m
   where m.user_id = v_user_id
     for update;

  if not found then
    raise exception 'Você não faz parte de nenhuma família.' using errcode = '22023';
  end if;

  if v_role = 'owner' then
    raise exception 'Quem criou a família não pode sair.'
      using errcode = '42501';
  end if;

  delete from public.household_members where user_id = v_user_id;
end;
$$;

comment on function public.leave_household() is
  'Remove o vínculo do próprio usuário. O dono não pode sair.';

-- -----------------------------------------------------------------------------
-- 7. Trigger de cadastro
-- -----------------------------------------------------------------------------
-- Cria perfil e preferências junto com o usuário do Auth, para que o app nunca
-- encontre um usuário "sem perfil". O nome vem de raw_user_meta_data -> 'name'
-- (enviado pelo formulário de cadastro); sem ele, usa a parte antes do @.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := coalesce(new.email, '');
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
begin
  if v_name is null then
    v_name := nullif(split_part(v_email, '@', 1), '');
  end if;

  if v_name is null then
    v_name := 'Sem nome';
  end if;

  insert into public.profiles (id, name, email, created_by)
  values (new.id, v_name, v_email, new.id);

  insert into public.user_settings (user_id, created_by)
  values (new.id, new.id);

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Cria profiles e user_settings no cadastro. Executado após INSERT em auth.users.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- Para evitar repetição: (select auth.uid()) é avaliado uma única vez por
-- consulta (initplan), e não a cada linha — recomendo pelo próprio Supabase.

-- profiles ---------------------------------------------------------------
create policy "profiles_select_own_or_same_household"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.shares_household_with(id)
  );

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_settings — PRIVADA (regra 7) --------------------------------------
-- Só o próprio usuário. Nem membros da família leem.
-- Sem policy de INSERT: a linha nasce pelo trigger de cadastro.
create policy "user_settings_select_own"
  on public.user_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user_settings_update_own"
  on public.user_settings
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- households -------------------------------------------------------------
-- Sem policy de INSERT/DELETE: criar passa por create_household() e excluir a
-- família não é funcionalidade desta fatia (evita perda acidental de dados).
create policy "households_select_member"
  on public.households
  for select
  to authenticated
  using (public.is_household_member(id));

create policy "households_update_owner"
  on public.households
  for update
  to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

-- household_members ------------------------------------------------------
create policy "household_members_select_same_household"
  on public.household_members
  for select
  to authenticated
  using (public.is_household_member(household_id));

-- household_invites ------------------------------------------------------
create policy "household_invites_select_member"
  on public.household_invites
  for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "household_invites_insert_member"
  on public.household_invites
  for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = (select auth.uid())
    and accepted_at is null
  );

create policy "household_invites_delete_member"
  on public.household_invites
  for delete
  to authenticated
  using (public.is_household_member(household_id));

-- -----------------------------------------------------------------------------
-- 9. Privilégios (menor privilégio)
-- -----------------------------------------------------------------------------
-- O RLS decide as LINHAS; os grants decidem as AÇÕES. As duas camadas são
-- independentes, então concedemos aqui só o que o app realmente usa.
-- `revoke all` primeiro garante o mesmo resultado mesmo se o projeto tiver
-- `auto_expose_new_tables` ligado (padrão da nuvem).

revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

revoke all on public.user_settings from anon, authenticated;
grant select, update on public.user_settings to authenticated;

revoke all on public.households from anon, authenticated;
grant select, update on public.households to authenticated;

revoke all on public.household_members from anon, authenticated;
grant select on public.household_members to authenticated;

revoke all on public.household_invites from anon, authenticated;
grant select, insert, delete on public.household_invites to authenticated;

-- Funções: ninguém além de usuário autenticado pode executar.
-- (As funções de trigger, set_updated_at e handle_new_user, não recebem grant
-- explícito: são disparadas pelo banco, não chamadas pelo app.)
revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

revoke all on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_owner(uuid) to authenticated;

revoke all on function public.shares_household_with(uuid) from public, anon;
grant execute on function public.shares_household_with(uuid) to authenticated;

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

revoke all on function public.accept_household_invite(text) from public, anon;
grant execute on function public.accept_household_invite(text) to authenticated;

revoke all on function public.leave_household() from public, anon;
grant execute on function public.leave_household() to authenticated;
