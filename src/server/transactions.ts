import { ownershipForScope, type Scope } from "@/domain/scope";
import { createClient } from "@/lib/supabase/server";

import type { Ownership } from "./accounts";
import { toUserMessage } from "./errors";

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

/** Cria o lançamento no escopo pedido. */
export async function createTransaction(
  ownership: Ownership,
  values: TransactionValues,
): Promise<{ id: string | null; error: string | null }> {
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

  return { id: data.id, error: null };
}

/** Atualiza os campos do lançamento. Dono e escopo não mudam (o banco recusaria). */
export async function updateTransaction(
  transactionId: string,
  values: TransactionValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

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

  return { error: null };
}

/** Apaga o lançamento. Idempotente: apagar o que já sumiu não é problema. */
export async function deleteTransaction(
  transactionId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

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
