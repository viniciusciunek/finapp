import { isCents } from "@/domain/money";
import { ownershipForScope, type Ownership } from "@/domain/scope";
import { statementDates } from "@/domain/statement";
import { createClient } from "@/lib/supabase/server";

import { toUserMessage } from "./errors";

/**
 * Faturas — camada de acesso a dados.
 *
 * Como nos outros módulos: **autorização não mora aqui**; quem decide o que
 * cada pessoa vê é o RLS (`DOMAIN.md` §3.3). As funções filtram por escopo para
 * a tela receber só o que vai mostrar.
 *
 * `calculated_cents` não existe no banco (`DOMAIN.md` §2): é a soma das
 * parcelas, feita aqui na leitura — assim nunca desencontra delas. O que vale
 * para pagar é o `effectiveCents = coalesce(actual, calculated)` (§4.3).
 */

export type StatementSummary = {
  id: string;
  cardId: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  actualCents: number | null;
  paidCents: number;
  paidAt: string | null;
  paidFromAccountId: string | null;
  status: string;
  /** Soma das parcelas (`DOMAIN.md` §4.3) — derivada, nunca gravada. */
  calculatedCents: number;
  /** O que vale para pagar: real, se informado; senão, o calculado. */
  effectiveCents: number;
  /** §4.3: real − calculado; `null` enquanto o real não foi informado. */
  unloggedCents: number | null;
};

const STATEMENT_COLUMNS =
  "id, card_id, reference_month, closing_date, due_date, actual_cents, paid_cents, paid_at, paid_from_account_id, status";

type StatementRow = {
  id: string;
  card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  actual_cents: number | null;
  paid_cents: number;
  paid_at: string | null;
  paid_from_account_id: string | null;
  status: string;
};

function toSummary(
  row: StatementRow,
  calculatedCents: number,
): StatementSummary {
  return {
    id: row.id,
    cardId: row.card_id,
    referenceMonth: row.reference_month,
    closingDate: row.closing_date,
    dueDate: row.due_date,
    actualCents: row.actual_cents,
    paidCents: row.paid_cents,
    paidAt: row.paid_at,
    paidFromAccountId: row.paid_from_account_id,
    status: row.status,
    calculatedCents,
    // §4.3: o efetivo é o real quando existe; sem real, o calculado.
    effectiveCents: row.actual_cents ?? calculatedCents,
    unloggedCents:
      row.actual_cents === null ? null : row.actual_cents - calculatedCents,
  };
}

/**
 * Garante que existem faturas para o cartão nos meses pedidos, criando as que
 * faltarem (`DOMAIN.md` §4.1: "Se a fatura ainda não existir, criar
 * automaticamente").
 *
 * As datas vêm de `statementDates` (fechamento no mês de referência, venci-
 * mento no seguinte; dia 31 em mês curto vale o último dia). A corrida de duas
 * gravações simultâneas termina no índice único `(card_id, reference_month)`:
 * quem perde re-seleciona e segue.
 */
export async function ensureStatementsForMonths(
  ownership: Ownership,
  card: { id: string; closingDay: number; dueDay: number },
  months: readonly string[],
): Promise<{
  statementIdByMonth: Map<string, string> | null;
  error: string | null;
}> {
  const uniqueMonths = [...new Set(months)];

  if (uniqueMonths.length === 0) {
    return { statementIdByMonth: new Map(), error: null };
  }

  const supabase = await createClient();

  async function selectExisting(): Promise<Map<string, string>> {
    const { data } = await supabase
      .from("statements")
      .select("id, reference_month")
      .eq("card_id", card.id)
      .in("reference_month", uniqueMonths);

    return new Map((data ?? []).map((row) => [row.reference_month, row.id]));
  }

  const existing = await selectExisting();
  const missing = uniqueMonths.filter((month) => !existing.has(month));

  if (missing.length > 0) {
    const { ownerUserId, householdId } = ownershipForScope(
      ownership.scope,
      ownership.userId,
      ownership.householdId,
    );

    const { error } = await supabase.from("statements").insert(
      missing.map((month) => {
        const dates = statementDates(month, card.closingDay, card.dueDay);

        return {
          scope: ownership.scope,
          owner_user_id: ownerUserId,
          household_id: householdId,
          created_by: ownership.userId,
          card_id: card.id,
          reference_month: month,
          closing_date: dates.closingDate,
          due_date: dates.dueDate,
        };
      }),
    );

    // 23505 = outra gravação criou a mesma fatura na corrida; re-selecionar
    // resolve. Qualquer outro erro é erro de verdade.
    if (error && error.code !== "23505") {
      return {
        statementIdByMonth: null,
        error: toUserMessage(
          error,
          "Não foi possível abrir a fatura. Tente de novo.",
        ),
      };
    }

    const refreshed = await selectExisting();

    if (uniqueMonths.some((month) => !refreshed.has(month))) {
      return {
        statementIdByMonth: null,
        error: "Não foi possível abrir a fatura. Tente de novo.",
      };
    }

    return { statementIdByMonth: refreshed, error: null };
  }

  return { statementIdByMonth: existing, error: null };
}

/** Soma das parcelas por fatura — o `calculated` do §4.3. */
async function sumInstallmentsFor(
  statementIds: readonly string[],
): Promise<{ sums: Map<string, number>; error: string | null }> {
  const sums = new Map<string, number>();

  if (statementIds.length === 0) {
    return { sums, error: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("card_installments")
    .select("statement_id, amount_cents")
    .in("statement_id", [...statementIds]);

  if (error) {
    return {
      sums,
      error: toUserMessage(error, "Não foi possível carregar as faturas."),
    };
  }

  for (const row of data ?? []) {
    sums.set(
      row.statement_id,
      (sums.get(row.statement_id) ?? 0) + row.amount_cents,
    );
  }

  return { sums, error: null };
}

/**
 * Faturas do escopo ativo nesses meses, com calculado e efetivo.
 *
 * É o que a tela de contas usa para mostrar a fatura aberta de cada cartão e o
 * que a tela da fatura (fase 5) usa para um mês específico.
 */
export async function listStatementsForMonths(
  ownership: Ownership,
  referenceMonths: readonly string[],
): Promise<{ statements: StatementSummary[]; error: string | null }> {
  const months = [...new Set(referenceMonths)];

  if (months.length === 0) {
    return { statements: [], error: null };
  }

  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("statements")
          .select(STATEMENT_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("statements")
          .select(STATEMENT_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered
    .in("reference_month", months)
    .order("reference_month", { ascending: true });

  if (error) {
    return {
      statements: [],
      error: toUserMessage(error, "Não foi possível carregar as faturas."),
    };
  }

  const rows: StatementRow[] = data ?? [];
  const { sums, error: sumsError } = await sumInstallmentsFor(
    rows.map((row) => row.id),
  );

  if (sumsError) {
    return { statements: [], error: sumsError };
  }

  return {
    statements: rows.map((row) => toSummary(row, sums.get(row.id) ?? 0)),
    error: null,
  };
}

/**
 * Faturas por id, com calculado e efetivo.
 *
 * A folha (Fatia 5) lê por aqui os números dos itens de fatura — a fonte é o
 * `statement` (D38), nunca uma cópia no item.
 */
export async function listStatementsByIds(
  statementIds: readonly string[],
): Promise<{ statements: StatementSummary[]; error: string | null }> {
  const ids = [...new Set(statementIds)];

  if (ids.length === 0) {
    return { statements: [], error: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("statements")
    .select(STATEMENT_COLUMNS)
    .in("id", ids);

  if (error) {
    return {
      statements: [],
      error: toUserMessage(error, "Não foi possível carregar as faturas."),
    };
  }

  const rows: StatementRow[] = data ?? [];
  const { sums, error: sumsError } = await sumInstallmentsFor(
    rows.map((row) => row.id),
  );

  if (sumsError) {
    return { statements: [], error: sumsError };
  }

  return {
    statements: rows.map((row) => toSummary(row, sums.get(row.id) ?? 0)),
    error: null,
  };
}

/** Um lançamento (parcela) que compõe o calculado de uma fatura (§4.3). */
export type StatementItem = {
  installmentNumber: number;
  installmentsCount: number;
  amountCents: number;
  transactionId: string;
  description: string;
  occurredOn: string;
};

/**
 * A fatura de um cartão num mês, com os lançamentos que a compõem.
 *
 * Sem fatura no mês, devolve `statement: null` — a tela mostra "sem fatura",
 * que é diferente de fatura zerada.
 */
export async function getStatementDetail(
  cardId: string,
  referenceMonth: string,
): Promise<{
  statement: StatementSummary | null;
  items: StatementItem[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("statements")
    .select(STATEMENT_COLUMNS)
    .eq("card_id", cardId)
    .eq("reference_month", referenceMonth)
    .maybeSingle();

  if (error) {
    return {
      statement: null,
      items: [],
      error: toUserMessage(error, "Não foi possível carregar a fatura."),
    };
  }

  if (!row) {
    return { statement: null, items: [], error: null };
  }

  const { data: installments, error: itemsError } = await supabase
    .from("card_installments")
    .select(
      "number, amount_cents, transaction_id, transactions(description, occurred_on, installments_count)",
    )
    .eq("statement_id", row.id)
    .order("number", { ascending: true });

  if (itemsError) {
    return {
      statement: null,
      items: [],
      error: toUserMessage(itemsError, "Não foi possível carregar a fatura."),
    };
  }

  const items: StatementItem[] = [];
  let calculatedCents = 0;

  for (const installment of installments ?? []) {
    calculatedCents += installment.amount_cents;

    const transaction = installment.transactions;

    if (!transaction) {
      continue;
    }

    items.push({
      installmentNumber: installment.number,
      installmentsCount: transaction.installments_count,
      amountCents: installment.amount_cents,
      transactionId: installment.transaction_id,
      description: transaction.description,
      occurredOn: transaction.occurred_on,
    });
  }

  return { statement: toSummary(row, calculatedCents), items, error: null };
}

/** Grava (ou limpa, com `null`) o valor real da fatura — §4.3. */
export async function setStatementActualCents(
  statementId: string,
  actualCents: number | null,
): Promise<{ error: string | null }> {
  if (actualCents !== null && (!isCents(actualCents) || actualCents < 0)) {
    return { error: "Confira o valor real da fatura." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("statements")
    .update({ actual_cents: actualCents })
    .eq("id", statementId)
    .select("id");

  if (error) {
    return {
      error: toUserMessage(
        error,
        "Não foi possível salvar o valor real. Tente de novo.",
      ),
    };
  }

  if (!data || data.length === 0) {
    return { error: "Esta fatura não existe mais." };
  }

  return { error: null };
}

/**
 * Registra o pagamento da fatura — §4.3.
 *
 * `paid_cents` é editável: pagamento integral (>= efetivo) vira status `paid`,
 * parcial vira `partial`, e zerar volta a fatura para `open`. O status
 * `closed` (fechada e ainda sem pagamento) é assunto da tela da fatura, que
 * decide o momento de exibir — por ora a coluna fica em `open`.
 *
 * O pagamento **não** mexe em saldo de conta ainda: movimentos de conta são a
 * Fatia 8 (§4.9).
 */
export async function registerStatementPayment(
  statementId: string,
  payment: { paidCents: number; paidFromAccountId: string | null },
): Promise<{ error: string | null }> {
  if (!isCents(payment.paidCents) || payment.paidCents < 0) {
    return { error: "Confira o valor pago." };
  }

  const supabase = await createClient();

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id, actual_cents")
    .eq("id", statementId)
    .maybeSingle();

  if (statementError) {
    return {
      error: toUserMessage(
        statementError,
        "Não foi possível carregar a fatura. Tente de novo.",
      ),
    };
  }

  if (!statement) {
    return { error: "Esta fatura não existe mais." };
  }

  const { sums, error: sumsError } = await sumInstallmentsFor([statementId]);

  if (sumsError) {
    return { error: sumsError };
  }

  const effectiveCents = statement.actual_cents ?? sums.get(statementId) ?? 0;
  const paidCents = payment.paidCents;

  const status =
    paidCents > 0 && paidCents >= effectiveCents
      ? "paid"
      : paidCents > 0
        ? "partial"
        : "open";

  const { data, error } = await supabase
    .from("statements")
    .update({
      paid_cents: paidCents,
      status,
      paid_at: paidCents > 0 ? new Date().toISOString() : null,
      paid_from_account_id: paidCents > 0 ? payment.paidFromAccountId : null,
    })
    .eq("id", statementId)
    .select("id");

  if (error) {
    return {
      error: toUserMessage(
        error,
        "Não foi possível registrar o pagamento. Tente de novo.",
      ),
    };
  }

  if (!data || data.length === 0) {
    return { error: "Esta fatura não existe mais." };
  }

  return { error: null };
}
