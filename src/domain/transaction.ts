/**
 * Regras do lançamento (`DOMAIN.md` §2).
 *
 * Puro: nada aqui fala com banco, tela ou relógio. As mesmas regras existem em
 * SQL — o CHECK `transactions_payment_target` e o limite de parcelas — e este
 * arquivo é o **espelho em TypeScript** delas. Quem decide de verdade continua
 * sendo o banco; aqui é para a tela avisar antes de tentar gravar, em vez de
 * deixar a pessoa preencher tudo para receber um erro no fim.
 */

export const PAYMENT_METHODS = [
  "pix",
  "cash",
  "debit",
  "boleto",
  "credit",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

/** Rótulo em pt-BR: o banco guarda o código, a tela mostra isto. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Débito",
  boleto: "Boleto",
  credit: "Crédito",
};

/** Valor desconhecido volta cru, sem mentir (igual a `labelForAccountType`). */
export function labelForPaymentMethod(value: string): string {
  return isPaymentMethod(value) ? PAYMENT_METHOD_LABELS[value] : value;
}

/** Mesmo limite do CHECK `installments_count between 1 and 48`. */
export const MAX_INSTALLMENTS = 48;

/**
 * Crédito é o único meio que vai para o **cartão**; todos os outros são sempre
 * numa conta. É a regra do CHECK `transactions_payment_target`, em uma função
 * que a tela consegue usar para escolher o campo certo.
 */
export function usesCard(method: PaymentMethod): boolean {
  return method === "credit";
}
