import { monthRange, shiftMonth } from "./month";

/**
 * Fatura do cartão: em que mês uma compra entra.
 *
 * O `DOMAIN.md` §4.1 avisa que o tratamento do **próprio dia do fechamento**
 * varia por banco — por isso a regra mora aqui, sozinha, pura e testada, em vez
 * de espalhada pela tela. A regra adotada (a ser conferida com uma compra real
 * em cada cartão, como o próprio documento pede):
 *
 *   compra **até** o dia do fechamento (inclusive) → fatura **daquele mês**;
 *   compra **depois** dele → fatura do **mês seguinte**.
 *
 * Se o banco de algum cartão tratar diferente, muda-se esta função e os testes
 * dela — nada mais. É para isso que ela existe.
 *
 * Dia de fechamento 31 em mês curto vale o último dia do mês (mesmo tratamento
 * que o `closing_day` recebe no cálculo da data de fechamento).
 */
export function resolveStatementMonth(
  occurredOn: string,
  closingDay: number,
): string {
  const [year, month, day] = occurredOn.split("-").map(Number);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const lastDay = Number(monthRange(monthKey).to.slice(8, 10));
  const effectiveClosingDay = Math.min(closingDay, lastDay);

  return day <= effectiveClosingDay ? monthKey : shiftMonth(monthKey, 1);
}
