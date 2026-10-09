import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/domain/uuid";
import { getCreditCard } from "@/server/credit-cards";
import { requireHousehold } from "@/server/session";

import { BackToAccountsLink } from "../../../_components/back-link";
import { CardForm } from "../../../_components/card-form";

export const metadata: Metadata = {
  title: "Editar cartão",
};

/** Editar cartão — mesma estrutura da edição de conta, por consistência. */
export default function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditCardPlaceholder />}>
      <EditCardContent params={params} />
    </Suspense>
  );
}

function EditCardPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

async function EditCardContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const context = await requireHousehold();
  const { card, error } = await getCreditCard(id);

  if (error) {
    return (
      <div className="space-y-4">
        <BackToAccountsLink />
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  if (!card) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <BackToAccountsLink />

      <CardForm
        mode="edit"
        id={card.id}
        initialValues={card}
        description={
          card.scope === "household"
            ? `Este cartão é de ${context.household.name} — os dois podem editar.`
            : "Este cartão é só seu — nem a família enxerga."
        }
      />
    </div>
  );
}
