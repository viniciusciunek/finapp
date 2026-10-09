import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ensureHousehold,
  joinHousehold,
  requireTestCredentials,
  signInOrSignUp,
  USER_A,
  USER_B,
} from "./support/fixtures";

/**
 * TESTE DE ISOLAMENTO — categorias e lançamentos (Fatia 3)
 * =============================================================================
 * Mesmo cenário do teste de contas: B **está** na família de A, então a regra
 * é fina — pessoal de A é invisível, o da família é compartilhado de verdade.
 *
 * Além do RLS, aqui se prova o que o banco recusa por construção e que o RLS
 * **não** cobriria sozinho: a checagem de chave estrangeira roda como dona da
 * tabela, então sem a função `assert_transaction_references` daria para gravar
 * um lançamento apontando para a conta pessoal de outra pessoa — bastaria
 * conhecer o id. Este teste é o que garante que essa porta está fechada.
 *
 * E prova a decisão tomada no `DOMAIN.md` §2: apagar conta com lançamento é
 * **recusado** (`on delete restrict`), para o histórico não sumir por engano.
 *
 * ⚠️ CRIAM DADOS no Supabase de teste. Os nomes são fixos e a limpeza passa por
 * eles, então as execuções não acumulam lixo.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

const PERSONAL_ACCOUNT_NAME = "Conta de teste (TRANS) pessoal";
const HOUSEHOLD_ACCOUNT_NAME = "Conta de teste (TRANS) da família";
const PERSONAL_CATEGORY_NAME = "Categoria de teste (TRANS) pessoal";
const HOUSEHOLD_CATEGORY_NAME = "Categoria de teste (TRANS) da família";
const DESCRIPTION = "Lançamento de teste (TRANS)";
/** Mesmo nome de categoria do escopo pessoal, para provar a unicidade. */
const DUPLICATE_CATEGORY_NAME = "categoria de teste (trans) PESSOAL";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let householdId: string;

let personalAccountId: string;
let householdAccountId: string;
let personalCategoryId: string;
let householdCategoryId: string;
let personalTransactionId: string;
let householdTransactionId: string;

async function insertOne(
  client: SupabaseClient,
  table: "accounts" | "categories" | "transactions",
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

  return data.id;
}

beforeAll(async () => {
  requireTestCredentials();

  const sessionA = await signInOrSignUp(USER_A);
  const sessionB = await signInOrSignUp(USER_B);

  clientA = sessionA.client;
  clientB = sessionB.client;
  userAId = sessionA.userId;
  userBId = sessionB.userId;

  householdId = await ensureHousehold(clientA);
  await joinHousehold(clientA, clientB, userAId, householdId);

  // Limpeza defensiva: lançamento primeiro (a conta com lançamento é
  // protegida por `on delete restrict`), depois categoria e conta.
  await clientA.from("transactions").delete().eq("description", DESCRIPTION);
  await clientA
    .from("categories")
    .delete()
    .in("name", [PERSONAL_CATEGORY_NAME, HOUSEHOLD_CATEGORY_NAME]);
  await clientA
    .from("accounts")
    .delete()
    .in("name", [PERSONAL_ACCOUNT_NAME, HOUSEHOLD_ACCOUNT_NAME]);

  personalAccountId = await insertOne(clientA, "accounts", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_ACCOUNT_NAME,
    type: "checking",
    created_by: userAId,
  });
  householdAccountId = await insertOne(clientA, "accounts", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_ACCOUNT_NAME,
    type: "checking",
    created_by: userAId,
  });
  personalCategoryId = await insertOne(clientA, "categories", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_CATEGORY_NAME,
    created_by: userAId,
  });
  householdCategoryId = await insertOne(clientA, "categories", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_CATEGORY_NAME,
    created_by: userAId,
  });

  personalTransactionId = await insertOne(clientA, "transactions", {
    scope: "personal",
    owner_user_id: userAId,
    description: DESCRIPTION,
    category_id: personalCategoryId,
    total_cents: 1200,
    occurred_on: "2026-10-05",
    payment_method: "pix",
    account_id: personalAccountId,
    created_by: userAId,
  });
  householdTransactionId = await insertOne(clientA, "transactions", {
    scope: "household",
    household_id: householdId,
    description: DESCRIPTION,
    category_id: householdCategoryId,
    total_cents: 4590,
    occurred_on: "2026-10-06",
    payment_method: "debit",
    account_id: householdAccountId,
    installments_count: 1,
    created_by: userAId,
  });
}, 60_000);

afterAll(async () => {
  await clientA.from("transactions").delete().eq("description", DESCRIPTION);
  await clientA
    .from("categories")
    .delete()
    .in("name", [PERSONAL_CATEGORY_NAME, HOUSEHOLD_CATEGORY_NAME]);
  await clientA
    .from("accounts")
    .delete()
    .in("name", [PERSONAL_ACCOUNT_NAME, HOUSEHOLD_ACCOUNT_NAME]);
});

describe("lançamentos e categorias — escopo pessoal", () => {
  it("B não vê o lançamento pessoal nem a categoria pessoal de A", async () => {
    const { data: transactions } = await clientB
      .from("transactions")
      .select("id")
      .eq("id", personalTransactionId);
    const { data: categories } = await clientB
      .from("categories")
      .select("id")
      .eq("id", personalCategoryId);

    expect(transactions).toEqual([]);
    expect(categories).toEqual([]);
  });

  it("B não apaga o lançamento pessoal de A", async () => {
    await clientB.from("transactions").delete().eq("id", personalTransactionId);

    const { data } = await clientA
      .from("transactions")
      .select("id")
      .eq("id", personalTransactionId)
      .maybeSingle();

    expect(data?.id).toBe(personalTransactionId);
  });

  it("B não cria lançamento pessoal em nome de A", async () => {
    const { error } = await clientB.from("transactions").insert({
      scope: "personal",
      owner_user_id: userAId,
      description: DESCRIPTION,
      total_cents: 999,
      occurred_on: "2026-10-07",
      payment_method: "cash",
      account_id: personalAccountId,
    });

    expect(error).not.toBeNull();
  });
});

describe("lançamentos e categorias — o que é da família", () => {
  it("B vê e edita o lançamento da família", async () => {
    const { data: visible } = await clientB
      .from("transactions")
      .select("id")
      .eq("id", householdTransactionId)
      .maybeSingle();
    expect(visible?.id).toBe(householdTransactionId);

    const { error } = await clientB
      .from("transactions")
      .update({ total_cents: 5000 })
      .eq("id", householdTransactionId);
    expect(error).toBeNull();

    // Devolve o valor original para o resto do arquivo.
    await clientA
      .from("transactions")
      .update({ total_cents: 4590 })
      .eq("id", householdTransactionId);
  });

  it("B não transforma o lançamento da família em pessoal dele", async () => {
    const { error } = await clientB
      .from("transactions")
      .update({ scope: "personal", owner_user_id: userBId })
      .eq("id", householdTransactionId);

    expect(error).not.toBeNull();
  });
});

describe("regras que o banco garante sozinho", () => {
  it("lançamento não pode apontar para conta de outro escopo", async () => {
    // A porta que o RLS não cobre: a checagem de FK roda como dona da tabela.
    const { error } = await clientB.from("transactions").insert({
      scope: "household",
      household_id: householdId,
      description: DESCRIPTION,
      total_cents: 1000,
      occurred_on: "2026-10-08",
      payment_method: "pix",
      account_id: personalAccountId,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("crédito exige cartão e dispensa conta", async () => {
    const { error } = await clientB.from("transactions").insert({
      scope: "household",
      household_id: householdId,
      description: DESCRIPTION,
      total_cents: 1000,
      occurred_on: "2026-10-08",
      payment_method: "credit",
      account_id: householdAccountId,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
  });

  it("nome de categoria é único dentro do escopo, sem ligar para maiúsculas", async () => {
    const { error } = await clientA.from("categories").insert({
      scope: "personal",
      owner_user_id: userAId,
      name: DUPLICATE_CATEGORY_NAME,
      created_by: userAId,
    });

    expect(error).not.toBeNull();
  });

  it("apagar conta com lançamento é recusado (o histórico não some)", async () => {
    const { error } = await clientA
      .from("accounts")
      .delete()
      .eq("id", personalAccountId);

    expect(error).not.toBeNull();
  });
});
