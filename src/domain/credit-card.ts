/**
 * Regras do cartão de crédito.
 *
 * O cadastro guarda o **dia** escolhido (1 a 31), não uma data. O que fazer
 * quando o mês é mais curto que isso — fevereiro não tem 31 — é regra do
 * cálculo da fatura, que chega na Fatia 4 (`resolveStatementMonth`). Aqui só se
 * valida o que é cadastrável, que é o que o formulário precisa.
 */

export const BILLING_DAY_MIN = 1;
export const BILLING_DAY_MAX = 31;

/**
 * Diz se o dia de fechamento/vencimento existe no calendário.
 *
 * Recebe `unknown` de propósito: o valor vem de formulário (string) e de banco
 * (número), e a função precisa responder sobre qualquer um dos dois sem
 * converter nada por conta própria. `15.5` e `NaN` são recusados.
 */
export function isValidBillingDay(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= BILLING_DAY_MIN &&
    value <= BILLING_DAY_MAX
  );
}
