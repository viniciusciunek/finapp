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
 * TESTE DE ISOLAMENTO — pessoas e empréstimos (Fatia 6, fase 1/7)
 * =============================================================================
 * `people` são **privadas do dono** (DOMAIN.md §3): nem o membro da família lê
 * as do outro. B **está** na família de A, então a regra aqui é mais fina que
 * nas outras tabelas — não existe escopo: pessoa é sempre pessoal.
 *
 * Além do RLS, prova as recusas que o RLS não cobriria sozinho (mesma lição da
 * D25):
 *   * lançamento só aponta para pessoa do **próprio criador** (trigger) — o id
 *     de uma pessoa alheia não pode nem ser citado;
 *   * a conta corrente bate com o lançamento: charge de uma transação só para
 *     a pessoa que o lançamento atribui; parcela tem que ser da mesma
 *     transação;
 *   * recebimento não tem origem de transação, cobrança não tem conta de
 *     destino, parcela exige a transação (CHECKs);
 *   * apagar o lançamento apaga os charges (cascade); pessoa com lançamento
 *     não se apaga (restrict); pessoa sem lançamento leva a conta corrente
 *     junto (cascade).
 *
 * ⚠️ CRIAM DADOS no Supabase de teste. Os nomes são fixos (sufixo PES) e a
 * limpeza passa por eles, então as execuções não acumulam lixo.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

const PERSON_NAME = "Pai de teste (PES)";
const THROWAWAY_PERSON_NAME = "Tio de teste (PES)";
const PERSON_NAMES = [PERSON_NAME, THROWAWAY_PERSON_NAME];

const HOUSEHOLD_ACCOUNT_NAME = "Conta de teste (PES) da família";
const PERSONAL_ACCOUNT_NAME = "Conta de teste (PES) pessoal";
const ACCOUNT_NAMES = [HOUSEHOLD_ACCOUNT_NAME, PERSONAL_ACCOUNT_NAME];

const CARD_NAME = "Cartão de teste (PES) pessoal";

const CREDIT_WITH_PERSON = "Compra de teste (PES) com a pessoa";
const CREDIT_WITHOUT_PERSON = "Compra de teste (PES) sem a pessoa";
const PIX_LOAN = "Empréstimo de teste (PES) em pix";
const PIX_FROM_B = "Lançamento de teste (PES) da B";
const THROWAWAY_PIX = "Empréstimo de teste (PES) para apagar";
const TRANSACTION_DESCRIPTIONS = [
  CREDIT_WITH_PERSON,
  CREDIT_WITHOUT_PERSON,
  PIX_LOAN,
  PIX_FROM_B,
  THROWAWAY_PIX,
];

type Table =
  | "accounts"
  | "credit_cards"
  | "transactions"
  | "statements"
  | "card_installments"
  | "people"
  | "person_ledger_entries";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let householdId: string;

let personAId: string;
let personBId: string;
let householdAccountId: string;
let personalAccountId: string;
let personalCardId: string;
let statementId: string;
let creditWithPersonId: string;
let creditWithoutPersonId: string;
let installmentWithPersonId: string;
let installmentWithoutPersonId: string;

async function insertOne(
  client: SupabaseClient,
  table: Table,
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
 * Apaga o resíduo deste arquivo na ordem que as FKs exigem: lançamentos
 * primeiro (os charges vão por cascade), depois as pessoas (a conta corrente
 * restante vai junto), faturas, cartão e contas.
 */
async function cleanup(): Promise<void> {
  await clientA
    .from("transactions")
    .delete()
    .in("description", TRANSACTION_DESCRIPTIONS);

  await clientA.from("people").delete().in("name", PERSON_NAMES);
  await clientB.from("people").delete().in("name", PERSON_NAMES);

  const { data: cards } = await clientA
    .from("credit_cards")
    .select("id")
    .eq("name", CARD_NAME);

  const cardIds = (cards ?? []).map((card) => card.id);

  if (cardIds.length > 0) {
    await clientA.from("statements").delete().in("card_id", cardIds);
  }

  await clientA.from("credit_cards").delete().eq("name", CARD_NAME);
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

  personAId = await insertOne(clientA, "people", {
    owner_user_id: userAId,
    name: PERSON_NAME,
    relationship: "Pai",
    created_by: userAId,
  });
  // A mesma pessoa do ponto de vista de B: nome igual, donos diferentes —
  // o índice único é por dono.
  personBId = await insertOne(clientB, "people", {
    owner_user_id: userBId,
    name: PERSON_NAME,
    relationship: "Pai",
    created_by: userBId,
  });

  householdAccountId = await insertOne(clientA, "accounts", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_ACCOUNT_NAME,
    type: "checking",
    created_by: userAId,
  });
  personalAccountId = await insertOne(clientA, "accounts", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_ACCOUNT_NAME,
    type: "checking",
    created_by: userAId,
  });

  personalCardId = await insertOne(clientA, "credit_cards", {
    scope: "personal",
    owner_user_id: userAId,
    name: CARD_NAME,
    closing_day: 20,
    due_day: 1,
    created_by: userAId,
  });

  creditWithPersonId = await insertOne(clientA, "transactions", {
    scope: "personal",
    owner_user_id: userAId,
    description: CREDIT_WITH_PERSON,
    total_cents: 10000,
    occurred_on: "2099-04-05",
    payment_method: "credit",
    card_id: personalCardId,
    installments_count: 2,
    on_behalf_of_person_id: personAId,
    created_by: userAId,
  });
  creditWithoutPersonId = await insertOne(clientA, "transactions", {
    scope: "personal",
    owner_user_id: userAId,
    description: CREDIT_WITHOUT_PERSON,
    total_cents: 5000,
    occurred_on: "2099-04-06",
    payment_method: "credit",
    card_id: personalCardId,
    created_by: userAId,
  });

  statementId = await insertOne(clientA, "statements", {
    scope: "personal",
    owner_user_id: userAId,
    card_id: personalCardId,
    reference_month: "2099-04",
    closing_date: "2099-04-20",
    due_date: "2099-05-01",
    created_by: userAId,
  });

  const { error: installmentsError } = await clientA
    .from("card_installments")
    .insert([
      {
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: creditWithPersonId,
        statement_id: statementId,
        number: 1,
        amount_cents: 5000,
        created_by: userAId,
      },
      {
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: creditWithPersonId,
        statement_id: statementId,
        number: 2,
        amount_cents: 5000,
        created_by: userAId,
      },
      {
        scope: "personal",
        owner_user_id: userAId,
        transaction_id: creditWithoutPersonId,
        statement_id: statementId,
        number: 1,
        amount_cents: 5000,
        created_by: userAId,
      },
    ]);

  if (installmentsError) {
    throw new Error(
      `Não consegui criar as parcelas de teste: ${installmentsError.message}`,
    );
  }

  const { data: installments } = await clientA
    .from("card_installments")
    .select("id, transaction_id, number")
    .in("transaction_id", [creditWithPersonId, creditWithoutPersonId]);

  const firstOf = (transactionId: string) =>
    (installments ?? []).find(
      (row) => row.transaction_id === transactionId && row.number === 1,
    )?.id ?? "";

  installmentWithPersonId = firstOf(creditWithPersonId);
  installmentWithoutPersonId = firstOf(creditWithoutPersonId);
}, 60_000);

afterAll(async () => {
  await cleanup();
});

describe("pessoas — privacidade do dono", () => {
  it("B não vê a pessoa de A", async () => {
    const { data } = await clientB
      .from("people")
      .select("id")
      .eq("id", personAId);

    expect(data).toEqual([]);
  });

  it("A não vê a pessoa de B (controle simétrico)", async () => {
    const { data } = await clientA
      .from("people")
      .select("id")
      .eq("id", personBId);

    expect(data).toEqual([]);
  });

  it("B não cria pessoa em nome de A", async () => {
    const { error } = await clientB.from("people").insert({
      owner_user_id: userAId,
      name: "Pessoa forjada (PES)",
      created_by: userBId,
    });

    expect(error).not.toBeNull();

    const { data } = await clientA
      .from("people")
      .select("name")
      .eq("owner_user_id", userAId);

    expect(data).toEqual([{ name: PERSON_NAME }]);
  });

  it("B não edita nem apaga a pessoa de A", async () => {
    await clientB
      .from("people")
      .update({ name: "Invadida (PES)" })
      .eq("id", personAId);
    await clientB.from("people").delete().eq("id", personAId);

    const { data } = await clientA
      .from("people")
      .select("name")
      .eq("id", personAId)
      .maybeSingle();

    expect(data?.name).toBe(PERSON_NAME);
  });
});

describe("conta corrente — privacidade e coerência", () => {
  it("B não lê nem escreve a conta corrente de A", async () => {
    const { data: entries } = await clientB
      .from("person_ledger_entries")
      .select("id")
      .eq("person_id", personAId);

    expect(entries).toEqual([]);

    const { error } = await clientB.from("person_ledger_entries").insert({
      person_id: personAId,
      kind: "payment",
      amount_cents: 1000,
      entry_date: "2099-05-10",
      created_by: userBId,
    });

    expect(error).not.toBeNull();
  });

  it("A lê e escreve a própria conta corrente", async () => {
    const chargeId = await insertOne(clientA, "person_ledger_entries", {
      person_id: personAId,
      kind: "charge",
      amount_cents: 5000,
      entry_date: "2099-05-01",
      source_transaction_id: creditWithPersonId,
      created_by: userAId,
    });

    const { data } = await clientA
      .from("person_ledger_entries")
      .select("id, kind")
      .eq("id", chargeId)
      .maybeSingle();

    expect(data).toEqual({ id: chargeId, kind: "charge" });
  });

  it("recebimento não tem origem de transação", async () => {
    const { error } = await clientA.from("person_ledger_entries").insert({
      person_id: personAId,
      kind: "payment",
      amount_cents: 1000,
      entry_date: "2099-05-10",
      source_transaction_id: creditWithPersonId,
      created_by: userAId,
    });

    expect(error?.code).toBe("23514");
  });

  it("cobrança não tem conta de destino", async () => {
    const { error } = await clientA.from("person_ledger_entries").insert({
      person_id: personAId,
      kind: "charge",
      amount_cents: 1000,
      entry_date: "2099-05-10",
      source_transaction_id: creditWithPersonId,
      received_into_account_id: personalAccountId,
      created_by: userAId,
    });

    expect(error?.code).toBe("23514");
  });

  it("parcela exige a transação junto", async () => {
    const { error } = await clientA.from("person_ledger_entries").insert({
      person_id: personAId,
      kind: "charge",
      amount_cents: 5000,
      entry_date: "2099-05-01",
      source_installment_id: installmentWithPersonId,
      created_by: userAId,
    });

    // O trigger roda antes do CHECK: sem a transação, a parcela "não é desta
    // transação" (22023). O CHECK `installment_needs_transaction` continua como
    // segunda barreira.
    expect(error?.code).toBe("22023");
  });
});

describe("cruzamentos que o banco recusa", () => {
  it("lançamento não aponta para pessoa de outro usuário", async () => {
    const { error } = await clientB.from("transactions").insert({
      scope: "household",
      household_id: householdId,
      description: PIX_FROM_B,
      total_cents: 500,
      occurred_on: "2099-05-08",
      payment_method: "pix",
      account_id: householdAccountId,
      on_behalf_of_person_id: personAId,
      created_by: userBId,
    });

    expect(error?.code).toBe("22023");
  });

  it("A também não aponta para a pessoa de B", async () => {
    const { error } = await clientA.from("transactions").insert({
      scope: "personal",
      owner_user_id: userAId,
      description: PIX_FROM_B,
      total_cents: 500,
      occurred_on: "2099-05-08",
      payment_method: "pix",
      account_id: personalAccountId,
      on_behalf_of_person_id: personBId,
      created_by: userAId,
    });

    expect(error?.code).toBe("22023");
  });

  it("charge de transação que não é da pessoa é recusado", async () => {
    const { error } = await clientA.from("person_ledger_entries").insert({
      person_id: personAId,
      kind: "charge",
      amount_cents: 5000,
      entry_date: "2099-05-01",
      source_transaction_id: creditWithoutPersonId,
      created_by: userAId,
    });

    expect(error?.code).toBe("22023");
  });

  it("charge com parcela de outra transação é recusado", async () => {
    const { error } = await clientA.from("person_ledger_entries").insert({
      person_id: personAId,
      kind: "charge",
      amount_cents: 5000,
      entry_date: "2099-05-01",
      source_transaction_id: creditWithPersonId,
      source_installment_id: installmentWithoutPersonId,
      created_by: userAId,
    });

    expect(error?.code).toBe("22023");
  });

  it("charge com a parcela da própria transação vale", async () => {
    const chargeId = await insertOne(clientA, "person_ledger_entries", {
      person_id: personAId,
      kind: "charge",
      amount_cents: 5000,
      entry_date: "2099-05-01",
      source_transaction_id: creditWithPersonId,
      source_installment_id: installmentWithPersonId,
      created_by: userAId,
    });

    expect(chargeId).toBeTruthy();
  });
});

describe("ciclo de vida", () => {
  it("apagar o lançamento apaga os charges dele", async () => {
    const throwawayTransactionId = await insertOne(clientA, "transactions", {
      scope: "personal",
      owner_user_id: userAId,
      description: THROWAWAY_PIX,
      total_cents: 3000,
      occurred_on: "2099-05-10",
      payment_method: "pix",
      account_id: personalAccountId,
      on_behalf_of_person_id: personAId,
      created_by: userAId,
    });

    const throwawayChargeId = await insertOne(
      clientA,
      "person_ledger_entries",
      {
        person_id: personAId,
        kind: "charge",
        amount_cents: 3000,
        entry_date: "2099-05-10",
        source_transaction_id: throwawayTransactionId,
        created_by: userAId,
      },
    );

    await clientA
      .from("transactions")
      .delete()
      .eq("id", throwawayTransactionId);

    const { data } = await clientA
      .from("person_ledger_entries")
      .select("id")
      .eq("id", throwawayChargeId);

    expect(data).toEqual([]);
  });

  it("pessoa com lançamento não se apaga", async () => {
    const { error } = await clientA.from("people").delete().eq("id", personAId);

    expect(error?.code).toBe("23503");

    const { data } = await clientA
      .from("people")
      .select("id")
      .eq("id", personAId)
      .maybeSingle();

    expect(data?.id).toBe(personAId);
  });

  it("pessoa sem lançamento apaga e leva a conta corrente junto", async () => {
    const throwawayPersonId = await insertOne(clientA, "people", {
      owner_user_id: userAId,
      name: THROWAWAY_PERSON_NAME,
      created_by: userAId,
    });

    const paymentId = await insertOne(clientA, "person_ledger_entries", {
      person_id: throwawayPersonId,
      kind: "payment",
      amount_cents: 1000,
      entry_date: "2099-05-12",
      received_into_account_id: personalAccountId,
      created_by: userAId,
    });

    const { error } = await clientA
      .from("people")
      .delete()
      .eq("id", throwawayPersonId);

    expect(error).toBeNull();

    const { data } = await clientA
      .from("person_ledger_entries")
      .select("id")
      .eq("id", paymentId);

    expect(data).toEqual([]);
  });
});
