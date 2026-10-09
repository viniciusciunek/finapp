/**
 * Escopo da visão do app.
 *
 * - `personal`: o que é só do usuário (contas, cartões, lançamentos e a folha dele);
 * - `household`: o que é compartilhado com a família.
 *
 * O escopo é uma **preferência de navegação** (guardada em cookie), não um dado
 * de negócio. Ainda assim vive aqui, como função pura, por um motivo prático:
 * cookie é entrada controlada pelo usuário — pode chegar qualquer coisa — e
 * essa validação merece teste.
 */

export const SCOPES = ["personal", "household"] as const;

export type Scope = (typeof SCOPES)[number];

/** A visão pessoal é a primeira que o usuário vê ao entrar. */
export const DEFAULT_SCOPE: Scope = "personal";

/** Guarda de tipo: diz se o valor é um escopo válido (não converte nada). */
export function isScope(value: unknown): value is Scope {
  return (
    typeof value === "string" && (SCOPES as readonly string[]).includes(value)
  );
}

/**
 * Converte qualquer entrada (cookie, query string, formulário) em um escopo
 * válido, caindo no padrão quando não reconhece.
 */
export function parseScope(value: unknown): Scope {
  return isScope(value) ? value : DEFAULT_SCOPE;
}

/**
 * Dono de uma linha, a partir do escopo escolhido.
 *
 * Espelha o CHECK de escopo das tabelas que têm escopo (`accounts` e
 * `credit_cards` hoje, as próximas depois): pessoal exige `owner_user_id` e
 * proíbe `household_id`; família exige o contrário. Como o app monta esse par
 * ao criar conta e ao criar cartão, a regra fica aqui — uma vez só, com teste.
 *
 * O banco recusaria o par errado de qualquer forma; isto evita descobrir isso
 * pela mensagem de erro, depois de tentar gravar.
 */
export function ownershipForScope(
  scope: Scope,
  userId: string,
  householdId: string,
): { ownerUserId: string | null; householdId: string | null } {
  return scope === "personal"
    ? { ownerUserId: userId, householdId: null }
    : { ownerUserId: null, householdId };
}
