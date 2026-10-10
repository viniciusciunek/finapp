import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dayLabel,
  isMonthKey,
  monthKeyOf,
  monthLabel,
  shiftMonth,
} from "@/domain/month";
import { isStatementOpen, resolveStatementMonth } from "@/domain/statement";
import { isUuid } from "@/domain/uuid";
import { formatBrl } from "@/lib/format";
import { getCreditCard } from "@/server/credit-cards";
import { requireHousehold } from "@/server/session";
import { getStatementDetail } from "@/server/statements";

import { BackToAccountsLink } from "../../../_components/back-link";
import {
  ActualValueForm,
  PaymentForm,
} from "../../../_components/statement-forms";

export const metadata: Metadata = {
  title: "Fatura",
};

/**
 * Fatura de um cartão (§4.3).
 *
 * Mostra os três números do documento — **calculado** (soma das parcelas),
 * **real** (informado à mão, quando a pessoa confere no app do banco) e **não
 * lançado** (a diferença) — além do que vale para pagar (`effectiveCents`) e do
 * histórico de lançamentos que compõe o calculado.
 *
 * O mês vem de `?mes=AAAA-MM`; sem ele, a fatura **aberta** do cartão
 * (`resolveStatementMonth(hoje, closingDay)`) — as setas navegam o histórico.
 */
export default function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  return (
    <Suspense fallback={<StatementPlaceholder />}>
      <StatementContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function StatementPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

async function StatementContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { id } = await params;

  // Id torto não chega ao banco: vira "não encontrado" direto.
  if (!isUuid(id)) {
    notFound();
  }

  await requireHousehold();

  const { card, error } = await getCreditCard(id);

  if (error) {
    return (
      <div className="space-y-4">
        <BackToAccountsLink />
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  // Sem cartão: não existe ou é de outra pessoa — o RLS esconde as duas do
  // mesmo jeito, de propósito.
  if (!card) {
    notFound();
  }

  const now = new Date();
  const today = `${monthKeyOf(now)}-${String(now.getDate()).padStart(2, "0")}`;
  const { mes } = await searchParams;
  const openMonth = resolveStatementMonth(today, card.closingDay);
  // Mês válido na URL; qualquer outra coisa vira a fatura aberta.
  const month = isMonthKey(mes) ? mes : openMonth;

  const {
    statement,
    items,
    error: detailError,
  } = await getStatementDetail(card.id, month);

  if (detailError) {
    return (
      <div className="space-y-4">
        <BackToAccountsLink />
        <p className="text-destructive text-sm">{detailError}</p>
      </div>
    );
  }

  // O status guardado só acompanha pagamento; fechar por data é derivado
  // (`isStatementOpen`) — uma fatura vencida não pode aparecer como "aberta".
  const statusLabel = statement
    ? statement.status === "paid"
      ? "Paga"
      : statement.status === "partial"
        ? "Pagamento parcial"
        : isStatementOpen(statement.closingDate, today)
          ? "Aberta — ainda recebendo compras"
          : "Fechada — aguardando pagamento"
    : null;

  return (
    <div className="space-y-4">
      <BackToAccountsLink />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Fatura — {card.name}</h2>
        <p className="text-muted-foreground text-sm">
          {statement
            ? `Fecha ${statement.closingDate} · vence ${statement.dueDate}`
            : `Fecha dia ${card.closingDay} · vence dia ${card.dueDay}`}
        </p>
        {statusLabel ? (
          <p className="text-sm font-medium">{statusLabel}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/contas/cartoes/${card.id}/fatura?mes=${shiftMonth(month, -1)}`}
            aria-label="Mês anterior"
          >
            ←
          </Link>
        </Button>

        <p className="font-medium capitalize">{monthLabel(month)}</p>

        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/contas/cartoes/${card.id}/fatura?mes=${shiftMonth(month, 1)}`}
            aria-label="Próximo mês"
          >
            →
          </Link>
        </Button>
      </div>

      {!statement ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">
            Sem fatura em {monthLabel(month)}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Compras no crédito deste cartão criam a fatura sozinhas, no mês em
            que fecham.
          </p>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm">Calculado</span>
                <span className="text-sm font-medium">
                  {formatBrl(statement.calculatedCents)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm">Valor real</span>
                <span className="text-sm font-medium">
                  {statement.actualCents === null
                    ? "—"
                    : formatBrl(statement.actualCents)}
                </span>
              </div>
              {statement.unloggedCents !== null ? (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">Não lançado</span>
                  <span className="text-sm font-medium">
                    {formatBrl(statement.unloggedCents)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="text-sm font-medium">Para pagar</span>
                <span className="font-semibold">
                  {formatBrl(statement.effectiveCents)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                O que vale para pagar é o valor real quando informado; sem ele,
                a soma das parcelas.
              </p>
            </CardContent>
          </Card>

          <ActualValueForm
            statementId={statement.id}
            cardId={card.id}
            currentActualCents={statement.actualCents}
            calculatedCents={statement.calculatedCents}
          />

          <PaymentForm
            statementId={statement.id}
            cardId={card.id}
            effectiveCents={statement.effectiveCents}
            paidCents={statement.paidCents}
          />

          <div className="space-y-2">
            <h3 className="font-medium">Lançamentos da fatura</h3>

            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma parcela nesta fatura.
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border">
                {items.map((item) => (
                  <li key={`${item.transactionId}-${item.installmentNumber}`}>
                    <Link
                      href={`/lancar/${item.transactionId}/editar`}
                      className="hover:bg-muted/50 block p-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">
                          {item.description}
                        </p>
                        <p className="text-sm font-medium">
                          {formatBrl(item.amountCents)}
                        </p>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {item.installmentsCount > 1
                          ? `Parcela ${item.installmentNumber}/${item.installmentsCount} · `
                          : ""}
                        compra em {dayLabel(item.occurredOn)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
