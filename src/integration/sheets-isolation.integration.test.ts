import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ensureHousehold,
  joinHousehold,
  requireTestCredentials,
  signInOrSignUp,
  USER_A,
  USER_B,
  USER_C,
} from "./support/fixtures";

/**
 * TESTE DE ISOLAMENTO — folhas, modelos e itens (Fatia 5, fase 1/8)
 * =============================================================================
 * Mesmo cenário dos testes anteriores: B **está** na família de A (o da família
 * é compartilhado de verdade). C existe para provar o que o RLS **não** cobre
 * sozinho (lição da D25): a chave estrangeira é checada como dona da tabela,
 * então sem os asserts daria para nomear pagador quem **não é da família**, ou
 * apontar um item para folha/modelo/fatura alheios — bastaria conhecer o id.
 *
 * Mês fixo **'2099-01'** de propósito: as folhas de verdade usam o mês corrente,
 * e a limpeza deste arquivo não pode encostar nelas.
 *
 * ⚠️ CRIAM DADOS no Supabase de teste. A limpeza é por mês e por nome fixos.
 *
 * Rodar: `npm run test:rls`
 * =============================================================================
 */

const MONTH = "2099-01";
const THROWAWAY_MONTH = "2099-02";
const PERSONAL_TEMPLATE_NAME = "Modelo de teste (SHEET) pessoal";
const HOUSEHOLD_TEMPLATE_NAME = "Modelo de teste (SHEET) da família";
const THROWAWAY_TEMPLATE_NAME = "Modelo de teste (SHEET) descartável";
const CARD_NAME = "Cartão de teste (SHEET) pessoal";
const PERSONAL_ITEM_NAME = "Item de teste (SHEET) pessoal";
const HOUSEHOLD_ITEM_NAME = "Item de teste (SHEET) da família";
const STATEMENT_ITEM_NAME = "Item de teste (SHEET) de fatura";
const THROWAWAY_ITEM_NAME = "Item de teste (SHEET) descartável";

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let userCId: string;
let householdId: string;

let personalSheetId: string;
let householdSheetId: string;
let personalTemplateId: string;
let personalStatementId: string;

async function insertOne(
  client: SupabaseClient,
  table:
    | "month_sheets"
    | "recurring_templates"
    | "sheet_items"
    | "credit_cards"
    | "statements",
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
 * Apaga o resíduo deste arquivo, na ordem que as FKs exigem: folhas primeiro
 * (itens vão por cascade, e `statement_id` é restrict), depois modelos,
 * faturas e o cartão.
 */
async function cleanup(): Promise<void> {
  await clientA
    .from("month_sheets")
    .delete()
    .in("reference_month", [MONTH, THROWAWAY_MONTH]);

  await clientA
    .from("recurring_templates")
    .delete()
    .in("name", [
      PERSONAL_TEMPLATE_NAME,
      HOUSEHOLD_TEMPLATE_NAME,
      THROWAWAY_TEMPLATE_NAME,
    ]);

  const { data: cards } = await clientA
    .from("credit_cards")
    .select("id")
    .eq("name", CARD_NAME);

  const cardIds = (cards ?? []).map((card) => card.id);

  if (cardIds.length > 0) {
    await clientA.from("statements").delete().in("card_id", cardIds);
  }

  await clientA.from("credit_cards").delete().eq("name", CARD_NAME);
}

beforeAll(async () => {
  requireTestCredentials();

  const sessionA = await signInOrSignUp(USER_A);
  const sessionB = await signInOrSignUp(USER_B);
  const sessionC = await signInOrSignUp(USER_C);

  clientA = sessionA.client;
  clientB = sessionB.client;
  userAId = sessionA.userId;
  userBId = sessionB.userId;
  userCId = sessionC.userId;

  householdId = await ensureHousehold(clientA);
  await joinHousehold(clientA, clientB, userAId, householdId);

  // Limpeza defensiva de uma execução anterior que tenha morrido no meio.
  await cleanup();

  personalSheetId = await insertOne(clientA, "month_sheets", {
    scope: "personal",
    owner_user_id: userAId,
    reference_month: MONTH,
    planned_close_date: "2099-02-05",
    created_by: userAId,
  });
  householdSheetId = await insertOne(clientA, "month_sheets", {
    scope: "household",
    household_id: householdId,
    reference_month: MONTH,
    planned_close_date: "2099-02-05",
    created_by: userAId,
  });

  personalTemplateId = await insertOne(clientA, "recurring_templates", {
    scope: "personal",
    owner_user_id: userAId,
    name: PERSONAL_TEMPLATE_NAME,
    default_amount_cents: 5000,
    due_day: 10,
    created_by: userAId,
  });
  await insertOne(clientA, "recurring_templates", {
    scope: "household",
    household_id: householdId,
    name: HOUSEHOLD_TEMPLATE_NAME,
    default_amount_cents: 12000,
    due_day: 5,
    payer_user_id: userAId,
    created_by: userAId,
  });

  await insertOne(clientA, "sheet_items", {
    sheet_id: personalSheetId,
    scope: "personal",
    owner_user_id: userAId,
    source: "template",
    template_id: personalTemplateId,
    name: PERSONAL_ITEM_NAME,
    expected_cents: 5000,
    due_date: "2099-01-10",
    created_by: userAId,
  });
  await insertOne(clientA, "sheet_items", {
    sheet_id: householdSheetId,
    scope: "household",
    household_id: householdId,
    source: "one_off",
    name: HOUSEHOLD_ITEM_NAME,
    expected_cents: 8000,
    due_date: "2099-01-15",
    payer_user_id: userAId,
    created_by: userAId,
  });

  // Cartão + fatura + item de fatura, no escopo pessoal.
  const cardId = await insertOne(clientA, "credit_cards", {
    scope: "personal",
    owner_user_id: userAId,
    name: CARD_NAME,
    closing_day: 20,
    due_day: 5,
    created_by: userAId,
  });
  personalStatementId = await insertOne(clientA, "statements", {
    scope: "personal",
    owner_user_id: userAId,
    card_id: cardId,
    reference_month: MONTH,
    closing_date: "2099-01-20",
    due_date: "2099-02-05",
    created_by: userAId,
  });
  await insertOne(clientA, "sheet_items", {
    sheet_id: personalSheetId,
    scope: "personal",
    owner_user_id: userAId,
    source: "statement",
    statement_id: personalStatementId,
    name: STATEMENT_ITEM_NAME,
    expected_cents: 0,
    created_by: userAId,
  });
}, 60_000);

afterAll(async () => {
  await cleanup();
});

describe("folhas e itens — escopo pessoal", () => {
  it("B não vê a folha, o modelo nem os itens pessoais de A", async () => {
    const { data: sheets } = await clientB
      .from("month_sheets")
      .select("id")
      .eq("id", personalSheetId);
    const { data: templates } = await clientB
      .from("recurring_templates")
      .select("id")
      .eq("id", personalTemplateId);
    const { data: items } = await clientB
      .from("sheet_items")
      .select("id")
      .eq("sheet_id", personalSheetId);

    expect(sheets).toEqual([]);
    expect(templates).toEqual([]);
    expect(items).toEqual([]);
  });

  it("B não apaga a folha pessoal de A", async () => {
    await clientB.from("month_sheets").delete().eq("id", personalSheetId);

    const { data } = await clientA
      .from("month_sheets")
      .select("id")
      .eq("id", personalSheetId)
      .maybeSingle();

    expect(data?.id).toBe(personalSheetId);
  });

  it("B não cria folha pessoal em nome de A", async () => {
    const { error } = await clientB.from("month_sheets").insert({
      scope: "personal",
      owner_user_id: userAId,
      reference_month: "2099-03",
      planned_close_date: "2099-04-05",
      created_by: userBId,
    });

    expect(error).not.toBeNull();
  });
});

describe("folhas e itens — o que é da família", () => {
  it("B vê e edita o item da família", async () => {
    const { data: visible } = await clientB
      .from("sheet_items")
      .select("id, expected_cents")
      .eq("sheet_id", householdSheetId)
      .eq("name", HOUSEHOLD_ITEM_NAME)
      .maybeSingle();
    expect(visible?.expected_cents).toBe(8000);

    const { error } = await clientB
      .from("sheet_items")
      .update({ expected_cents: 8500 })
      .eq("id", visible?.id ?? "");
    expect(error).toBeNull();

    // Devolve ao estado original para o resto do arquivo.
    await clientA
      .from("sheet_items")
      .update({ expected_cents: 8000 })
      .eq("id", visible?.id ?? "");
  });

  it("B não transforma a folha da família em pessoal dele", async () => {
    const { error } = await clientB
      .from("month_sheets")
      .update({ scope: "personal", owner_user_id: userBId })
      .eq("id", householdSheetId);

    expect(error).not.toBeNull();
  });
});

describe("regras que o banco garante sozinho", () => {
  it("item não pode apontar para folha de outro escopo", async () => {
    // A porta que o RLS não cobre: a checagem de FK roda como dona da tabela.
    const { error } = await clientB.from("sheet_items").insert({
      sheet_id: personalSheetId,
      scope: "household",
      household_id: householdId,
      source: "one_off",
      name: HOUSEHOLD_ITEM_NAME,
      expected_cents: 100,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("item não pode apontar para modelo de outro escopo", async () => {
    const { error } = await clientB.from("sheet_items").insert({
      sheet_id: householdSheetId,
      scope: "household",
      household_id: householdId,
      source: "template",
      template_id: personalTemplateId,
      name: HOUSEHOLD_ITEM_NAME,
      expected_cents: 100,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("item não pode apontar para fatura de outro escopo", async () => {
    const { error } = await clientB.from("sheet_items").insert({
      sheet_id: householdSheetId,
      scope: "household",
      household_id: householdId,
      source: "statement",
      statement_id: personalStatementId,
      name: HOUSEHOLD_ITEM_NAME,
      expected_cents: 100,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("não é deste escopo");
  });

  it("pagador precisa ser membro da família", async () => {
    const { error } = await clientB.from("sheet_items").insert({
      sheet_id: householdSheetId,
      scope: "household",
      household_id: householdId,
      source: "one_off",
      name: HOUSEHOLD_ITEM_NAME,
      expected_cents: 100,
      payer_user_id: userCId,
      created_by: userBId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("pagador");
  });

  it("item pessoal não aceita pagador", async () => {
    const { error } = await clientA.from("sheet_items").insert({
      sheet_id: personalSheetId,
      scope: "personal",
      owner_user_id: userAId,
      source: "one_off",
      name: PERSONAL_ITEM_NAME,
      expected_cents: 100,
      payer_user_id: userAId,
      created_by: userAId,
    });

    expect(error?.code).toBe("23514");
  });

  it("uma folha por escopo e mês", async () => {
    const { error } = await clientA.from("month_sheets").insert({
      scope: "household",
      household_id: householdId,
      reference_month: MONTH,
      planned_close_date: "2099-02-05",
      created_by: userAId,
    });

    expect(error?.code).toBe("23505");
  });

  it("um item por modelo dentro da folha", async () => {
    const { error } = await clientA.from("sheet_items").insert({
      sheet_id: personalSheetId,
      scope: "personal",
      owner_user_id: userAId,
      source: "template",
      template_id: personalTemplateId,
      name: PERSONAL_ITEM_NAME,
      expected_cents: 100,
      created_by: userAId,
    });

    expect(error?.code).toBe("23505");
  });

  it("um item por fatura dentro da folha", async () => {
    const { error } = await clientA.from("sheet_items").insert({
      sheet_id: personalSheetId,
      scope: "personal",
      owner_user_id: userAId,
      source: "statement",
      statement_id: personalStatementId,
      name: STATEMENT_ITEM_NAME,
      expected_cents: 0,
      created_by: userAId,
    });

    expect(error?.code).toBe("23505");
  });

  it("anual exige mês; mensal proíbe", async () => {
    const yearlyWithoutMonth = await clientA
      .from("recurring_templates")
      .insert({
        scope: "personal",
        owner_user_id: userAId,
        name: THROWAWAY_TEMPLATE_NAME,
        default_amount_cents: 1000,
        due_day: 1,
        frequency: "yearly",
        created_by: userAId,
      });
    const monthlyWithMonth = await clientA.from("recurring_templates").insert({
      scope: "personal",
      owner_user_id: userAId,
      name: THROWAWAY_TEMPLATE_NAME,
      default_amount_cents: 1000,
      due_day: 1,
      frequency: "monthly",
      yearly_month: 6,
      created_by: userAId,
    });

    expect(yearlyWithoutMonth.error?.code).toBe("23514");
    expect(monthlyWithMonth.error?.code).toBe("23514");
  });

  it("apagar a folha leva os itens (cascade)", async () => {
    const throwawaySheetId = await insertOne(clientA, "month_sheets", {
      scope: "personal",
      owner_user_id: userAId,
      reference_month: THROWAWAY_MONTH,
      planned_close_date: "2099-03-05",
      created_by: userAId,
    });
    const throwawayItemId = await insertOne(clientA, "sheet_items", {
      sheet_id: throwawaySheetId,
      scope: "personal",
      owner_user_id: userAId,
      source: "one_off",
      name: THROWAWAY_ITEM_NAME,
      expected_cents: 100,
      created_by: userAId,
    });

    await clientA.from("month_sheets").delete().eq("id", throwawaySheetId);

    const { data } = await clientA
      .from("sheet_items")
      .select("id")
      .eq("id", throwawayItemId)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it("apagar o modelo deixa o item como retrato (template_id nulo)", async () => {
    const throwawayTemplateId = await insertOne(
      clientA,
      "recurring_templates",
      {
        scope: "personal",
        owner_user_id: userAId,
        name: THROWAWAY_TEMPLATE_NAME,
        default_amount_cents: 1000,
        due_day: 1,
        created_by: userAId,
      },
    );
    const itemId = await insertOne(clientA, "sheet_items", {
      sheet_id: personalSheetId,
      scope: "personal",
      owner_user_id: userAId,
      source: "template",
      template_id: throwawayTemplateId,
      name: THROWAWAY_ITEM_NAME,
      expected_cents: 1000,
      created_by: userAId,
    });

    await clientA
      .from("recurring_templates")
      .delete()
      .eq("id", throwawayTemplateId);

    const { data } = await clientA
      .from("sheet_items")
      .select("id, template_id, name")
      .eq("id", itemId)
      .maybeSingle();

    expect(data?.name).toBe(THROWAWAY_ITEM_NAME);
    expect(data?.template_id).toBeNull();
  });
});
