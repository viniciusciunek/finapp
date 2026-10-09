import { randomInt } from "node:crypto";

import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatInviteCode, generateInviteCode } from "@/domain/invite-code";

import {
  ensureHousehold,
  ensureOutsideHousehold,
  requireTestCredentials,
  signInOrSignUp,
  TEST_HOUSEHOLD_NAME,
  USER_A,
  USER_B,
} from "./support/fixtures";

/**
 * TESTE DE ISOLAMENTO ENTRE USUÁRIOS (RLS) — identidade e família
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
 * Os usuários, a família e o convite vêm de `./support/fixtures`, que é
 * compartilhado com o teste de isolamento de contas e cartões.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let householdId: string;

beforeAll(async () => {
  requireTestCredentials();

  ({ client: clientA, userId: userAId } = await signInOrSignUp(USER_A));
  ({ client: clientB, userId: userBId } = await signInOrSignUp(USER_B));

  // Estado inicial do cenário: B **fora** da família de A. Se uma execução
  // anterior deixou B dentro, sai agora (erro esperado quando já está fora).
  await ensureOutsideHousehold(clientB);

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
