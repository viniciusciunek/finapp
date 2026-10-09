import { ownershipForScope, parseScope, type Scope } from "@/domain/scope";
import { isUuid } from "@/domain/uuid";
import { createClient } from "@/lib/supabase/server";

import { toUserMessage } from "./errors";

/**
 * Contas — camada de acesso a dados.
 *
 * Como em `households.ts`: as páginas e Server Actions chamam estas funções e
 * nunca falam com o Supabase direto.
 *
 * E, como lá, **autorização não mora aqui**: quem decide o que cada um vê é o
 * RLS (`DOMAIN.md` §3.3). As funções filtram por escopo para a tela receber só
 * o que vai mostrar — isso é conveniência, não proteção.
 */

/** Campos que a tela preenche. Dono e escopo vêm de `ownershipForScope`. */
export type AccountValues = {
  name: string;
  bank: string | null;
  type: string;
};

export type Account = AccountValues & {
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
const ACCOUNT_COLUMNS = "id, scope, name, bank, type";

/** Converte a linha do banco no que a tela consome. */
function toAccount(row: {
  id: string;
  scope: string;
  name: string;
  bank: string | null;
  type: string;
}): Account {
  return {
    id: row.id,
    // `parseScope` é a mesma função que valida o cookie: o valor do banco passa
    // pela mesma conversão defensiva, em vez de um `as` que só cala o TypeScript.
    scope: parseScope(row.scope),
    name: row.name,
    bank: row.bank,
    type: row.type,
  };
}

/** Lista as contas do escopo ativo, em ordem alfabética. */
export async function listAccounts(
  ownership: Ownership,
): Promise<{ accounts: Account[]; error: string | null }> {
  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("accounts")
          .select(ACCOUNT_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("accounts")
          .select(ACCOUNT_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered.order("name");

  if (error) {
    return {
      accounts: [],
      error: toUserMessage(error, "Não foi possível carregar as contas."),
    };
  }

  return { accounts: (data ?? []).map(toAccount), error: null };
}

/** Busca uma conta pelo id. Devolve `null` quando ela não é visível. */
export async function getAccount(
  accountId: string,
): Promise<{ account: Account | null; error: string | null }> {
  // Id que nem tem forma de id é "não encontrada" — e não um erro de cast do
  // Postgres, que faria a tela mentir sobre o motivo (`isUuid`).
  if (!isUuid(accountId)) {
    return { account: null, error: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    return {
      account: null,
      error: toUserMessage(error, "Não foi possível carregar a conta."),
    };
  }

  return { account: data ? toAccount(data) : null, error: null };
}

/** Cria a conta no escopo pedido. */
export async function createAccount(
  ownership: Ownership,
  values: AccountValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { ownerUserId, householdId } = ownershipForScope(
    ownership.scope,
    ownership.userId,
    ownership.householdId,
  );

  const { error } = await supabase.from("accounts").insert({
    scope: ownership.scope,
    owner_user_id: ownerUserId,
    household_id: householdId,
    created_by: ownership.userId,
    name: values.name,
    bank: values.bank,
    type: values.type,
  });

  return {
    error: toUserMessage(
      error,
      "Não foi possível criar a conta. Tente de novo.",
    ),
  };
}

/** Atualiza nome, banco e tipo. Dono e escopo não mudam (o banco recusaria). */
export async function updateAccount(
  accountId: string,
  values: AccountValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name: values.name,
      bank: values.bank,
      type: values.type,
    })
    .eq("id", accountId)
    .select("id");

  if (error) {
    return {
      error: toUserMessage(
        error,
        "Não foi possível salvar a conta. Tente de novo.",
      ),
    };
  }

  // A RLS não deixa atualizar o que não é visível — e nesse caso o banco não
  // devolve erro: devolve **zero linhas**. Sem esta checagem, a tela diria
  // "salvo" para uma conta que não existe (ou que é de outra pessoa).
  if (!data || data.length === 0) {
    return { error: "Esta conta não existe mais." };
  }

  return { error: null };
}

/** Apaga a conta. Idempotente: apagar o que já sumiu não é problema. */
export async function deleteAccount(
  accountId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId);

  return {
    error: toUserMessage(
      error,
      "Não foi possível apagar a conta. Tente de novo.",
    ),
  };
}
