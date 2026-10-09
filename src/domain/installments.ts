import { isCents } from "./money";
import { isMonthKey, shiftMonth } from "./month";
import { MAX_INSTALLMENTS } from "./transaction";

/**
 * Parcelamento de compra no crédito (`DOMAIN.md` §4.2).
 *
 * Puro: nada aqui fala com banco, tela ou relógio. O banco guarda o resultado
 * (as linhas de `card_installments`); a conta é feita aqui, uma vez, com teste.
 *
 * A regra de divisão é a do documento: `base = floor(total / n)` e o **resto
 * na primeira parcela** — assim a soma das parcelas é exatamente o total, sem
 * sobrar nem faltar centavo. Exemplo do §5: 100,00 em 3x vira
 * 33,34 + 33,33 + 33,33.
 */

/**
 * Divide `totalCents` em `count` parcelas de inteiros.
 *
 * Devolve `null` quando não dá: valor negativo ou fracionado, quantidade fora
 * de 1..`MAX_INSTALLMENTS`, ou mais parcelas do que centavos — cada parcela
 * precisa de ao menos 1 centavo (espelha o `check (amount_cents > 0)` da
 * tabela; R$ 0,10 não se divide em 48x).
 */
export function splitInstallments(
  totalCents: number,
  count: number,
): number[] | null {
  if (!isCents(totalCents) || totalCents <= 0) {
    return null;
  }

  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    return null;
  }

  if (count > totalCents) {
    return null;
  }

  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return Array.from({ length: count }, (_, index) =>
    index === 0 ? base + remainder : base,
  );
}

/**
 * Em que fatura cai a parcela `number`, sabendo em que fatura caiu a primeira
 * (`reference_month + (k − 1)`, §4.2) — isolado para o off-by-one morar num
 * lugar só, com teste.
 */
export function installmentStatementMonth(
  firstStatementMonth: string,
  number: number,
): string | null {
  if (!isMonthKey(firstStatementMonth)) {
    return null;
  }

  if (!Number.isInteger(number) || number < 1 || number > MAX_INSTALLMENTS) {
    return null;
  }

  return shiftMonth(firstStatementMonth, number - 1);
}
