import { randomInt } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatInviteCode, generateInviteCode } from "@/domain/invite-code";

/**
 * TESTE DE ISOLAMENTO ENTRE USUÁRIOS (RLS)
 * =============================================================================
 * Obrigatório pela regra 2 ("nenhuma tabela sem teste de isolamento") e pela
 * regra 7 ("dados pessoais de um usuário nunca podem ser lidos por outro") das
 * instruções do projeto.
 *
 * Como funciona: dois usuários de teste (A e B) conversam com um Supabase de
 * verdade usando apenas a chave **publishable** — exatamente como o navegador
 * faz. Nada aqui usa a chave secreta, então o que o teste prova vale para o app
 * real: se o banco deixasse vazar, vazaria.
 *
 * O cenário é proposital e repetível:
 *   1. B é um estranho → não vê nada de A (nenhuma tabela, nem dado privado);
 *   2. B tenta se juntar sem convite → o banco recusa;
 *   3. A gera um convite; B aceita com o código formatado;
 *   4. B passa a ver a FAMÍLIA (compartilhado), mas continua **sem** ver as
 *      preferências de A (privado) e sem conseguir alterar o perfil de A;
 *   5. B sai, e o código de uso único não serve mais.
 *
 * Controles positivos: os mesmos testes verificam que A VÊ os próprios dados.
 * Sem isso, um banco que negasse tudo passaria no teste — falso positivo.
 *
 * ⚠️ Estes testes CRIAM DADOS no projeto configurado (dois usuários
 * `rls-teste+…@example.com` e uma família "Família de teste (RLS)"). Eles são
 * reutilizados a cada execução, então não crescem. Para remover tudo:
 * no painel do Supabase, apague a família de teste e depois os dois usuários.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

const SUPABASE_URL = process.env.RLS_TEST_URL ?? "";
const SUPABASE_KEY = process.env.RLS_TEST_KEY ?? "";

/** Nome fixo: identificar o resíduo de teste no painel é trivial. */
const TEST_HOUSEHOLD_NAME = "Família de teste (RLS)";

/**
 * Contas de teste reutilizadas a cada execução.
 *
 * As credenciais estão escritas aqui **de propósito**, e o repositório é
 * público: qualquer pessoa as lê. Isso é aceitável só porque elas existem em
 * bancos **descartáveis** — o Supabase local de desenvolvimento e o que sobe
 * dentro do CI. Se algum dia este teste apontar para um projeto de verdade,
 * apague estas contas por lá: a senha está à vista.
 */
const USER_A = {
  email: "rls-teste+a@example.com",
  password: "teste-rls-usuario-a",
};
const USER_B = {
  email: "rls-teste+b@example.com",
  password: "teste-rls-usuario-b",
};

function newClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Entra com o usuário; na primeira execução, cadastra antes. */
async function signInOrSignUp(credentials: {
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
async function ensureHousehold(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("create_household", {
    household_name: TEST_HOUSEHOLD_NAME,
  });

  if (!error && typeof data === "string") {
    return data;
  }

  // Segunda execução em diante: o MVP permite uma família por usuário, então
  // create_household recusa e reaproveitamos a que já existe.
  const { data: membership } = await client
    .from("household_members")
    .select("household_id")
    .maybeSingle();

  if (!membership) {
    throw new Error(
      `Não foi possível obter a família de teste: ${error?.message ?? "usuário sem vínculo"}`,
    );
  }

  return membership.household_id as string;
}

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let householdId: string;

beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Credenciais ausentes. Preencha NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local, ou defina " +
        "SUPABASE_TEST_URL/SUPABASE_TEST_KEY para apontar para outro Supabase.",
    );
  }

  ({ client: clientA, userId: userAId } = await signInOrSignUp(USER_A));
  ({ client: clientB, userId: userBId } = await signInOrSignUp(USER_B));

  // Estado inicial do cenário: B **fora** da família de A. Se uma execução
  // anterior deixou B dentro, sai agora (erro esperado quando já está fora).
  await clientB.rpc("leave_household");

  householdId = await ensureHousehold(clientA);
});

afterAll(async () => {
  // Limpa os convites criados pelas execuções (o membro pode apagá-los pela RLS).
  await clientA
    ?.from("household_invites")
    .delete()
    .eq("household_id", householdId);
});

describe("controle: A enxerga os próprios dados", () => {
  it("vê a própria família e o próprio vínculo", async () => {
    const { data: household, error } = await clientA
      .from("households")
      .select("id, name")
      .eq("id", householdId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(household?.name).toBe(TEST_HOUSEHOLD_NAME);

    const { data: membership } = await clientA
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", householdId)
      .eq("user_id", userAId)
      .maybeSingle();

    expect(membership?.role).toBe("owner");
  });

  it("lê o próprio perfil e as próprias preferências", async () => {
    const { data: profile } = await clientA
      .from("profiles")
      .select("id, name, email")
      .eq("id", userAId)
      .maybeSingle();

    expect(profile?.id).toBe(userAId);

    const { data: settings } = await clientA
      .from("user_settings")
      .select("user_id, payday_rule, payday_business_day")
      .eq("user_id", userAId)
      .maybeSingle();

    expect(settings?.payday_rule).toBe("nth_business_day");
    expect(settings?.payday_business_day).toBe(5);
  });
});

describe("estranho: B não enxerga nada da família de A", () => {
  it("não vê a família, nem os membros, nem os convites", async () => {
    const { data: households } = await clientB
      .from("households")
      .select("id, name");
    expect(households).toEqual([]);

    const { data: members } = await clientB
      .from("household_members")
      .select("id");
    expect(members).toEqual([]);

    const { data: invites } = await clientB
      .from("household_invites")
      .select("id");
    expect(invites).toEqual([]);
  });

  it("não lê o perfil de A", async () => {
    const { data } = await clientB
      .from("profiles")
      .select("id, name, email")
      .eq("id", userAId);

    expect(data).toEqual([]);
  });

  it("não lê as preferências de A (dado privado, nem para a família)", async () => {
    const { data } = await clientB
      .from("user_settings")
      .select("user_id, payday_rule")
      .eq("user_id", userAId);

    expect(data).toEqual([]);
  });

  it("não consegue alterar o perfil de A", async () => {
    const { data } = await clientB
      .from("profiles")
      .update({ name: "invadido pelo teste" })
      .eq("id", userAId)
      .select();

    expect(data ?? []).toEqual([]);

    // Confirma que nada mudou de fato.
    const { data: profile } = await clientA
      .from("profiles")
      .select("name")
      .eq("id", userAId)
      .maybeSingle();

    expect(profile?.name).not.toBe("invadido pelo teste");
  });

  it("não consegue se juntar à família por INSERT direto", async () => {
    const { error } = await clientB.from("household_members").insert({
      household_id: householdId,
      user_id: userBId,
      role: "member",
      created_by: userBId,
    });

    expect(error).not.toBeNull();

    // E continua de fora.
    const { data: membership } = await clientB
      .from("household_members")
      .select("id")
      .eq("household_id", householdId);

    expect(membership).toEqual([]);
  });

  it("não consegue criar convite para a família de A", async () => {
    const code = generateInviteCode((max) => randomInt(max));

    const { error } = await clientB.from("household_invites").insert({
      household_id: householdId,
      code,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
  });

  it("recebe erro claro ao tentar um código inexistente", async () => {
    const { error } = await clientB.rpc("accept_household_invite", {
      invite_code: "ZZZZZZZZZZ",
    });

    expect(error?.message ?? "").toMatch(/inválido/i);
  });
});

describe("convite: B entra com o código", () => {
  let inviteCode: string;

  beforeAll(async () => {
    inviteCode = generateInviteCode((max) => randomInt(max));

    const { error } = await clientA.from("household_invites").insert({
      household_id: householdId,
      code: inviteCode,
      created_by: userAId,
    });

    expect(error).toBeNull();
  });

  it("aceita o código digitado com formatação (ABC-DEFG-HJK)", async () => {
    const { data, error } = await clientB.rpc("accept_household_invite", {
      invite_code: formatInviteCode(inviteCode).toLowerCase(),
    });

    expect(error).toBeNull();
    expect(data).toBe(householdId);
  });

  it("passa a ver a família e o nome de A (o que é compartilhado)", async () => {
    const { data: households } = await clientB
      .from("households")
      .select("id")
      .eq("id", householdId);
    expect(households).toHaveLength(1);

    const { data: profile } = await clientB
      .from("profiles")
      .select("id, name")
      .eq("id", userAId)
      .maybeSingle();

    expect(profile?.id).toBe(userAId);
  });

  it("CONTINUA sem ver as preferências de A (privado mesmo dentro da família)", async () => {
    const { data } = await clientB
      .from("user_settings")
      .select("user_id, payday_rule")
      .eq("user_id", userAId);

    expect(data).toEqual([]);
  });

  it("não consegue alterar a família (só o dono pode)", async () => {
    const { data } = await clientB
      .from("households")
      .update({ name: "renomeada pelo teste" })
      .eq("id", householdId)
      .select();

    expect(data ?? []).toEqual([]);

    const { data: household } = await clientA
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle();

    expect(household?.name).toBe(TEST_HOUSEHOLD_NAME);
  });

  it("sai da família e o código de uso único não serve mais", async () => {
    const { error: leaveError } = await clientB.rpc("leave_household");
    expect(leaveError).toBeNull();

    const { error } = await clientB.rpc("accept_household_invite", {
      invite_code: inviteCode,
    });
    expect(error?.message ?? "").toMatch(/utilizado/i);
  });

  it("depois de sair, B volta a não enxergar a família", async () => {
    const { data: households } = await clientB.from("households").select("id");
    expect(households).toEqual([]);
  });
});
