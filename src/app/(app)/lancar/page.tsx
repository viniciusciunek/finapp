import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { listCreditCards } from "@/server/credit-cards";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

import { QuickEntryForm } from "./_components/quick-entry-form";

export const metadata: Metadata = {
  title: "Lançar",
};

/**
 * Lançamento rápido.
 *
 * Uma tela com um trabalho só, como `/contas/nova`: o critério da fatia é
 * lançar "futebol, R$ 12, Pix, Mercado Pago" em menos de 15 segundos, e isso se
 * ganha tirando coisas da frente — nada de lista, nada de menu, nada de campo
 * que não seja necessário.
 *
 * O `<Suspense>` é o mesmo padrão do resto do app (D9).
 */
export default function NewTransactionPage() {
  return (
    <Suspense fallback={<NewTransactionPlaceholder />}>
      <NewTransactionContent />
    </Suspense>
  );
}

function NewTransactionPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

async function NewTransactionContent() {
  const context = await requireHousehold();
  const scope = await getScope();

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  // Contas e categorias em paralelo: uma falha numa não precisa esconder a outra.
  // Contas, cartões e categorias em paralelo: uma falha numa não precisa esconder
  // as outras.
  const [accountsResult, cardsResult, categoriesResult] = await Promise.all([
    listAccounts(ownership),
    listCreditCards(ownership),
    listCategories(ownership),
  ]);

  // Hoje, no fuso do servidor. A data é um campo do formulário — o padrão é só
  // o atalho de quem lança no mesmo dia (que é o caso quase sempre).
  const today = new Date().toISOString().slice(0, 10);

  const scopeLabel =
    scope === "household"
      ? `a família ${context.household.name}`
      : "só para você";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Lançar</h2>
        <p className="text-muted-foreground text-sm">
          Vai entrar em {scopeLabel}.
        </p>
      </div>

      {accountsResult.error ? (
        <p className="text-destructive text-sm">{accountsResult.error}</p>
      ) : null}

      {categoriesResult.error ? (
        <p className="text-destructive text-sm">{categoriesResult.error}</p>
      ) : null}

      <QuickEntryForm
        mode="create"
        accounts={accountsResult.accounts}
        cards={cardsResult.cards}
        categories={categoriesResult.categories}
        today={today}
      />
    </div>
  );
}
