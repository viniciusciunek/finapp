import type { Ownership, Scope } from "@/domain/scope";
import { createClient } from "@/lib/supabase/server";

import { toUserMessage } from "./errors";

/**
 * Categorias — camada de acesso a dados.
 *
 * Como nos outros módulos: **autorização não mora aqui**. Quem decide o que
 * cada pessoa vê é o RLS; o filtro por escopo existe para a tela receber só o
 * que vai mostrar.
 */

export type Category = {
  id: string;
  scope: Scope;
  name: string;
};

const CATEGORY_COLUMNS = "id, scope, name";

function toCategory(row: {
  id: string;
  scope: string;
  name: string;
}): Category {
  return {
    id: row.id,
    scope: row.scope === "household" ? "household" : "personal",
    name: row.name,
  };
}

/** Lista as categorias do escopo ativo, em ordem alfabética. */
export async function listCategories(
  ownership: Ownership,
): Promise<{ categories: Category[]; error: string | null }> {
  const supabase = await createClient();

  const filtered =
    ownership.scope === "personal"
      ? supabase
          .from("categories")
          .select(CATEGORY_COLUMNS)
          .eq("owner_user_id", ownership.userId)
      : supabase
          .from("categories")
          .select(CATEGORY_COLUMNS)
          .eq("household_id", ownership.householdId);

  const { data, error } = await filtered.order("name");

  if (error) {
    return {
      categories: [],
      error: toUserMessage(error, "Não foi possível carregar as categorias."),
    };
  }

  return { categories: (data ?? []).map(toCategory), error: null };
}

/**
 * Cria a categoria e devolve o id.
 *
 * Devolve o id porque o formulário de lançamento rápido cria a categoria no
 * meio do preenchimento e precisa continuar dali, com ela já escolhida.
 * Nome repetido no mesmo escopo volta como erro de negócio (23505).
 */
export async function createCategory(
  ownership: Ownership,
  name: string,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      scope: ownership.scope,
      owner_user_id: ownership.scope === "personal" ? ownership.userId : null,
      household_id:
        ownership.scope === "household" ? ownership.householdId : null,
      name,
      created_by: ownership.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      id: null,
      error: toUserMessage(error, "Não foi possível criar a categoria."),
    };
  }

  return { id: data.id, error: null };
}
