import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { listCategories } from "@/server/categories";
import { listHouseholdMembers } from "@/server/households";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

import { TemplateForm } from "../_components/template-form";

export const metadata: Metadata = {
  title: "Nova conta fixa",
};

/** Nova conta fixa — o formulário em modo `create`. */
export default function NewTemplatePage() {
  return (
    <Suspense fallback={<FormPlaceholder />}>
      <NewTemplateContent />
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

async function NewTemplateContent() {
  const context = await requireHousehold();
  const scope = await getScope();
  const isHouseholdView = scope === "household";

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  const [membersResult, categoriesResult] = await Promise.all([
    isHouseholdView ? listHouseholdMembers(context.household.id) : null,
    listCategories(ownership),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/folha/fixas"
        className="text-muted-foreground text-sm underline underline-offset-2"
      >
        ← Contas fixas
      </Link>

      <TemplateForm
        mode="create"
        description={
          isHouseholdView
            ? "Vai entrar na folha da família, todo mês."
            : "Vai entrar só na sua folha."
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
