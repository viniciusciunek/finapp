import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/domain/uuid";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import { getTransaction } from "@/server/transactions";

import { deleteTransactionAction } from "../../actions";
import { QuickEntryForm } from "../../_components/quick-entry-form";
import { DeleteCard } from "@/app/(app)/contas/_components/delete-card";

export const metadata: Metadata = {
  title: "Editar lançamento",
};

/**
 * Editar lançamento — mesmo desenho da edição de conta e cartão: o formulário é
 * o mesmo do lançamento (com `mode="edit"`), o apagar mora aqui com confirmação
 * em dois toques, e id invisível cai no 404.
 */
export default function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditTransactionPlaceholder />}>
      <EditTransactionContent params={params} />
    </Suspense>
  );
}

function EditTransactionPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

async function EditTransactionContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Id torto não chega ao banco: vira "não encontrado" direto.
  if (!isUuid(id)) {
    notFound();
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  const [transactionResult, accountsResult, categoriesResult] =
    await Promise.all([
      getTransaction(id),
      listAccounts(ownership),
      listCategories(ownership),
    ]);

  if (transactionResult.error) {
    return (
      <div className="space-y-4">
        <BackToMonthLink />
        <p className="text-destructive text-sm">{transactionResult.error}</p>
      </div>
    );
  }

  // Sem lançamento: não existe ou é de outra pessoa — o RLS esconde as duas do
  // mesmo jeito, de propósito.
  if (!transactionResult.transaction) {
    notFound();
  }

  const transaction = transactionResult.transaction;

  return (
    <div className="space-y-4">
      <BackToMonthLink />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Editar lançamento</h2>
        <p className="text-muted-foreground text-sm">
          {transaction.scope === "household"
            ? `Da família ${context.household.name} — os dois podem editar.`
            : "Só seu — nem a família enxerga."}
        </p>
      </div>

      <QuickEntryForm
        mode="edit"
        id={transaction.id}
        initialValues={transaction}
        accounts={accountsResult.accounts}
        categories={categoriesResult.categories}
        today={transaction.occurredOn}
      />

      <DeleteCard
        id={transaction.id}
        action={deleteTransactionAction}
        title="Apagar lançamento"
        description="O lançamento sai da lista e não volta. Se foi engano de valor ou data, edite acima em vez de apagar."
        label="Apagar lançamento"
      />
    </div>
  );
}

/** Volta para a lista do mês (a Visão geral). */
function BackToMonthLink() {
  return (
    <Link
      href="/"
      className="text-muted-foreground hover:text-foreground text-sm"
    >
      ← Mês
    </Link>
  );
}
