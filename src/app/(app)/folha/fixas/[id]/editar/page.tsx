import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/domain/uuid";
import { listCategories } from "@/server/categories";
import { listHouseholdMembers } from "@/server/households";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import { findRecurringTemplate } from "@/server/sheets";

import { TemplateForm } from "../../_components/template-form";

export const metadata: Metadata = {
  title: "Editar conta fixa",
};

/** Editar conta fixa — o mesmo formulário em modo `edit`. */
export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<FormPlaceholder />}>
      <EditTemplateContent params={params} />
    </Suspense>
  );
}

function FormPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

async function EditTemplateContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Id torto na URL não vira tela de erro: 404, como nas outras telas.
  if (!isUuid(id)) {
    notFound();
  }

  const context = await requireHousehold();
  const scope = await getScope();
  const isHouseholdView = scope === "household";

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  const [templateResult, membersResult, categoriesResult] = await Promise.all([
    findRecurringTemplate(ownership, id),
    isHouseholdView ? listHouseholdMembers(context.household.id) : null,
    listCategories(ownership),
  ]);

  if (!templateResult.template) {
    // Inexistente ou de outro escopo: para esta tela, o mesmo que não existir.
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link
        href="/folha/fixas"
        className="text-muted-foreground text-sm underline underline-offset-2"
      >
        ← Contas fixas
      </Link>

      <TemplateForm
        mode="edit"
        id={id}
        initialValues={templateResult.template}
        description={
          isHouseholdView
            ? "Conta fixa da família — os dois veem e usam."
            : "Conta fixa que só você vê — nem a família enxerga."
        }
        members={(membersResult?.members ?? []).map((member) => ({
          userId: member.userId,
          name: member.name,
        }))}
        categories={categoriesResult.categories}
        currentUserId={context.userId}
      />
    </div>
  );
}
