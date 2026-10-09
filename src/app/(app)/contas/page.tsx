import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { labelForAccountType } from "@/domain/account";
import { formatBrl } from "@/lib/format";
import { listAccounts } from "@/server/accounts";
import { listCreditCards } from "@/server/credit-cards";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

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

  // Duas consultas em paralelo, cada uma com o seu erro: uma falha ao carregar
  // os cartões não pode esconder as contas.
  const [accountsResult, cardsResult] = await Promise.all([
    listAccounts(ownership),
    listCreditCards(ownership),
  ]);

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
          <ul className="divide-y rounded-xl border">
            {accountsResult.accounts.map((account) => (
              <li key={account.id} className="p-3">
                <p className="text-sm font-medium">{account.name}</p>
                <p className="text-muted-foreground text-xs">
                  {labelForAccountType(account.type)}
                  {account.bank ? ` · ${account.bank}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Cartões</h3>

        {cardsResult.error ? (
          <p className="text-destructive text-sm">{cardsResult.error}</p>
        ) : null}

        {cardsResult.cards.length === 0 && !cardsResult.error ? (
          <p className="text-muted-foreground text-sm">
            Nenhum cartão aqui ainda.
          </p>
        ) : null}

        {cardsResult.cards.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {cardsResult.cards.map((card) => (
              <li key={card.id} className="p-3">
                <p className="text-sm font-medium">{card.name}</p>
                <p className="text-muted-foreground text-xs">
                  Fecha dia {card.closingDay} · vence dia {card.dueDay}
                  {card.limitCents === null
                    ? ""
                    : ` · limite ${formatBrl(card.limitCents)}`}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
