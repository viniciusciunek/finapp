import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

import { BackToAccountsLink } from "../../_components/back-link";
import { CardForm } from "../../_components/card-form";

export const metadata: Metadata = {
  title: "Novo cartão",
};

/** Criar cartão — mesma estrutura da criação de conta, por consistência. */
export default function NewCardPage() {
  return (
    <Suspense fallback={<NewCardPlaceholder />}>
      <NewCardContent />
    </Suspense>
  );
}

function NewCardPlaceholder() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

async function NewCardContent() {
  const context = await requireHousehold();
  const scope = await getScope();

  // Só exibição: quem decide o escopo é a Server Action, no servidor.
  const scopeLabel =
    scope === "household"
      ? `a família ${context.household.name}`
      : "só para você";

  return (
    <div className="space-y-4">
      <BackToAccountsLink />

      <CardForm mode="create" description={`Vai entrar em ${scopeLabel}.`} />
    </div>
  );
}
