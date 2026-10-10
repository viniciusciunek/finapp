import { shiftMonth } from "./month";

/**
 * Folha do mês (`DOMAIN.md` §4.4–§4.6).
 *
 * Puro: nada aqui fala com banco, tela ou relógio — o "hoje" entra por
 * parâmetro. A folha é o coração do produto (o caderno digital): todo o resto
 * do app alimenta estas contas.
 */

/** Os números de um item que as contas da folha usam. */
export type SheetItemAmounts = {
  expectedCents: number;
  actualCents: number | null;
  paidCents: number;
};

/** O que vale para um item — §4.5: o real, quando informado; senão o previsto. */
export function effectiveCentsFor(item: {
  expectedCents: number;
  actualCents: number | null;
}): number {
  return item.actualCents ?? item.expectedCents;
}

/**
 * Item já pago (§4.5): o pago cobre o efetivo — e **algo** foi pago
 * (`paid_cents > 0`): um item zerado não nasce "pago".
 */
export function isItemPaid(item: SheetItemAmounts): boolean {
  return item.paidCents > 0 && item.paidCents >= effectiveCentsFor(item);
}

export type SheetItemStatus = "paid" | "partial" | "overdue" | "pending";

/**
 * Status calculado do item (`DOMAIN.md` §4.5) — nunca digitado.
 *
 * `paid`: o pago cobre o efetivo; `partial`: pagou, mas não tudo; `overdue`:
 * não pagou e o vencimento passou (o dia do vencimento em si ainda está no
 * prazo); `pending`: o resto. Sem vencimento, não atrasa.
 */
export function sheetItemStatus(
  item: SheetItemAmounts & { dueDate: string | null },
  today: string,
): SheetItemStatus {
  if (isItemPaid(item)) {
    return "paid";
  }

  if (item.paidCents > 0) {
    return "partial";
  }

  if (item.dueDate !== null && item.dueDate < today) {
    return "overdue";
  }

  return "pending";
}

/**
 * Valor previsto do item de um modelo (§4.4): o valor **real** do mesmo modelo
 * no mês anterior; sem ele, o previsto daquele mês; sem mês anterior, o padrão
 * do modelo. É a "sugestão pelo mês anterior" do caderno.
 */
export function suggestedExpectedCents(
  previousItem: { expectedCents: number; actualCents: number | null } | null,
  defaultAmountCents: number,
): number {
  return (
    previousItem?.actualCents ??
    previousItem?.expectedCents ??
    defaultAmountCents
  );
}

/**
 * O `n`-ésimo dia útil a partir do dia 1 do mês (sábado e domingo não contam;
 * feriados são ajuste manual no MVP, como o ROADMAP prevê). Se o mês tiver
 * menos dias úteis que `n`, a conta continua no mês seguinte — é o mesmo
 * "n-ésimo dia útil" que o caderno usa.
 */
export function nthBusinessDay(monthKey: string, n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(
      `Dia útil inválido: ${n}. É 1-based (o 1º dia útil é o primeiro de segunda a sexta).`,
    );
  }

  const [year, month] = monthKey.split("-").map(Number);
  let counted = 0;

  // Até 62 dias cobrem qualquer mês (28–31 dias) mais a continuação no seguinte.
  for (let offset = 0; offset < 62; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 + offset));
    const weekday = date.getUTCDay();

    if (weekday === 0 || weekday === 6) {
      continue;
    }

    counted += 1;

    if (counted === n) {
      const shiftedYear = date.getUTCFullYear();
      const shiftedMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
      const shiftedDay = String(date.getUTCDate()).padStart(2, "0");

      return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
    }
  }

  // Inalcançável com n ≤ 23 (o teto do CHECK do banco); defensivo p/ não mentir.
  throw new RangeError(`Não encontrei o ${n}º dia útil de ${monthKey}.`);
}

/**
 * Data planejada de fechamento da folha de referência `M` (§4.4): o
 * `businessDay`-ésimo dia útil do **mês seguinte** — o padrão do produto é o
 * 5º (`user_settings.payday_business_day`).
 */
export function plannedCloseDate(
  referenceMonth: string,
  businessDay: number,
): string {
  return nthBusinessDay(shiftMonth(referenceMonth, 1), businessDay);
}

export type SheetTotals = {
  totalCents: number;
  paidCents: number;
  missingCents: number;
};

/**
 * Totais da folha (§4.6): total = soma dos efetivos; "já pago" = soma do que
 * foi pago; "falta pagar" = o que ainda resta **em cada item** — pagar a mais
 * num item não abate o que falta em outro.
 */
export function sheetTotals(items: readonly SheetItemAmounts[]): SheetTotals {
  let totalCents = 0;
  let paidCents = 0;
  let missingCents = 0;

  for (const item of items) {
    const effective = effectiveCentsFor(item);

    totalCents += effective;
    paidCents += item.paidCents;
    missingCents += Math.max(effective - item.paidCents, 0);
  }

  return { totalCents, paidCents, missingCents };
}

/**
 * Quais itens entram no total do usuário na folha **pessoal** (§4.6): os itens
 * pessoais e, com o switch ligado, os itens da família **que ele paga**. Itens
 * da família de outro pagador nunca entram — não existe rateio; o modelo é
 * "quem paga". Na folha da família entra tudo (sem switch).
 */
export function personalSheetItemsForUser<
  T extends { payerUserId: string | null },
>(
  personalItems: readonly T[],
  householdItems: readonly T[],
  userId: string,
  includeFamily: boolean,
): T[] {
  if (!includeFamily) {
    return [...personalItems];
  }

  return [
    ...personalItems,
    ...householdItems.filter((item) => item.payerUserId === userId),
  ];
}
