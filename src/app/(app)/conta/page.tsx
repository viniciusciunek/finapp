import type { Metadata } from "next";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canManageHousehold } from "@/domain/household";
import { requireHousehold } from "@/server/session";

import { signOutAction } from "../../actions";
import { LeaveFamilyCard } from "./_components/leave-family-card";

export const metadata: Metadata = {
  title: "Conta",
};

/**
 * Tela da conta: quem é o usuário, em qual família está, e as saídas
 * (da família e da conta).
 *
 * O e-mail vem de `auth.users` via claims do token — não do formulário nem de
 * query string.
 *
 * O `<Suspense>` segue o mesmo padrão do resto do app: a leitura depende da
 * sessão, então precisa de limite explícito para o Next 16 pré-renderizar a
 * casca (ver `src/server/session.ts`).
 */
export default function AccountPage() {
  return (
    <Suspense fallback={<AccountPlaceholder />}>
      <AccountContent />
    </Suspense>
  );
}

function AccountPlaceholder() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}

async function AccountContent() {
  const context = await requireHousehold();
  const isOwner = canManageHousehold(context.household.role);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sua conta</h2>

        <dl className="divide-y rounded-xl border text-sm">
          <div className="flex items-baseline justify-between gap-3 p-3">
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="font-medium">{context.profile.name}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-3 p-3">
            <dt className="text-muted-foreground shrink-0">E-mail</dt>
            <dd className="truncate font-medium">
              {context.profile.email || context.email}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-3 p-3">
            <dt className="text-muted-foreground shrink-0">Família</dt>
            <dd className="truncate font-medium">{context.household.name}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-3 p-3">
            <dt className="text-muted-foreground">Seu papel</dt>
            <dd className="font-medium">{isOwner ? "Dono" : "Membro"}</dd>
          </div>
        </dl>
      </section>

      {isOwner ? null : <LeaveFamilyCard />}

      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Sair da conta
        </Button>
      </form>
    </div>
  );
}
