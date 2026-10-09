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
 * TESTE DE ISOLAMENTO — faturas e parcelas (Fatia 4, fase 1/5)
 * =============================================================================
 * Mesmo cenário dos testes anteriores: B **está** na família de A, então a
 * regra é fina — o pessoal de A é invisível, o da família é compartilhado.
 *
 * Além do RLS, prova o que o banco recusa por construção e que o RLS **não**
 * cobriria sozinho (`assert_statement_references` e
 * `assert_installment_references` — mesma lição da D25): daria para criar
 * fatura apontando para o cartão pessoal de outra pessoa, ou parcela ligada a
 * lançamento/fatura alheios, bastando conhecer o id.
 *
 * E prova as decisões do `DOMAIN.md` (§2 e §4.2):
 *   * uma fatura por cartão e mês;
 *   * uma parcela por número dentro do lançamento;
 *   * parcela só existe para lançamento no crédito;
 *   * fatura da parcela é a do **mesmo cartão** do lançamento;
 *   * apagar o lançamento apaga as parcelas (cascade) e fatura com parcela
 *     não é apagada por engano (restrict).
 *
 * As parcelas aqui são sintéticas (as três da compra pessoal ficam na mesma
 * fatura de propósito): quem divide valores entre meses é a fase 2
 * (`splitInstallments`), com os testes próprios. Este arquivo testa isolamento
 * e restrições, não a aritmética do parcelamento.
 *
 * ⚠️ CRIAM DADOS no Supabase de teste. Os nomes são fixos e a limpeza passa
 * por eles, então as execuções não acumulam lixo.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

const PERSONAL_CARD_NAME = "Cartão de teste (STAT) pessoal";
const HOUSEHOLD_CARD_NAME = "Cartão de teste (STAT) da família";
const SECOND_HOUSEHOLD_CARD_NAME = "Cartão de teste (STAT) da família 2";
const PERSONAL_ACCOUNT_NAME = "Conta de teste (STAT) pessoal";
const HOUSEHOLD_ACCOUNT_NAME = "Conta de teste (STAT) da família";
const CREDIT_DESCRIPTION = "Compra de teste (STAT) no crédito";
const PIX_DESCRIPTION = "Lançamento de teste (STAT) no pix";
const THROWAWAY_DESCRIPTION = "Compra de teste (STAT) para apagar";

const CARD_NAMES = [
  PERSONAL_CARD_NAME,
  HOUSEHOLD_CARD_NAME,
  SECOND_HOUSEHOLD_CARD_NAME,
];
const ACCOUNT_NAMES = [PERSONAL_ACCOUNT_NAME, HOUSEHOLD_ACCOUNT_NAME];
const TRANSACTION_DESCRIPTIONS = [
  CREDIT_DESCRIPTION,
  PIX_DESCRIPTION,
  THROWAWAY_DESCRIPTION,
];

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let householdId: string;

let personalCardId: string;
let householdCardId: string;
let secondHouseholdCardId: string;
let personalAccountId: string;
let householdAccountId: string;
let personalStatementId: string;
let householdStatementId: string;
let secondHouseholdStatementId: string;
let personalCreditTransactionId: string;
let householdCreditTransactionId: string;
let householdPixTransactionId: string;

async function insertOne(
  client: SupabaseClient,
  table:
    | "accounts"
    | "credit_cards"
    | "transactions"
    | "statements"
    | "card_installments",
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

/**
 * Apaga o resíduo deste arquivo, na ordem que as FKs exigem: lançamentos
 * primeiro (as parcelas vão por cascade), depois faturas, cartões e contas.
 */
async function cleanup(): Promise<void> {
  await clientA
    .from("transactions")
    .delete()
    .in("description", TRANSACTION_DESCRIPTIONS);

  const { data: cards } = await clientA
    .from("credit_cards")
    .select("id")
    .in("name", CARD_NAMES);

  const cardIds = (cards ?? []).map((card) => card.id);

  if (cardIds.length > 0) {
    await clientA.from("statements").delete().in("card_id", cardIds);
  }

  await clientA.from("credit_cards").delete().in("name", CARD_NAMES);
  await clientA.from("accounts").delete().in("name", ACCOUNT_NAMES);
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

  // Limpeza defensiva de uma execução anterior que tenha morrido no meio.
  await cleanup();

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

  personalCardId = await insertOne(clientA, "credit_cards", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_CARD_NAME,
    closing_day: 20,
    due_day: 1,
    created_by: userAId,
  });
  householdCardId = await insertOne(clientA, "credit_cards", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_CARD_NAME,
    closing_day: 20,
    due_day: 1,
    created_by: userAId,
  });
  secondHouseholdCardId = await insertOne(clientA, "credit_cards", {
    scope: "household",
    household_id: householdId,
    name: SECOND_HOUSEHOLD_CARD_NAME,
    closing_day: 15,
    due_day: 25,
    created_by: userAId,
  });

  personalCreditTransactionId = await insertOne(clientA, "transactions", {
    scope: "personal",
    owner_user_id: userAId,
    description: CREDIT_DESCRIPTION,
    total_cents: 10000,
    occurred_on: "2026-10-05",
    payment_method: "credit",
    card_id: personalCardId,
    installments_count: 3,
    created_by: userAId,
  });
  householdCreditTransactionId = await insertOne(clientA, "transactions", {
    scope: "household",
    household_id: householdId,
    description: CREDIT_DESCRIPTION,
    total_cents: 4590,
    occurred_on: "2026-10-06",
    payment_method: "credit",
    card_id: householdCardId,
    created_by: userAId,
  });
  householdPixTransactionId = await insertOne(clientA, "transactions", {
    scope: "household",
    household_id: householdId,
    description: PIX_DESCRIPTION,
    total_cents: 500,
    occurred_on: "2026-10-07",
    payment_method: "pix",
    account_id: householdAccountId,
    created_by: userAId,
  });

  personalStatementId = await insertOne(clientA, "statements", {
    scope: "personal",
    owner_user_id: userAId,
    card_id: personalCardId,
    reference_month: "2026-11",
    closing_date: "2026-11-20",
    due_date: "2026-12-01",
    created_by: userAId,
  });
  householdStatementId = await insertOne(clientA, "statements", {
    scope: "household",
    household_id: householdId,
    card_id: householdCardId,
    reference_month: "2026-11",
    closing_date: "2026-11-20",
    due_date: "2026-12-01",
    created_by: userAId,
  });
  secondHouseholdStatementId = await insertOne(clientA, "statements", {
    scope: "household",
    household_id: householdId,
    card_id: secondHouseholdCardId,
    reference_month: "2026-12",
    closing_date: "2026-12-15",
    due_date: "2027-01-25",
    created_by: userAId,
  });

  // 10.000 em 3x, a divisão da fase 2: 3334 + 3333 + 3333.
  const { error: installmentsError } = await clientA
    .from("card_installments")
    .insert([
      {
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: personalCreditTransactionId,
        statement_id: personalStatementId,
        number: 1,
        amount_cents: 3334,
        created_by: userAId,
      },
      {
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: personalCreditTransactionId,
        statement_id: personalStatementId,
        number: 2,
        amount_cents: 3333,
        created_by: userAId,
      },
      {
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: personalCreditTransactionId,
        statement_id: personalStatementId,
        number: 3,
        amount_cents: 3333,
        created_by: userAId,
      },
      {
        scope: "household",
        household_id: householdId,
        transaction_id: householdCreditTransactionId,
        statement_id: householdStatementId,
        number: 1,
        amount_cents: 4590,
        created_by: userAId,
      },
    ]);

  if (installmentsError) {
    throw new Error(
      `Não consegui criar as parcelas de teste: ${installmentsError.message}`,
    );
  }
}, 60_000);

afterAll(async () => {
  await cleanup();
});

describe("faturas e parcelas — escopo pessoal", () => {
  it("B não vê a fatura pessoal nem as parcelas pessoais de A", async () => {
    const { data: statements } = await clientB
      .from("statements")
      .select("id")
      .eq("id", personalStatementId);
    const { data: installments } = await clientB
      .from("card_installments")
      .select("id")
      .eq("transaction_id", personalCreditTransactionId);

    expect(statements).toEqual([]);
    expect(installments).toEqual([]);
  });

  it("B não apaga a fatura pessoal de A", async () => {
    await clientB.from("statements").delete().eq("id", personalStatementId);

    const { data } = await clientA
      .from("statements")
      .select("id")
      .eq("id", personalStatementId)
      .maybeSingle();

    expect(data?.id).toBe(personalStatementId);
  });

  it("B não cria fatura pessoal em nome de A", async () => {
    const { error } = await clientB.from("statements").insert({
      scope: "personal",
      owner_user_id: userAId,
      card_id: personalCardId,
      reference_month: "2026-12",
      closing_date: "2026-12-20",
      due_date: "2027-01-01",
    });

    expect(error).not.toBeNull();
  });
});

describe("faturas e parcelas — o que é da família", () => {
  it("B vê e edita a fatura da família", async () => {
    const { data: visible } = await clientB
      .from("statements")
      .select("id")
      .eq("id", householdStatementId)
      .maybeSingle();
    expect(visible?.id).toBe(householdStatementId);

    const { error } = await clientB
      .from("statements")
      .update({ actual_cents: 5000 })
      .eq("id", householdStatementId);
    expect(error).toBeNull();

    // Devolve ao estado original para o resto do arquivo.
    await clientA
      .from("statements")
      .update({ actual_cents: null })
      .eq("id", householdStatementId);
  });

  it("B vê a parcela da família", async () => {
    const { data } = await clientB
      .from("card_installments")
      .select("id")
      .eq("statement_id", householdStatementId);

    expect(data).toHaveLength(1);
  });

  it("B não transforma a fatura da família em pessoal dele", async () => {
    const { error } = await clientB
      .from("statements")
      .update({ scope: "personal", owner_user_id: userBId })
      .eq("id", householdStatementId);

    expect(error).not.toBeNull();
  });
});

describe("regras que o banco garante sozinho", () => {
  it("fatura não pode apontar para cartão de outro escopo", async () => {
    // A porta que o RLS não cobre: a checagem de FK roda como dona da tabela.
    const { error } = await clientB.from("statements").insert({
      scope: "household",
      household_id: householdId,
      card_id: personalCardId,
      reference_month: "2026-12",
      closing_date: "2026-12-20",
      due_date: "2027-01-01",
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("conta de pagamento não pode ser de outro escopo", async () => {
    const { error } = await clientB.from("statements").insert({
      scope: "household",
      household_id: householdId,
      card_id: householdCardId,
      reference_month: "2026-12",
      closing_date: "2026-12-20",
      due_date: "2027-01-01",
      paid_from_account_id: personalAccountId,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("parcela não pode ligar lançamento de outro escopo", async () => {
    const { error } = await clientB.from("card_installments").insert({
      scope: "household",
      household_id: householdId,
      transaction_id: personalCreditTransactionId,
      statement_id: householdStatementId,
      number: 2,
      amount_cents: 1000,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("parcela só existe para lançamento no crédito", async () => {
    const { error } = await clientB.from("card_installments").insert({
      scope: "household",
      household_id: householdId,
      transaction_id: householdPixTransactionId,
      statement_id: householdStatementId,
      number: 1,
      amount_cents: 500,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("no crédito");
  });

  it("parcela não pode ligar um lançamento à fatura de outro cartão", async () => {
    const { error } = await clientB.from("card_installments").insert({
      scope: "household",
      household_id: householdId,
      transaction_id: householdCreditTransactionId,
      statement_id: secondHouseholdStatementId,
      number: 2,
      amount_cents: 1000,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("outro cartão");
  });

  it("uma fatura por cartão e mês", async () => {
    const { error } = await clientA.from("statements").insert({
      scope: "household",
      household_id: householdId,
      card_id: householdCardId,
      reference_month: "2026-11",
      closing_date: "2026-11-20",
      due_date: "2026-12-01",
      created_by: userAId,
    });

    expect(error?.code).toBe("23505");
  });

  it("uma parcela por número dentro do lançamento", async () => {
    const { error } = await clientA.from("card_installments").insert({
      scope: "household",
      household_id: householdId,
      transaction_id: householdCreditTransactionId,
      statement_id: householdStatementId,
      number: 1,
      amount_cents: 10,
      created_by: userAId,
    });

    expect(error?.code).toBe("23505");
  });

  it("apagar o lançamento apaga as parcelas (cascade)", async () => {
    const throwawayId = await insertOne(clientA, "transactions", {
      scope: "personal",
      owner_user_id: userAId,
      description: THROWAWAY_DESCRIPTION,
      total_cents: 100,
      occurred_on: "2026-10-08",
      payment_method: "credit",
      card_id: personalCardId,
      created_by: userAId,
    });

    const { data: installment, error: installmentError } = await clientA
      .from("card_installments")
      .insert({
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: throwawayId,
        statement_id: personalStatementId,
        number: 1,
        amount_cents: 100,
        created_by: userAId,
      })
      .select("id")
      .single();
    expect(installmentError).toBeNull();

    await clientA.from("transactions").delete().eq("id", throwawayId);

    const { data } = await clientA
      .from("card_installments")
      .select("id")
      .eq("id", installment?.id ?? "")
      .maybeSingle();

    expect(data).toBeNull();
  });

  it("fatura com parcela não é apagada por engano (restrict)", async () => {
    const { error } = await clientA
      .from("statements")
      .delete()
      .eq("id", personalStatementId);

    expect(error).not.toBeNull();
  });
});
