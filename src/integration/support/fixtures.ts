import { randomInt } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { formatInviteCode, generateInviteCode } from "@/domain/invite-code";

/**
 * Peças compartilhadas dos testes de integração.
 *
 * Existe para os testes de isolamento não repetirem o cenário (dois usuários,
 * uma família, entrar por convite) — e para o dia em que um deles mudar, mudar
 * em um lugar só.
 *
 * Aqui não há `describe`/`it`: este arquivo **não** é um teste, é o cenário que
 * os testes usam. O `vitest.integration.config.mts` só coleta o que termina em
 * `*.integration.test.ts`, então este módulo fica de fora da coleta.
 *
 * ⚠️ Tudo aqui CRIAM DADOS no Supabase de teste (que precisa ser descartável —
 * ver a trava em `vitest.integration.config.mts`). As contas usadas são as da
 * lista `TEST_EMAILS` em `scripts/cleanup-test-data.mjs`, que é quem apaga o
 * resíduo quando necessário.
 */

const SUPABASE_URL = process.env.RLS_TEST_URL ?? "";
const SUPABASE_KEY = process.env.RLS_TEST_KEY ?? "";

/** Nome fixo: identificar o resíduo de teste no painel é trivial. */
export const TEST_HOUSEHOLD_NAME = "Família de teste (RLS)";

/**
 * Contas de teste reutilizadas a cada execução.
 *
 * As credenciais estão escritas aqui **de propósito**, e o repositório é
 * público: qualquer pessoa as lê. Isso é aceitável só porque elas existem em
 * bancos **descartáveis** — o Supabase local de desenvolvimento e o que sobe
 * dentro do CI. Se algum dia este teste apontar para um projeto de verdade,
 * apague estas contas por lá: a senha está à vista.
 */
export const USER_A = {
  email: "rls-teste+a@example.com",
  password: "teste-rls-usuario-a",
};
export const USER_B = {
  email: "rls-teste+b@example.com",
  password: "teste-rls-usuario-b",
};

/** Falha cedo (e explicando o que fazer) quando faltam as credenciais de teste. */
export function requireTestCredentials(): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Credenciais ausentes. Preencha NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local, ou defina " +
        "SUPABASE_TEST_URL/SUPABASE_TEST_KEY para apontar para outro Supabase.",
    );
  }
}

/** Cliente anônimo, do mesmo tipo que o navegador usa: só a chave publishable. */
export function newClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Entra com o usuário; na primeira execução, cadastra antes. */
export async function signInOrSignUp(credentials: {
  email: string;
  password: string;
}): Promise<{ client: SupabaseClient; userId: string }> {
  const client = newClient();

  // Na primeira execução cria a conta; nas seguintes o cadastro já existe e o
  // erro é esperado — o login abaixo é que decide se o teste pode continuar.
  await client.auth.signUp(credentials);

  const { data, error } = await client.auth.signInWithPassword(credentials);

  if (error || !data.user) {
    const hint = /confirm/i.test(error?.message ?? "")
      ? " Desligue 'Confirm email' em Authentication → Sign In / Providers → Email."
      : "";

    throw new Error(
      `Não foi possível autenticar ${credentials.email}: ${error?.message ?? "sem usuário"}.${hint}`,
    );
  }

  return { client, userId: data.user.id };
}

/** Devolve a família de teste de A, criando na primeira execução. */
export async function ensureHousehold(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("create_household", {
    household_name: TEST_HOUSEHOLD_NAME,
  });

  if (!error && typeof data === "string") {
    return data;
  }

  // Segunda execução em diante: o MVP permite uma família por usuário, então
  // create_household recusa e reaproveitamos a que já existe.
  //
  // O filtro por `user_id` não é enfeite: a policy deixa um membro ler os
  // vínculos da própria família, então sem ele a consulta veria também a
  // linha do parceiro — e dois vínculos fazem o `maybeSingle` virar erro.
  // Foi assim que a suíte ficou instável quando passou a rodar quatro
  // arquivos em paralelo: um deles já tinha B na família, o outro ainda não.
  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    throw new Error(
      `Sessão ausente ao buscar a família de teste: ${error?.message ?? "sem usuário"}`,
    );
  }

  const { data: membership, error: membershipError } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    throw new Error(
      `Não foi possível obter a família de teste: ${
        membershipError?.message ?? error?.message ?? "usuário sem vínculo"
      }`,
    );
  }

  return membership.household_id as string;
}

/** Tira B da família, ignorando o erro de quem já está fora. */
export async function ensureOutsideHousehold(
  client: SupabaseClient,
): Promise<void> {
  await client.rpc("leave_household");
}

/**
 * Põe B dentro da família de A pelo caminho oficial: A gera um convite e B
 * aceita usando o código **formatado** (com hífen), como alguém digitando do
 * celular — é o caminho que a pessoa percorre de verdade.
 *
 * **Idempotente de propósito:** se B já está na família, não faz nada. Os
 * arquivos de teste rodam um por vez, mas em ordem que não é nossa — um deles
 * pode terminar com B dentro e o próximo chamar isto de novo. O contrato é
 * "garantir B dentro", não "entrar agora": era o "entrar agora" que fazia a
 * suíte depender da ordem dos arquivos.
 */
export async function joinHousehold(
  hostClient: SupabaseClient,
  guestClient: SupabaseClient,
  hostUserId: string,
  householdId: string,
): Promise<void> {
  const { data: authData } = await guestClient.auth.getUser();
  const guestUserId = authData.user?.id;

  if (!guestUserId) {
    throw new Error("Sessão ausente ao entrar na família de teste.");
  }

  async function isInside(): Promise<boolean> {
    const { data } = await guestClient
      .from("household_members")
      .select("household_id")
      .eq("user_id", guestUserId as string)
      .eq("household_id", householdId)
      .maybeSingle();

    return data !== null;
  }

  if (await isInside()) {
    return;
  }

  const code = generateInviteCode((max) => randomInt(max));

  const { error: inviteError } = await hostClient
    .from("household_invites")
    .insert({
      household_id: householdId,
      code,
      created_by: hostUserId,
    });

  if (inviteError) {
    throw new Error(`Não consegui criar o convite: ${inviteError.message}`);
  }

  const { error: acceptError } = await guestClient.rpc(
    "accept_household_invite",
    { invite_code: formatInviteCode(code) },
  );

  if (acceptError) {
    // "Já faz parte" é sucesso para quem chamou (o alvo é B dentro) — qualquer
    // outra falha continua sendo falha.
    if (await isInside()) {
      return;
    }

    throw new Error(`Não consegui aceitar o convite: ${acceptError.message}`);
  }
}
