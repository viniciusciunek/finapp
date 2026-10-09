import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { labelForAccountType } from "@/domain/account";
import { monthKeyOf, monthLabel } from "@/domain/month";
import { resolveStatementMonth } from "@/domain/statement";
import { formatBrl } from "@/lib/format";
import { listAccounts } from "@/server/accounts";
import { listCreditCards } from "@/server/credit-cards";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import { listStatementsForMonths } from "@/server/statements";

export const metadata: Metadata = {
  title: "Contas",
};

/**
 * Contas e cartões do escopo ativo.
 *
 * O escopo vem do cookie (a alternância no topo), não da URL: a tela mostra o
 * que a pessoa escolheu ver — o que é só dela ou o que é da família — e o
 * rodapé diz qual dos dois está na frente, para não haver dúvida sobre onde a
 * próxima conta vai cair.
 *
 * O `<Suspense>` é o mesmo padrão do resto do app (D9): sem ele, a leitura de
 * cookie e a consulta ao banco travam a pré-renderização da casca.
 */
export default function AccountsPage() {
  return (
    <Suspense fallback={<AccountsPlaceholder />}>
      <AccountsContent />
    </Suspense>
  );
}

function AccountsPlaceholder() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

async function AccountsContent() {
  const context = await requireHousehold();
  const scope = await getScope();

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  const now = new Date();
  const currentMonth = monthKeyOf(now);
  // Hoje em data local, no formato que o banco usa. É o que define a fatura
  // aberta de cada cartão (o dia da compra é o que decide o ciclo).
  const today = `${currentMonth}-${String(now.getDate()).padStart(2, "0")}`;

  // Duas consultas em paralelo, cada uma com o seu erro: uma falha ao carregar
  // os cartões não pode esconder as contas.
  const [accountsResult, cardsResult] = await Promise.all([
    listAccounts(ownership),
    listCreditCards(ownership),
  ]);

  // A fatura **aberta** de cada cartão já se sabe antes de consultar:
  // `resolveStatementMonth(hoje, closingDay)` — num cartão cujo fechamento já
  // passou neste mês, a aberta é a do mês seguinte. Era essa a confusão que a
  // errata do P23 registrou ("fatura de outubro" com a aberta sendo novembro).
  const openMonths = cardsResult.cards.map((card) => ({
    card,
    month: resolveStatementMonth(today, card.closingDay),
  }));

  const statementsResult = await listStatementsForMonths(ownership, [
    ...new Set(openMonths.map((entry) => entry.month)),
  ]);

  /**
   * Fatura **aberta**, por cartão, direto do banco: a linha mostra o
   * `effectiveCents` (§4.3) — o valor real, quando informado; senão, a soma
   * das parcelas. Cartão sem fatura aberta ainda vale R$ 0,00.
   *
   * Desde a Fatia 4 a soma vem das **parcelas** (`card_installments`), não mais
   * das transações inteiras: uma compra em 3x pesa 1/3 na fatura do primeiro
   * mês, como pesa no cartão de verdade.
   */
  const statementByCard = new Map<
    string,
    { month: string; totalCents: number }
  >();

  for (const { card, month } of openMonths) {
    const statement = statementsResult.statements.find(
      (item) => item.cardId === card.id && item.referenceMonth === month,
    );

    statementByCard.set(card.id, {
      month,
      totalCents: statement?.effectiveCents ?? 0,
    });
  }

  const isHouseholdView = scope === "household";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {isHouseholdView ? "Da família" : "Só suas"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isHouseholdView
            ? `Contas e cartões que ${context.household.name} e você veem e usam juntos.`
            : "Contas e cartões que só você vê — nem a família enxerga."}
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Contas</h3>
          <Button asChild variant="outline" size="sm">
            <Link href="/contas/nova">Nova conta</Link>
          </Button>
        </div>

        {accountsResult.error ? (
          <p className="text-destructive text-sm">{accountsResult.error}</p>
        ) : null}

        {accountsResult.accounts.length === 0 && !accountsResult.error ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma conta aqui ainda.
          </p>
        ) : null}

        {accountsResult.accounts.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {accountsResult.accounts.map((account) => (
              <li key={account.id}>
                <Link
                  href={`/contas/${account.id}/editar`}
                  className="hover:bg-muted/50 block p-3"
                >
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {labelForAccountType(account.type)}
                    {account.bank ? ` · ${account.bank}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Cartões</h3>
          <Button asChild variant="outline" size="sm">
            <Link href="/contas/cartoes/novo">Novo cartão</Link>
          </Button>
        </div>

        {cardsResult.error ? (
          <p className="text-destructive text-sm">{cardsResult.error}</p>
        ) : null}

        {statementsResult.error ? (
          <p className="text-destructive text-sm">{statementsResult.error}</p>
        ) : null}

        {cardsResult.cards.length === 0 && !cardsResult.error ? (
          <p className="text-muted-foreground text-sm">
            Nenhum cartão aqui ainda.
          </p>
        ) : null}

        {cardsResult.cards.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {cardsResult.cards.map((card) => (
              <li key={card.id}>
                <Link
                  href={`/contas/cartoes/${card.id}/editar`}
                  className="hover:bg-muted/50 block p-3"
                >
                  <p className="text-sm font-medium">{card.name}</p>
                  <p className="text-muted-foreground text-xs">
                    Fecha dia {card.closingDay} · vence dia {card.dueDay}
                    {card.limitCents === null
                      ? ""
                      : ` · limite ${formatBrl(card.limitCents)}`}
                  </p>
                  <p className="text-sm font-medium">
                    Fatura aberta —{" "}
                    {monthLabel(
                      statementByCard.get(card.id)?.month ?? currentMonth,
                    )}
                    : {formatBrl(statementByCard.get(card.id)?.totalCents ?? 0)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
