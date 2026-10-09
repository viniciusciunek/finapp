import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/domain/uuid";
import { getAccount } from "@/server/accounts";
import { requireHousehold } from "@/server/session";

import { deleteAccountAction } from "../../actions";
import { AccountForm } from "../../_components/account-form";
import { BackToAccountsLink } from "../../_components/back-link";
import { DeleteCard } from "../../_components/delete-card";

export const metadata: Metadata = {
  title: "Editar conta",
};

/**
 * Editar conta.
 *
 * `params` chega como Promise (Next 16) e é lido **dentro** do componente async
 * do `<Suspense>` — o mesmo padrão das outras telas (D9): a casca continua
 * pré-renderizável e quem espera dado de requisição é o filho.
 */
export default function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditAccountPlaceholder />}>
      <EditAccountContent params={params} />
    </Suspense>
  );
}

function EditAccountPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

async function EditAccountContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Id torto (link truncado, dedo escorregado) não chega ao banco: viraria erro
  // de cast no Postgres e a tela diria "não foi possível carregar" quando a
  // resposta certa é "não existe".
  if (!isUuid(id)) {
    notFound();
  }

  const context = await requireHousehold();
  const { account, error } = await getAccount(id);

  if (error) {
    return (
      <div className="space-y-4">
        <BackToAccountsLink />
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  // Sem conta: não existe ou é de outra pessoa — o RLS esconde as duas do mesmo
  // jeito, de propósito. Não dá (nem deve dar) para distinguir.
  if (!account) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <BackToAccountsLink />

      <AccountForm
        mode="edit"
        id={account.id}
        initialValues={account}
        description={
          account.scope === "household"
            ? `Esta conta é de ${context.household.name} — os dois podem editar.`
            : "Esta conta é só sua — nem a família enxerga."
        }
      />

      <DeleteCard
        id={account.id}
        action={deleteAccountAction}
        title="Apagar conta"
        description="A conta sai da lista e não volta. Se ela ainda for usada, edite em vez de apagar."
        label="Apagar conta"
      />
    </div>
  );
}
