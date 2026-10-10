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

  return day <= effectiveDayInMonth(monthKey, closingDay)
    ? monthKey
    : shiftMonth(monthKey, 1);
}

/**
 * Datas de fechamento e vencimento de uma fatura, a partir dos dias do cartão.
 *
 * (`DOMAIN.md` §4.1) A fatura de setembro fecha em **setembro** e vence em
 * **outubro** — o vencimento é sempre no mês seguinte ao de referência. Dias
 * 29–31 em mês curto valem o último dia do mês: fevereiro de 2026 não tem 31.
 */
export function statementDates(
  referenceMonth: string,
  closingDay: number,
  dueDay: number,
): { closingDate: string; dueDate: string } {
  return {
    closingDate: dateInMonth(referenceMonth, closingDay),
    dueDate: dateInMonth(shiftMonth(referenceMonth, 1), dueDay),
  };
}

/**
 * Dia `day` dentro do mês, em `YYYY-MM-DD`, limitado ao último dia do mês —
 * o mesmo tratamento que o dia do fechamento recebe em `resolveStatementMonth`.
 */
function dateInMonth(monthKey: string, day: number): string {
  const effectiveDay = effectiveDayInMonth(monthKey, day);

  return `${monthKey}-${String(effectiveDay).padStart(2, "0")}`;
}

/** O dia pedido, ou o último do mês quando o mês é mais curto que ele. */
function effectiveDayInMonth(monthKey: string, day: number): number {
  const lastDay = Number(monthRange(monthKey).to.slice(8, 10));

  return Math.min(day, lastDay);
}

/**
 * A fatura ainda está aberta? — o dia do fechamento é inclusive (§4.1).
 *
 * O `statements.status` guardado acompanha o **pagamento** (paid/partial,
 * §4.3); o fechamento por data é derivado na leitura — uma fatura do mês
 * passado não pode aparecer como "aberta" só porque ainda não foi paga.
 */
export function isStatementOpen(closingDate: string, today: string): boolean {
  return today <= closingDate;
}
