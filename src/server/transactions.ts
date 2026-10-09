import {
  installmentStatementMonth,
  splitInstallments,
} from "@/domain/installments";
import {
  ownershipForScope,
  parseScope,
  type Ownership,
  type Scope,
} from "@/domain/scope";
import { resolveStatementMonth } from "@/domain/statement";
import { createClient } from "@/lib/supabase/server";

import { toUserMessage } from "./errors";
import { ensureStatementsForMonths } from "./statements";

/**
 * Lançamentos — camada de acesso a dados.
 *
 * Mesmo desenho dos outros módulos: o RLS decide o que é visível (`DOMAIN.md`
 * §3.3), e as funções aqui filtram por escopo apenas para a tela não receber o
 * que não vai mostrar.
 */

/** Campos que a tela preenche. Dono e escopo vêm de `ownershipForScope`. */
export type TransactionValues = {
  description: string;
  categoryId: string | null;
  totalCents: number;
  occurredOn: string;
  paymentMethod: string;
  accountId: string | null;
  cardId: string | null;
  installmentsCount: number;
  notes: string | null;
};

export type Transaction = TransactionValues & {
  id: string;
  scope: Scope;
};

const TRANSACTION_COLUMNS =
  "id, scope, description, category_id, total_cents, occurred_on, payment_method, account_id, card_id, installments_count, notes";

/** Converte a linha do banco no que a tela consome (snake_case → camelCase). */
function toTransaction(row: {
  id: string;
  scope: string;
  description: string;
  category_id: string | null;
  total_cents: number;
  occurred_on: string;
  payment_method: string;
  account_id: string | null;
  card_id: string | null;
  installments_count: number;
  notes: string | null;
}): Transaction {
  return {
    id: row.id,
    // A conversão defensiva é a mesma do cookie: sem `as` que só cala o tipo.
    scope: row.scope === "household" ? "household" : "personal",
    description: row.description,
    categoryId: row.category_id,
    totalCents: row.total_cents,
    occurredOn: row.occurred_on,
    paymentMethod: row.payment_method,
    accountId: row.account_id,
    cardId: row.card_id,
    installmentsCount: row.installments_count,
    notes: row.notes,
  };
}

/**
 * Lista os lançamentos do escopo ativo num intervalo de datas.
 *
 * O intervalo chega pronto (`from` e `to`, datas ISO) porque calcular "o mês"
 * no fuso certo é assunto de quem mostra — e essa conta entra na tela da lista,
 * não aqui.
 */
export async function listTransactionsBetween(
  ownership: Ownership,
  from: string,
  to: string,
): Promise<{ transactions: Transaction[]; error: string | null }> {
  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("transactions")
          .select(TRANSACTION_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("transactions")
          .select(TRANSACTION_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      transactions: [],
      error: toUserMessage(error, "Não foi possível carregar os lançamentos."),
    };
  }

  return { transactions: (data ?? []).map(toTransaction), error: null };
}

/** Busca um lançamento pelo id. Devolve `null` quando não é visível. */
export async function getTransaction(
  transactionId: string,
): Promise<{ transaction: Transaction | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("id", transactionId)
    .maybeSingle();

  if (error) {
    return {
      transaction: null,
      error: toUserMessage(error, "Não foi possível carregar o lançamento."),
    };
  }

  return { transaction: data ? toTransaction(data) : null, error: null };
}

/** Uma parcela planejada: em que número, em que fatura e por quanto. */
type PlannedInstallment = {
  number: number;
  month: string;
  amountCents: number;
};

type CreditPlan = {
  card: { id: string; closingDay: number; dueDay: number };
  installments: PlannedInstallment[];
};

/**
 * Monta o plano de parcelas de uma compra no crédito: divide o valor
 * (`splitInstallments`, §4.2) e resolve em que fatura cada parcela cai
 * (`resolveStatementMonth` + `installmentStatementMonth`, §4.1).
 *
 * Roda **antes** de gravar qualquer coisa: valor que não divide vira erro sem
 * deixar lançamento pela metade.
 */
async function loadCreditPlan(
  cardId: string,
  totalCents: number,
  occurredOn: string,
  installmentsCount: number,
): Promise<{ plan: CreditPlan | null; error: string | null }> {
  const amounts = splitInstallments(totalCents, installmentsCount);

  if (!amounts) {
    return {
      plan: null,
      error: "Este valor não se divide em tantas parcelas.",
    };
  }

  const supabase = await createClient();

  const { data: card, error } = await supabase
    .from("credit_cards")
    .select("id, closing_day, due_day")
    .eq("id", cardId)
    .maybeSingle();

  if (error || !card) {
    return {
      plan: null,
      error: "Não foi possível carregar o cartão. Tente de novo.",
    };
  }

  const firstMonth = resolveStatementMonth(occurredOn, card.closing_day);
  const installments: PlannedInstallment[] = [];

  for (let number = 1; number <= installmentsCount; number += 1) {
    const month = installmentStatementMonth(firstMonth, number);
    const amountCents = amounts[number - 1];

    if (!month || amountCents === undefined) {
      return {
        plan: null,
        error: "Este valor não se divide em tantas parcelas.",
      };
    }

    installments.push({ number, month, amountCents });
  }

  return {
    plan: {
      card: {
        id: card.id,
        closingDay: card.closing_day,
        dueDay: card.due_day,
      },
      installments,
    },
    error: null,
  };
}

/** Garante as faturas do plano e grava as parcelas do lançamento. */
async function writeInstallments(
  ownership: Ownership,
  transactionId: string,
  plan: CreditPlan,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { statementIdByMonth, error: statementsError } =
    await ensureStatementsForMonths(
      ownership,
      plan.card,
      plan.installments.map((installment) => installment.month),
    );

  if (statementsError || !statementIdByMonth) {
    return {
      error:
        statementsError ?? "Não foi possível abrir a fatura. Tente de novo.",
    };
  }

  const { ownerUserId, householdId } = ownershipForScope(
    ownership.scope,
    ownership.userId,
    ownership.householdId,
  );

  const rows = [];

  for (const installment of plan.installments) {
    const statementId = statementIdByMonth.get(installment.month);

    if (!statementId) {
      return { error: "Não foi possível abrir a fatura. Tente de novo." };
    }

    rows.push({
      scope: ownership.scope,
      owner_user_id: ownerUserId,
      household_id: householdId,
      created_by: ownership.userId,
      transaction_id: transactionId,
      statement_id: statementId,
      number: installment.number,
      amount_cents: installment.amountCents,
    });
  }

  const { error } = await supabase.from("card_installments").insert(rows);

  if (error) {
    return {
      error: toUserMessage(
        error,
        "Não foi possível gravar as parcelas. Tente de novo.",
      ),
    };
  }

  return { error: null };
}

/**
 * Procura parcela deste lançamento em fatura já paga (§4.2).
 *
 * Duas consultas simples, sem join embutido: são leves e o tipo fica legível.
 */
async function findPaidInstallment(
  transactionId: string,
): Promise<{ paid: boolean; error: string | null }> {
  const supabase = await createClient();

  const { data: installments, error } = await supabase
    .from("card_installments")
    .select("statement_id")
    .eq("transaction_id", transactionId);

  if (error) {
    return {
      paid: false,
      error: toUserMessage(
        error,
        "Não foi possível verificar as parcelas. Tente de novo.",
      ),
    };
  }

  const statementIds = (installments ?? []).map((row) => row.statement_id);

  if (statementIds.length === 0) {
    return { paid: false, error: null };
  }

  const { data: paidStatements, error: paidError } = await supabase
    .from("statements")
    .select("id")
    .in("id", statementIds)
    .gt("paid_cents", 0)
    .limit(1);

  if (paidError) {
    return {
      paid: false,
      error: toUserMessage(
        paidError,
        "Não foi possível verificar as parcelas. Tente de novo.",
      ),
    };
  }

  return { paid: (paidStatements ?? []).length > 0, error: null };
}

/** Cria o lançamento no escopo pedido. */
export async function createTransaction(
  ownership: Ownership,
  values: TransactionValues,
): Promise<{ id: string | null; error: string | null }> {
  // O plano de parcelas sai antes de qualquer gravação: nada para compensar se
  // o valor não dividir.
  let plan: CreditPlan | null = null;

  if (values.paymentMethod === "credit" && values.cardId) {
    const loaded = await loadCreditPlan(
      values.cardId,
      values.totalCents,
      values.occurredOn,
      values.installmentsCount,
    );

    if (loaded.error || !loaded.plan) {
      return {
        id: null,
        error:
          loaded.error ?? "Não foi possível gravar as parcelas. Tente de novo.",
      };
    }

    plan = loaded.plan;
  }

  const supabase = await createClient();

  const { ownerUserId, householdId } = ownershipForScope(
    ownership.scope,
    ownership.userId,
    ownership.householdId,
  );

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      scope: ownership.scope,
      owner_user_id: ownerUserId,
      household_id: householdId,
      created_by: ownership.userId,
      description: values.description,
      category_id: values.categoryId,
      total_cents: values.totalCents,
      occurred_on: values.occurredOn,
      payment_method: values.paymentMethod,
      account_id: values.accountId,
      card_id: values.cardId,
      installments_count: values.installmentsCount,
      notes: values.notes,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      id: null,
      error: toUserMessage(
        error,
        "Não foi possível salvar o lançamento. Tente de novo.",
      ),
    };
  }

  // Compra no crédito nasce com faturas e parcelas (Fatia 4). Se as parcelas
  // não conseguirem ser gravadas, o lançamento não fica órfão: sai junto.
  if (plan) {
    const { error: installmentsError } = await writeInstallments(
      ownership,
      data.id,
      plan,
    );

    if (installmentsError) {
      await supabase.from("transactions").delete().eq("id", data.id);
      return { id: null, error: installmentsError };
    }
  }

  return { id: data.id, error: null };
}

/** Atualiza os campos do lançamento. Dono e escopo não mudam (o banco recusaria). */
export async function updateTransaction(
  ownership: Ownership,
  transactionId: string,
  values: TransactionValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("transactions")
    .select(
      "scope, household_id, payment_method, total_cents, occurred_on, card_id, installments_count",
    )
    .eq("id", transactionId)
    .maybeSingle();

  if (currentError) {
    return {
      error: toUserMessage(
        currentError,
        "Não foi possível carregar o lançamento. Tente de novo.",
      ),
    };
  }

  if (!current) {
    return { error: "Este lançamento não existe mais." };
  }

  const touchesCredit =
    current.payment_method === "credit" || values.paymentMethod === "credit";

  // §4.2: parcela em fatura paga não muda sem confirmação explícita — e ainda
  // não existe esse "confirmar" na tela, então a resposta é não.
  if (touchesCredit) {
    const guard = await findPaidInstallment(transactionId);

    if (guard.error) {
      return { error: guard.error };
    }

    if (guard.paid) {
      return {
        error:
          "Este lançamento tem parcelas em fatura já paga. Ajuste a fatura antes de mudar o lançamento.",
      };
    }
  }

  // O plano novo sai antes de qualquer gravação: valor que não divide não
  // pode deixar o lançamento meio atualizado.
  let plan: CreditPlan | null = null;

  if (values.paymentMethod === "credit" && values.cardId) {
    const loaded = await loadCreditPlan(
      values.cardId,
      values.totalCents,
      values.occurredOn,
      values.installmentsCount,
    );

    if (loaded.error || !loaded.plan) {
      return {
        error:
          loaded.error ?? "Não foi possível gravar as parcelas. Tente de novo.",
      };
    }

    plan = loaded.plan;
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      description: values.description,
      category_id: values.categoryId,
      total_cents: values.totalCents,
      occurred_on: values.occurredOn,
      payment_method: values.paymentMethod,
      account_id: values.accountId,
      card_id: values.cardId,
      installments_count: values.installmentsCount,
      notes: values.notes,
    })
    .eq("id", transactionId)
    .select("id");

  if (error) {
    return {
      error: toUserMessage(
        error,
        "Não foi possível salvar o lançamento. Tente de novo.",
      ),
    };
  }

  // Sem linhas, a RLS barrou ou o lançamento já não existe — as duas coisas
  // são "não existe mais" para quem está olhando a tela.
  if (!data || data.length === 0) {
    return { error: "Este lançamento não existe mais." };
  }

  // As parcelas acompanham o lançamento: apaga as antigas (nenhuma paga, pelo
  // guarda acima) e grava o plano novo; sem crédito, só apaga. Se a gravação
  // falhar aqui, repetir a edição reconstrói — o caminho é idempotente.
  const { error: deleteError } = await supabase
    .from("card_installments")
    .delete()
    .eq("transaction_id", transactionId);

  if (deleteError) {
    return {
      error: toUserMessage(
        deleteError,
        "Não foi possível ajustar as parcelas. Tente de novo.",
      ),
    };
  }

  if (plan) {
    // As parcelas nascem no escopo do **próprio lançamento**, não no escopo
    // ativo: editar uma compra da família com o escopo pessoal selecionado
    // continua produzindo parcelas da família (o assert do banco exigiria).
    const transactionOwnership: Ownership = {
      scope: parseScope(current.scope),
      userId: ownership.userId,
      householdId: current.household_id ?? "",
    };

    const { error: installmentsError } = await writeInstallments(
      transactionOwnership,
      transactionId,
      plan,
    );

    if (installmentsError) {
      return { error: installmentsError };
    }
  }

  return { error: null };
}

/** Apaga o lançamento. Idempotente: apagar o que já sumiu não é problema. */
export async function deleteTransaction(
  transactionId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // §4.2 de novo: o cascade levaria as parcelas junto e mudaria uma fatura já
  // paga. Sem "confirmar" na tela, a resposta é não.
  const guard = await findPaidInstallment(transactionId);

  if (guard.error) {
    return { error: guard.error };
  }

  if (guard.paid) {
    return {
      error:
        "Este lançamento tem parcelas em fatura já paga. Ajuste a fatura antes de apagar o lançamento.",
    };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);

  return {
    error: toUserMessage(
      error,
      "Não foi possível apagar o lançamento. Tente de novo.",
    ),
  };
}
