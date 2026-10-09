import { ownershipForScope, parseScope, type Scope } from "@/domain/scope";
import { createClient } from "@/lib/supabase/server";

import { toUserMessage } from "./errors";

/**
 * Cartões de crédito — camada de acesso a dados.
 *
 * Mesmo desenho de `accounts.ts` (e pelas mesmas razões): a tela chama estas
 * funções, o RLS decide as linhas e o escopo só filtra o que será exibido.
 *
 * O dia de fechamento e o de vencimento são **dias do mês** (1 a 31), não
 * datas: o que fazer quando o mês é mais curto é regra do cálculo da fatura
 * (Fatia 4). Aqui eles são só cadastro.
 */

/** Campos que a tela preenche. Dono e escopo vêm de `ownershipForScope`. */
export type CardValues = {
  name: string;
  closingDay: number;
  dueDay: number;
  limitCents: number | null;
};

export type CreditCard = CardValues & {
  id: string;
  scope: Scope;
};

/** Quem está pedindo: o escopo ativo e as duas referências possíveis. */
export type Ownership = {
  scope: Scope;
  userId: string;
  householdId: string;
};

/** Só as colunas que a tela usa — o resto da linha não sai do banco à toa. */
const CARD_COLUMNS = "id, scope, name, closing_day, due_day, limit_cents";

/** Converte a linha do banco no que a tela consome. */
function toCreditCard(row: {
  id: string;
  scope: string;
  name: string;
  closing_day: number;
  due_day: number;
  limit_cents: number | null;
}): CreditCard {
  return {
    id: row.id,
    // Mesma conversão defensiva do cookie (`parseScope`), em vez de um `as`.
    scope: parseScope(row.scope),
    name: row.name,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    limitCents: row.limit_cents,
  };
}

/** Lista os cartões do escopo ativo, em ordem alfabética. */
export async function listCreditCards(
  ownership: Ownership,
): Promise<{ cards: CreditCard[]; error: string | null }> {
  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("credit_cards")
          .select(CARD_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("credit_cards")
          .select(CARD_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered.order("name");

  if (error) {
    return {
      cards: [],
      error: toUserMessage(error, "Não foi possível carregar os cartões."),
    };
  }

  return { cards: (data ?? []).map(toCreditCard), error: null };
}

/** Busca um cartão pelo id. Devolve `null` quando ele não é visível. */
export async function getCreditCard(
  cardId: string,
): Promise<{ card: CreditCard | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("credit_cards")
    .select(CARD_COLUMNS)
    .eq("id", cardId)
    .maybeSingle();

  if (error) {
    return {
      card: null,
      error: toUserMessage(error, "Não foi possível carregar o cartão."),
    };
  }

  return { card: data ? toCreditCard(data) : null, error: null };
}

/** Cria o cartão no escopo pedido. */
export async function createCreditCard(
  ownership: Ownership,
  values: CardValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { ownerUserId, householdId } = ownershipForScope(
    ownership.scope,
    ownership.userId,
    ownership.householdId,
  );

  const { error } = await supabase.from("credit_cards").insert({
    scope: ownership.scope,
    owner_user_id: ownerUserId,
    household_id: householdId,
    created_by: ownership.userId,
    name: values.name,
    closing_day: values.closingDay,
    due_day: values.dueDay,
    limit_cents: values.limitCents,
  });

  return {
    error: toUserMessage(
      error,
      "Não foi possível criar o cartão. Tente de novo.",
    ),
  };
}

/** Atualiza nome, dias e limite. Dono e escopo não mudam (o banco recusaria). */
export async function updateCreditCard(
  cardId: string,
  values: CardValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("credit_cards")
    .update({
      name: values.name,
      closing_day: values.closingDay,
      due_day: values.dueDay,
      limit_cents: values.limitCents,
    })
    .eq("id", cardId)
    .select("id");

  if (error) {
    return {
      error: toUserMessage(
        error,
        "Não foi possível salvar o cartão. Tente de novo.",
      ),
    };
  }

  // Ver a nota em `updateAccount`: zero linhas significa "não é visível para
  // você" (ou não existe), e o banco não trata isso como erro.
  if (!data || data.length === 0) {
    return { error: "Este cartão não existe mais." };
  }

  return { error: null };
}

/** Apaga o cartão. Idempotente: apagar o que já sumiu não é problema. */
export async function deleteCreditCard(
  cardId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("credit_cards")
    .delete()
    .eq("id", cardId);

  return {
    error: toUserMessage(
      error,
      "Não foi possível apagar o cartão. Tente de novo.",
    ),
  };
}
