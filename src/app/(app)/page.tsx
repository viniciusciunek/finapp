import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isMonthKey,
  monthKeyOf,
  monthLabel,
  monthRange,
  shiftMonth,
  dayLabel,
} from "@/domain/month";
import { sumCents } from "@/domain/money";
import { labelForPaymentMethod } from "@/domain/transaction";
import { formatBrl } from "@/lib/format";
import { listCategories } from "@/server/categories";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import {
  listTransactionsBetween,
  type Transaction,
} from "@/server/transactions";

/**
 * Visão geral — a tela inicial do app.
 *
 * Nesta fatia ela mostra o essencial do contexto: qual visão está ativa e o que
 * cada visão significa. A Folha do mês entra aqui na Fatia 5.
 *
 * O estado ativo vem de cookie (`getScope`), não de parâmetro na URL: assim a
 * escolha do usuário sobrevive à navegação sem poluir o endereço.
 *
 * O conteúdo fica dentro de um `<Suspense>`: ele depende de cookie e da
 * validação do token, então precisa de um limite explícito para a casca ser
 * pré-renderizada (ver `src/server/session.ts`).
 */
export default function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  return (
    <Suspense fallback={<OverviewPlaceholder />}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  );
}

function OverviewPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

async function OverviewContent({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const context = await requireHousehold();
  const scope = await getScope();

  const { mes } = await searchParams;
  // Mês válido na URL; qualquer outra coisa vira o mês de hoje. Endereço torto
  // não pode virar tela de erro.
  const monthKey = isMonthKey(mes) ? mes : monthKeyOf(new Date());
  const { from, to } = monthRange(monthKey);

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  // Lançamentos e categorias em paralelo: uma consulta não espera a outra.
  const [transactionsResult, categoriesResult] = await Promise.all([
    listTransactionsBetween(ownership, from, to),
    listCategories(ownership),
  ]);

  const categoryNames = new Map(
    categoriesResult.categories.map((category) => [category.id, category.name]),
  );

  // O total sai da mesma lista que está na tela — se a soma e o que se vê
  // divergissem, a pessoa perderia a confiança nos dois.
  const totalCents = sumCents(
    transactionsResult.transactions.map((item) => item.totalCents),
  );

  // Agrupa por dia. O banco já devolve na ordem certa (dia mais recente
  // primeiro, e dentro do dia o lançamento mais novo primeiro).
  const days = new Map<string, Transaction[]>();
  for (const transaction of transactionsResult.transactions) {
    const sameDay = days.get(transaction.occurredOn) ?? [];
    sameDay.push(transaction);
    days.set(transaction.occurredOn, sameDay);
  }

  const isHouseholdView = scope === "household";

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {isHouseholdView ? "Visão da família" : "Sua visão"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isHouseholdView
            ? `Tudo que é compartilhado com ${context.household.name} aparece aqui.`
            : "O que é só seu — invisível para qualquer outra pessoa, inclusive para a família."}
        </p>
      </div>

      <Button asChild className="w-full" size="lg">
        <Link href="/lancar">Lançar despesa</Link>
      </Button>

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/?mes=${shiftMonth(monthKey, -1)}`}
            aria-label="Mês anterior"
          >
            ←
          </Link>
        </Button>

        <div className="text-center">
          <p className="font-medium capitalize">{monthLabel(monthKey)}</p>
          <p className="text-muted-foreground text-xs">
            {transactionsResult.error
              ? "—"
              : `Total de ${formatBrl(totalCents)}`}
          </p>
        </div>

        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/?mes=${shiftMonth(monthKey, 1)}`}
            aria-label="Próximo mês"
          >
            →
          </Link>
        </Button>
      </div>

      {transactionsResult.error ? (
        <p className="text-destructive text-sm">{transactionsResult.error}</p>
      ) : null}

      {categoriesResult.error ? (
        <p className="text-destructive text-sm">{categoriesResult.error}</p>
      ) : null}

      {transactionsResult.transactions.length === 0 &&
      !transactionsResult.error ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Nada lançado neste mês</p>
          <p className="text-muted-foreground mt-1 text-sm">
            O botão acima é o caminho mais curto: valor, no que foi e pronto.
          </p>
        </div>
      ) : null}

      <ul className="space-y-4">
        {[...days.entries()].map(([day, items]) => (
          <li key={day} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-muted-foreground text-xs uppercase">
                {dayLabel(day)}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatBrl(sumCents(items.map((item) => item.totalCents)))}
              </p>
            </div>

            <ul className="divide-y overflow-hidden rounded-xl border">
              {items.map((transaction) => (
                <li key={transaction.id}>
                  <Link
                    href={`/lancar/${transaction.id}/editar`}
                    className="hover:bg-muted/50 block p-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">
                        {transaction.description}
                      </p>
                      <p className="text-sm font-medium">
                        {formatBrl(transaction.totalCents)}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {labelForPaymentMethod(transaction.paymentMethod)}
                      {transaction.categoryId
                        ? ` · ${categoryNames.get(transaction.categoryId) ?? "sem categoria"}`
                        : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
