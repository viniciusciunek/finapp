/**
 * Tipos de conta — onde o dinheiro mora.
 *
 * Espelha o `CHECK (type in (...))` da tabela `accounts`
 * (`supabase/migrations/20261009122953_accounts_and_credit_cards.sql`): se um
 * tipo novo entrar lá, entra aqui também. O valor existe no banco como texto,
 * então a conversão acontece na borda — como em `household.ts`.
 */

export const ACCOUNT_TYPES = ["checking", "savings", "cash"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Guarda de tipo: diz se o valor é um tipo conhecido (não converte). */
export function isAccountType(value: unknown): value is AccountType {
  return (
    typeof value === "string" &&
    (ACCOUNT_TYPES as readonly string[]).includes(value)
  );
}

/** Rótulos em pt-BR: a interface é em português, o código em inglês. */
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
};

/**
 * Rótulo para exibir. Valor desconhecido devolve **o próprio valor**, não um
 * rótulo inventado: mostrar "Conta corrente" para algo que não é seria mentir
 * para o usuário.
 *
 * Diferente de `parseHouseholdRole`, que erra para o lado seguro justamente
 * porque ali há privilégio em jogo — aqui o risco é só de exibição.
 */
export function labelForAccountType(value: string): string {
  return isAccountType(value) ? ACCOUNT_TYPE_LABELS[value] : value;
}
