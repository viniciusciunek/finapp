import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ensureHousehold,
  ensureOutsideHousehold,
  joinHousehold,
  requireTestCredentials,
  signInOrSignUp,
  USER_A,
  USER_B,
} from "./support/fixtures";

/**
 * TESTE DE ISOLAMENTO — contas e cartões (Fatia 2)
 * =============================================================================
 * Aqui o cenário é mais interessante que o da Fatia 1: B **está** na família de
 * A. Então não basta negar tudo — a regra do escopo é mais fina:
 *
 *   - conta/cartão PESSOAL de A → B não vê, nem edita, nem apaga;
 *   - conta/cartão DA FAMÍLIA    → B vê e edita (é compartilhado de verdade).
 *
 * Sem o controle positivo (B vendo o que é da família), um banco que negasse
 * tudo passaria no teste — falso positivo. E sem o caso pessoal, um banco que
 * liberasse tudo também passaria. Os dois lados são o teste.
 *
 * Também se prova o que o banco recusa por construção:
 *   - B criando uma conta "pessoal" em nome de A;
 *   - B transformando a conta da família em pessoal dele (o dado sumiria do
 *     alcance da família — por isso dono e escopo são imutáveis);
 *   - conta pessoal sem dono, e conta da família sem família.
 *
 * ⚠️ CRIAM DADOS no Supabase de teste. Os nomes são fixos e a limpeza passa por
 * eles, então as execuções não acumulam lixo.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

/** Nomes fixos: a limpeza acha o resíduo por eles, e o painel fica legível. */
const PERSONAL_ACCOUNT_NAME = "Conta de teste (RLS) pessoal";
const HOUSEHOLD_ACCOUNT_NAME = "Conta de teste (RLS) da família";
const PERSONAL_CARD_NAME = "Cartão de teste (RLS) pessoal";
const HOUSEHOLD_CARD_NAME = "Cartão de teste (RLS) da família";

const ACCOUNT_NAMES = [PERSONAL_ACCOUNT_NAME, HOUSEHOLD_ACCOUNT_NAME];
const CARD_NAMES = [PERSONAL_CARD_NAME, HOUSEHOLD_CARD_NAME];

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let householdId: string;

let personalAccountId: string;
let householdAccountId: string;
let personalCardId: string;
let householdCardId: string;

/** Cria uma linha e devolve o id, falhando com mensagem clara se o banco recusar. */
async function insertOne(
  client: SupabaseClient,
  table: "accounts" | "credit_cards",
  values: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .insert(values)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Não consegui criar ${table} de teste: ${error?.message ?? "sem id"}`,
    );
  }

  return data.id as string;
}

/** Apaga o que este teste criou — no começo e no fim, para não acumular. */
async function cleanTestRows(): Promise<void> {
  await clientA.from("accounts").delete().in("name", ACCOUNT_NAMES);
  await clientA.from("credit_cards").delete().in("name", CARD_NAMES);
}

beforeAll(async () => {
  requireTestCredentials();

  ({ client: clientA, userId: userAId } = await signInOrSignUp(USER_A));
  ({ client: clientB, userId: userBId } = await signInOrSignUp(USER_B));

  // B precisa ESTAR na família: é o que torna o teste de escopo interessante.
  await ensureOutsideHousehold(clientB);
  householdId = await ensureHousehold(clientA);
  await joinHousehold(clientA, clientB, userAId, householdId);

  await cleanTestRows();

  personalAccountId = await insertOne(clientA, "accounts", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_ACCOUNT_NAME,
    bank: "Banco de teste",
    type: "checking",
    created_by: userAId,
  });

  householdAccountId = await insertOne(clientA, "accounts", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_ACCOUNT_NAME,
    type: "savings",
    created_by: userAId,
  });

  personalCardId = await insertOne(clientA, "credit_cards", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_CARD_NAME,
    closing_day: 20,
    due_day: 28,
    created_by: userAId,
  });

  householdCardId = await insertOne(clientA, "credit_cards", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_CARD_NAME,
    closing_day: 5,
    due_day: 12,
    limit_cents: 500_000,
    created_by: userAId,
  });
});

afterAll(async () => {
  await cleanTestRows();

  // Devolve o cenário ao estado inicial, como o outro teste espera encontrar.
  await ensureOutsideHousehold(clientB);
  await clientA
    ?.from("household_invites")
    .delete()
    .eq("household_id", householdId);
});

describe("controle: A enxerga o que é seu e o que é da família", () => {
  it("vê as duas contas que criou", async () => {
    const { data, error } = await clientA
      .from("accounts")
      .select("id")
      .in("name", ACCOUNT_NAMES);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("vê os dois cartões que criou", async () => {
    const { data, error } = await clientA
      .from("credit_cards")
      .select("id")
      .in("name", CARD_NAMES);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

describe("pessoal: B está na família, mas não toca no que é só de A", () => {
  it("não lê a conta pessoal de A", async () => {
    const { data } = await clientB
      .from("accounts")
      .select("id, name")
      .eq("id", personalAccountId);

    expect(data).toEqual([]);
  });

  it("não lê o cartão pessoal de A", async () => {
    const { data } = await clientB
      .from("credit_cards")
      .select("id, name")
      .eq("id", personalCardId);

    expect(data).toEqual([]);
  });

  it("não edita a conta pessoal de A", async () => {
    const { data } = await clientB
      .from("accounts")
      .update({ name: "invadida pelo teste" })
      .eq("id", personalAccountId)
      .select();

    expect(data ?? []).toEqual([]);

    // Confirma que nada mudou de fato, não só que a resposta veio vazia.
    const { data: after } = await clientA
      .from("accounts")
      .select("name")
      .eq("id", personalAccountId)
      .maybeSingle();

    expect(after?.name).toBe(PERSONAL_ACCOUNT_NAME);
  });

  it("não apaga a conta pessoal de A", async () => {
    const { data } = await clientB
      .from("accounts")
      .delete()
      .eq("id", personalAccountId)
      .select();

    expect(data ?? []).toEqual([]);

    const { data: stillThere } = await clientA
      .from("accounts")
      .select("id")
      .eq("id", personalAccountId)
      .maybeSingle();

    expect(stillThere?.id).toBe(personalAccountId);
  });
});

describe("família: o que é compartilhado, B vê e usa", () => {
  it("vê a conta e o cartão da família", async () => {
    const { data: accounts } = await clientB
      .from("accounts")
      .select("id, scope")
      .eq("id", householdAccountId);

    expect(accounts).toHaveLength(1);
    expect(accounts?.[0]?.scope).toBe("household");

    const { data: cards } = await clientB
      .from("credit_cards")
      .select("id, scope")
      .eq("id", householdCardId);

    expect(cards).toHaveLength(1);
    expect(cards?.[0]?.scope).toBe("household");
  });

  it("consegue editar a conta da família", async () => {
    const editedName = `${HOUSEHOLD_ACCOUNT_NAME} (editada)`;

    const { data, error } = await clientB
      .from("accounts")
      .update({ name: editedName })
      .eq("id", householdAccountId)
      .select("name");

    expect(error).toBeNull();
    expect(data?.[0]?.name).toBe(editedName);

    // Devolve o nome original: os testes seguintes contam com ele.
    await clientA
      .from("accounts")
      .update({ name: HOUSEHOLD_ACCOUNT_NAME })
      .eq("id", householdAccountId);
  });
});

describe("integridade: o banco recusa o que não faz sentido", () => {
  it("B não cria conta pessoal em nome de A", async () => {
    const { error } = await clientB.from("accounts").insert({
      scope: "personal",
      owner_user_id: userAId,
      name: "conta em nome de A",
      created_by: userBId,
    });

    expect(error).not.toBeNull();
  });

  it("B não transforma a conta da família em pessoal dele", async () => {
    const { error } = await clientB
      .from("accounts")
      .update({
        scope: "personal",
        owner_user_id: userBId,
        household_id: null,
      })
      .eq("id", householdAccountId)
      .select();

    expect(error).not.toBeNull();

    // A conta continua da família — o dado não sumiu do alcance de ninguém.
    const { data } = await clientA
      .from("accounts")
      .select("scope, household_id")
      .eq("id", householdAccountId)
      .maybeSingle();

    expect(data?.scope).toBe("household");
    expect(data?.household_id).toBe(householdId);
  });

  it("não aceita conta pessoal sem dono, nem da família sem família", async () => {
    // As duas camadas protegem (CHECK de escopo e policy de INSERT); o que este
    // teste garante é o resultado, que é o mesmo para quem usa o app: recusado.
    const { error: personalWithoutOwner } = await clientA
      .from("accounts")
      .insert({
        scope: "personal",
        name: "conta pessoal sem dono",
        created_by: userAId,
      });

    expect(personalWithoutOwner).not.toBeNull();

    const { error: householdWithoutHousehold } = await clientA
      .from("accounts")
      .insert({
        scope: "household",
        name: "conta da família sem família",
        created_by: userAId,
      });

    expect(householdWithoutHousehold).not.toBeNull();
  });
});
