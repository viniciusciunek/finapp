import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

import { AccountForm } from "../_components/account-form";
import { BackToAccountsLink } from "../_components/back-link";

export const metadata: Metadata = {
  title: "Nova conta",
};

/**
 * Criar conta.
 *
 * Fica em rota própria (e não num formulário embutido na listagem) porque o
 * mesmo formulário serve para editar depois, e porque no celular uma tela com
 * um formulário só é mais fácil de preencher do que uma lista com um formulário
 * no meio.
 */
export default function NewAccountPage() {
  return (
    <Suspense fallback={<NewAccountPlaceholder />}>
      <NewAccountContent />
    </Suspense>
  );
}

function NewAccountPlaceholder() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

async function NewAccountContent() {
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

      <AccountForm mode="create" description={`Vai entrar em ${scopeLabel}.`} />
    </div>
  );
}
