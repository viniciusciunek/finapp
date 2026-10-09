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
