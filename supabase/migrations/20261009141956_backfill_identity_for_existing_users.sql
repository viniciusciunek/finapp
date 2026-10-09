-- =============================================================================
-- Backfill de identidade para contas criadas ANTES do trigger existir
-- =============================================================================
-- O trigger `handle_new_user` só dispara em INSERT novo em `auth.users`. Quem já
-- tinha conta quando a migration anterior foi aplicada (por exemplo, o usuário
-- de teste criado pelo painel na Fatia 0) ficou **sem** `profiles` e sem
-- `user_settings` — e o app espera que essas linhas existam.
--
-- É idempotente de propósito: pode rodar quantas vezes for preciso, porque só
-- insere o que está faltando (`where not exists`).
--
-- Quem não tem nome conhecido recebe a parte antes do @ do e-mail e, em último
-- caso, "Sem nome" — o mesmo critério usado pelo trigger.
-- =============================================================================

insert into public.profiles (id, name, email, created_by)
select
  u.id,
  coalesce(nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''), 'Sem nome'),
  coalesce(u.email, ''),
  u.id
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

insert into public.user_settings (user_id, created_by)
select u.id, u.id
from auth.users u
where not exists (
  select 1 from public.user_settings s where s.user_id = u.id
);
