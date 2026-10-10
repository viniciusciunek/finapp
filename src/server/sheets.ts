import { dateInMonth, isMonthKey, shiftMonth } from "@/domain/month";
import {
  ownershipForScope,
  parseScope,
  type Ownership,
  type Scope,
} from "@/domain/scope";
import { plannedCloseDate, suggestedExpectedCents } from "@/domain/sheet";
import { createClient } from "@/lib/supabase/server";

import { listCreditCards } from "./credit-cards";
import { toUserMessage } from "./errors";
import { listStatementsByIds, listStatementsForMonths } from "./statements";

/**
 * Folhas do mês — camada de acesso a dados (Fatia 5, DOMAIN.md §4.4).
 *
 * Como nos outros módulos: **autorização não mora aqui**; quem decide o que
 * cada pessoa vê é o RLS. As funções filtram por escopo para a tela receber só
 * o que vai mostrar.
 *
 * O coração desta fase é a **geração idempotente**: abrir a folha cria a linha
 * do mês (com a data de fechamento congelada) e faz um *top-up* de itens — um
 * por modelo recorrente aplicável e um por fatura **com valor**, casados por
 * `(folha, template)` e `(folha, fatura)` (os únicos do banco). Abrir de novo
 * não duplica; folha fechada não gera (D40).
 *
 * Item de fatura é **espelho** (D38): o valor e o pagamento vivem no
 * `statement`; a folha só guarda o vínculo e o retrato do calculado no momento
 * da geração.
 */

export type MonthSheet = {
  id: string;
  scope: Scope;
  referenceMonth: string;
  plannedCloseDate: string;
  status: "open" | "closed";
};

export type RecurringTemplate = {
  id: string;
  scope: Scope;
  name: string;
  categoryId: string | null;
  defaultAmountCents: number;
  dueDay: number;
  payerUserId: string | null;
  frequency: "monthly" | "yearly";
  yearlyMonth: number | null;
  active: boolean;
};

export type SheetItemView = {
  id: string;
  source: "template" | "statement" | "one_off";
  name: string;
  expectedCents: number;
  /** Nos itens de fatura, já vem **do statement** (fonte única — D38). */
  actualCents: number | null;
  paidCents: number;
  dueDate: string | null;
  payerUserId: string | null;
  paidAt: string | null;
  templateId: string | null;
  statementId: string | null;
  carriedFromItemId: string | null;
  /** Preenchido quando ESTE item foi levado adiante (a cópia aponta para cá). */
  carriedToItemId: string | null;
  /** Presente nos itens de fatura: os números vivos dela, para a tela. */
  statement: {
    id: string;
    cardName: string | null;
    calculatedCents: number;
    effectiveCents: number;
    actualCents: number | null;
  } | null;
};

const SHEET_COLUMNS = "id, scope, reference_month, planned_close_date, status";

const ITEM_COLUMNS =
  "id, source, template_id, statement_id, name, expected_cents, actual_cents, due_date, payer_user_id, paid_cents, paid_at, carried_from_item_id";

const TEMPLATE_COLUMNS =
  "id, scope, name, category_id, default_amount_cents, due_day, payer_user_id, frequency, yearly_month, active";

type SheetRow = {
  id: string;
  scope: string;
  reference_month: string;
  planned_close_date: string;
  status: string;
};

type ItemRow = {
  id: string;
  source: string;
  template_id: string | null;
  statement_id: string | null;
  name: string;
  expected_cents: number;
  actual_cents: number | null;
  due_date: string | null;
  payer_user_id: string | null;
  paid_cents: number;
  paid_at: string | null;
  carried_from_item_id: string | null;
};

function toMonthSheet(row: SheetRow): MonthSheet {
  return {
    id: row.id,
    // Conversão defensiva igual à do cookie: sem `as` que só cala o tipo.
    scope: parseScope(row.scope),
    referenceMonth: row.reference_month,
    plannedCloseDate: row.planned_close_date,
    // O CHECK do banco só permite open/closed.
    status: row.status === "closed" ? "closed" : "open",
  };
}

function toTemplate(row: {
  id: string;
  scope: string;
  name: string;
  category_id: string | null;
  default_amount_cents: number;
  due_day: number;
  payer_user_id: string | null;
  frequency: string;
  yearly_month: number | null;
  active: boolean;
}): RecurringTemplate {
  return {
    id: row.id,
    scope: parseScope(row.scope),
    name: row.name,
    categoryId: row.category_id,
    defaultAmountCents: row.default_amount_cents,
    dueDay: row.due_day,
    payerUserId: row.payer_user_id,
    frequency: row.frequency === "yearly" ? "yearly" : "monthly",
    yearlyMonth: row.yearly_month,
    active: row.active,
  };
}

/**
 * O dia útil configurado pelo usuário (padrão 5 — o valor do §4.4). Na folha da
 * família, o valor de quem abre é **congelado** na criação (resposta do usuário
 * em 2026-10-10): os dois membros veem a mesma data depois disso.
 */
async function loadPaydayBusinessDay(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_settings")
    .select("payday_business_day")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.payday_business_day ?? 5;
}

/** A linha da folha do escopo ativo num mês — ou `null` se ainda não existe. */
async function findSheetRow(
  ownership: Ownership,
  month: string,
): Promise<{ row: SheetRow | null; error: string | null }> {
  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("month_sheets")
          .select(SHEET_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("month_sheets")
          .select(SHEET_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered
    .eq("reference_month", month)
    .maybeSingle();

  if (error) {
    return {
      row: null,
      error: toUserMessage(error, "Não foi possível carregar a folha."),
    };
  }

  return { row: data, error: null };
}

/** O modelo vale para este mês? Mensal sempre; anual só no mês escolhido. */
function templateAppliesToMonth(
  template: RecurringTemplate,
  month: string,
): boolean {
  if (template.frequency === "monthly") {
    return true;
  }

  return template.yearlyMonth === Number(month.slice(5, 7));
}

type NewSheetItem = {
  sheet_id: string;
  scope: Scope;
  owner_user_id: string | null;
  household_id: string | null;
  source: "template" | "statement" | "one_off";
  template_id: string | null;
  statement_id: string | null;
  name: string;
  expected_cents: number;
  due_date: string | null;
  payer_user_id: string | null;
  created_by: string;
};

/**
 * Completa a folha: um item por modelo aplicável e um por fatura com valor,
 * pulando o que já existe (`(folha, template)` / `(folha, fatura)` são únicos
 * no banco — é isso que torna o top-up idempotente).
 */
async function topUpSheet(
  ownership: Ownership,
  sheet: SheetRow,
): Promise<string | null> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sheet_items")
    .select("template_id, statement_id")
    .eq("sheet_id", sheet.id);

  if (existingError) {
    return toUserMessage(
      existingError,
      "Não foi possível montar a folha. Tente de novo.",
    );
  }

  const existingTemplateIds = new Set(
    (existing ?? [])
      .map((item) => item.template_id)
      .filter((id): id is string => id !== null),
  );
  const existingStatementIds = new Set(
    (existing ?? [])
      .map((item) => item.statement_id)
      .filter((id): id is string => id !== null),
  );

  const { ownerUserId, householdId } = ownershipForScope(
    ownership.scope,
    ownership.userId,
    ownership.householdId,
  );

  const rows: NewSheetItem[] = [];

  // 1) Modelos recorrentes aplicáveis, com o valor sugerido pelo mês anterior.
  const { templates, error: templatesError } =
    await listRecurringTemplates(ownership);

  if (templatesError) {
    return templatesError;
  }

  const applicable = templates.filter(
    (template) =>
      template.active &&
      templateAppliesToMonth(template, sheet.reference_month) &&
      !existingTemplateIds.has(template.id),
  );

  if (applicable.length > 0) {
    const previousSheet = await findSheetRow(
      ownership,
      shiftMonth(sheet.reference_month, -1),
    );
    const previousByTemplateId = new Map<
      string,
      { expectedCents: number; actualCents: number | null }
    >();

    if (previousSheet.row) {
      const { data: previousItems } = await supabase
        .from("sheet_items")
        .select("template_id, expected_cents, actual_cents")
        .eq("sheet_id", previousSheet.row.id)
        .in(
          "template_id",
          applicable.map((template) => template.id),
        );

      for (const item of previousItems ?? []) {
        if (item.template_id && !previousByTemplateId.has(item.template_id)) {
          previousByTemplateId.set(item.template_id, {
            expectedCents: item.expected_cents,
            actualCents: item.actual_cents,
          });
        }
      }
    }

    for (const template of applicable) {
      rows.push({
        sheet_id: sheet.id,
        scope: ownership.scope,
        owner_user_id: ownerUserId,
        household_id: householdId,
        source: "template",
        template_id: template.id,
        statement_id: null,
        name: template.name,
        expected_cents: suggestedExpectedCents(
          previousByTemplateId.get(template.id) ?? null,
          template.defaultAmountCents,
        ),
        due_date: dateInMonth(sheet.reference_month, template.dueDay),
        payer_user_id: template.payerUserId,
        created_by: ownership.userId,
      });
    }
  }

  // 2) Faturas do mês **com valor** — sem valor não vira item (não polui a
  // folha com R$ 0,00; se a compra chegar depois, o próximo abrir completa).
  const { statements, error: statementsError } = await listStatementsForMonths(
    ownership,
    [sheet.reference_month],
  );

  if (statementsError) {
    return statementsError;
  }

  const withValue = statements.filter(
    (statement) =>
      (statement.calculatedCents > 0 || statement.actualCents !== null) &&
      !existingStatementIds.has(statement.id),
  );

  if (withValue.length > 0) {
    const { cards } = await listCreditCards(ownership);
    const cardNameById = new Map(cards.map((card) => [card.id, card.name]));

    for (const statement of withValue) {
      const cardName = cardNameById.get(statement.cardId);

      rows.push({
        sheet_id: sheet.id,
        scope: ownership.scope,
        owner_user_id: ownerUserId,
        household_id: householdId,
        source: "statement",
        template_id: null,
        statement_id: statement.id,
        name: cardName ? `Fatura ${cardName}` : "Fatura do cartão",
        expected_cents: statement.calculatedCents,
        due_date: statement.dueDate,
        // Quem está montando a folha da família assume a fatura como sua até
        // alguém trocar o pagador (fase 7).
        payer_user_id:
          ownership.scope === "household" ? ownership.userId : null,
        created_by: ownership.userId,
      });
    }
  }

  if (rows.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase
    .from("sheet_items")
    .insert(rows);

  // 23505 = outra gravação montou a mesma folha na corrida; o resultado que a
  // pessoa queria já está lá.
  if (insertError && insertError.code !== "23505") {
    return toUserMessage(
      insertError,
      "Não foi possível montar a folha. Tente de novo.",
    );
  }

  return null;
}

/**
 * Abre a folha do mês: garante a linha (congelando a data de fechamento) e
 * completa os itens. Idempotente — é o "ao abrir a folha, o sistema gera" do
 * `PRODUCT.md` §5.4. Folha fechada não gera mais nada (D40).
 */
export async function openSheet(
  ownership: Ownership,
  month: string,
): Promise<{ sheet: MonthSheet | null; error: string | null }> {
  if (!isMonthKey(month)) {
    return { sheet: null, error: "Mês inválido." };
  }

  const supabase = await createClient();

  let { row, error } = await findSheetRow(ownership, month);

  if (error) {
    return { sheet: null, error };
  }

  if (!row) {
    const paydayBusinessDay = await loadPaydayBusinessDay(ownership.userId);
    const { ownerUserId, householdId } = ownershipForScope(
      ownership.scope,
      ownership.userId,
      ownership.householdId,
    );

    const { data: inserted, error: insertError } = await supabase
      .from("month_sheets")
      .insert({
        scope: ownership.scope,
        owner_user_id: ownerUserId,
        household_id: householdId,
        created_by: ownership.userId,
        reference_month: month,
        planned_close_date: plannedCloseDate(month, paydayBusinessDay),
      })
      .select(SHEET_COLUMNS)
      .single();

    if (insertError || !inserted) {
      // Corrida: outra gravação criou a folha entre o select e o insert.
      if (insertError?.code === "23505") {
        ({ row, error } = await findSheetRow(ownership, month));

        if (error || !row) {
          return {
            sheet: null,
            error: "Não foi possível abrir a folha. Tente de novo.",
          };
        }
      } else {
        return {
          sheet: null,
          error: toUserMessage(
            insertError,
            "Não foi possível abrir a folha. Tente de novo.",
          ),
        };
      }
    } else {
      row = inserted;
    }
  }

  if (row.status === "open") {
    const topUpError = await topUpSheet(ownership, row);

    if (topUpError) {
      return { sheet: null, error: topUpError };
    }
  }

  return { sheet: toMonthSheet(row), error: null };
}

/**
 * A folha do mês com os itens prontos para a tela.
 *
 * Nos itens de fatura, os números são **mesclados** do `statement` (D38): o que
 * a folha mostra é o que a tela da fatura mostra. `carriedToItemId` aponta a
 * cópia quando este item foi levado adiante; `carriedFromItemId`, quando ele
 * veio de outro mês.
 */
export async function listSheet(
  ownership: Ownership,
  month: string,
): Promise<{
  sheet: MonthSheet | null;
  items: SheetItemView[];
  error: string | null;
}> {
  const { row: sheetRow, error: sheetError } = await findSheetRow(
    ownership,
    month,
  );

  if (sheetError) {
    return { sheet: null, items: [], error: sheetError };
  }

  if (!sheetRow) {
    return { sheet: null, items: [], error: null };
  }

  const supabase = await createClient();

  const { data: itemRows, error: itemsError } = await supabase
    .from("sheet_items")
    .select(ITEM_COLUMNS)
    .eq("sheet_id", sheetRow.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (itemsError) {
    return {
      sheet: null,
      items: [],
      error: toUserMessage(itemsError, "Não foi possível carregar a folha."),
    };
  }

  const rows: ItemRow[] = itemRows ?? [];
  const ids = rows.map((item) => item.id);

  // Fatias com valor vivo (fonte dos itens de fatura) + nomes dos cartões.
  const statementIds = rows
    .map((item) => item.statement_id)
    .filter((id): id is string => id !== null);

  const { statements, error: statementsError } =
    await listStatementsByIds(statementIds);

  if (statementsError) {
    return { sheet: null, items: [], error: statementsError };
  }

  const statementById = new Map(
    statements.map((statement) => [statement.id, statement]),
  );

  const cardNameById = new Map<string, string>();

  if (statementIds.length > 0) {
    const { cards } = await listCreditCards(ownership);

    for (const card of cards) {
      cardNameById.set(card.id, card.name);
    }
  }

  // Quem foi levado adiante: a cópia aponta para o item original.
  const carriedToItemId = new Map<string, string>();

  if (ids.length > 0) {
    const { data: successors } = await supabase
      .from("sheet_items")
      .select("id, carried_from_item_id")
      .in("carried_from_item_id", ids);

    for (const successor of successors ?? []) {
      if (successor.carried_from_item_id) {
        carriedToItemId.set(successor.carried_from_item_id, successor.id);
      }
    }
  }

  const items: SheetItemView[] = rows.map((item) => {
    const statement = item.statement_id
      ? (statementById.get(item.statement_id) ?? null)
      : null;

    return {
      id: item.id,
      source:
        item.source === "statement"
          ? "statement"
          : item.source === "template"
            ? "template"
            : "one_off",
      name: item.name,
      expectedCents: item.expected_cents,
      // D38: no item de fatura os números vêm do statement; o resto usa a
      // própria linha.
      actualCents: statement ? statement.actualCents : item.actual_cents,
      paidCents: statement ? statement.paidCents : item.paid_cents,
      dueDate: item.due_date,
      payerUserId: item.payer_user_id,
      paidAt: statement ? statement.paidAt : item.paid_at,
      templateId: item.template_id,
      statementId: item.statement_id,
      carriedFromItemId: item.carried_from_item_id,
      carriedToItemId: carriedToItemId.get(item.id) ?? null,
      statement: statement
        ? {
            id: statement.id,
            cardName: cardNameById.get(statement.cardId) ?? null,
            calculatedCents: statement.calculatedCents,
            effectiveCents: statement.effectiveCents,
            actualCents: statement.actualCents,
          }
        : null,
    };
  });

  return { sheet: toMonthSheet(sheetRow), items, error: null };
}

/** Os modelos recorrentes do escopo ativo (a tela de fixas usa na fase 7). */
export async function listRecurringTemplates(
  ownership: Ownership,
): Promise<{ templates: RecurringTemplate[]; error: string | null }> {
  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("recurring_templates")
          .select(TEMPLATE_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("recurring_templates")
          .select(TEMPLATE_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered.order("name", { ascending: true });

  if (error) {
    return {
      templates: [],
      error: toUserMessage(error, "Não foi possível carregar as contas fixas."),
    };
  }

  return { templates: (data ?? []).map(toTemplate), error: null };
}
