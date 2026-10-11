import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { monthName } from "@/domain/month";
import { formatBrl } from "@/lib/format";
import { listCategories } from "@/server/categories";
import { listHouseholdMembers } from "@/server/households";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import {
  listRecurringTemplates,
  type RecurringTemplate,
} from "@/server/sheets";

import { TemplateToggle } from "./_components/template-toggle";

export const metadata: Metadata = {
  title: "Contas fixas",
};

/**
 * Contas fixas — os modelos que geram a folha todo mês (§4.4).
 *
 * Mesma visão da folha (o escopo vem do cookie): pessoal mostra as suas;
 * família, as da casa. Não se apaga no uso normal: desativa — o retrato de
 * cada mês já gerado não muda.
 */
export default function TemplatesPage() {
  return (
    <Suspense fallback={<TemplatesPlaceholder />}>
      <TemplatesContent />
    </Suspense>
  );
}

function TemplatesPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/** Linha de detalhes: "todo dia 10 · todo mês · paga por … · Água". */
function metaFor(
  template: RecurringTemplate,
  categoryNames: Map<string, string>,
  memberNames: Map<string, string>,
): string {
  const parts = [
    `todo dia ${template.dueDay}`,
    template.frequency === "yearly" && template.yearlyMonth !== null
      ? `todo ano em ${monthName(template.yearlyMonth)}`
      : "todo mês",
  ];

  const payerName = template.payerUserId
    ? memberNames.get(template.payerUserId)
    : undefined;

  if (payerName) {
    parts.push(`paga por ${payerName}`);
  }

  const categoryName = template.categoryId
    ? categoryNames.get(template.categoryId)
    : undefined;

  if (categoryName) {
    parts.push(categoryName);
  }

  return parts.join(" · ");
}

function TemplateRow({
  template,
  meta,
}: {
  template: RecurringTemplate;
  meta: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 p-3">
      <Link
        href={`/folha/fixas/${template.id}/editar`}
        className="min-w-0 flex-1"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{template.name}</p>
          <p className="text-sm font-medium">
            {formatBrl(template.defaultAmountCents)}
          </p>
        </div>
        <p className="text-muted-foreground text-xs">{meta}</p>
      </Link>

      <TemplateToggle templateId={template.id} active={template.active} />
    </li>
  );
}

async function TemplatesContent() {
  const context = await requireHousehold();
  const scope = await getScope();
  const isHouseholdView = scope === "household";

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  const [templatesResult, categoriesResult, membersResult] = await Promise.all([
    listRecurringTemplates(ownership),
    listCategories(ownership),
    isHouseholdView ? listHouseholdMembers(context.household.id) : null,
  ]);

  // Categorias e membros só dão nome às linhas; se falharem, a lista continua
  // útil — por isso só o erro das fixas aparece na tela.
  const categoryNames = new Map(
    categoriesResult.categories.map((category) => [category.id, category.name]),
  );
  const memberNames = new Map(
    (membersResult?.members ?? []).map((member) => [
      member.userId,
      member.name,
    ]),
  );

  const active = templatesResult.templates.filter(
    (template) => template.active,
  );
  const inactive = templatesResult.templates.filter(
    (template) => !template.active,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/folha"
          className="text-muted-foreground text-sm underline underline-offset-2"
        >
          ← Folha
        </Link>
        <h2 className="text-lg font-semibold">
          {isHouseholdView ? "Contas fixas da família" : "Suas contas fixas"}
        </h2>
        <p className="text-muted-foreground text-sm">
          As contas que se repetem — água, luz, internet. Elas viram itens da
          folha sozinhas, todo mês, no dia do vencimento.
        </p>
      </div>

      <Button asChild>
        <Link href="/folha/fixas/nova">Nova conta fixa</Link>
      </Button>

      {templatesResult.error ? (
        <p className="text-destructive text-sm">{templatesResult.error}</p>
      ) : null}

      {active.length === 0 &&
      inactive.length === 0 &&
      !templatesResult.error ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Nenhuma conta fixa ainda</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Cadastre a água, a luz, a internet — e a folha dos próximos meses
            nasce sozinha.
          </p>
        </div>
      ) : null}

      {active.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium uppercase">
            Ativas
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {active.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                meta={metaFor(template, categoryNames, memberNames)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {inactive.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium uppercase">
            Desativadas
          </h3>
          <p className="text-muted-foreground text-xs">
            Não entram nas folhas novas; as já geradas ficam como estão.
          </p>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {inactive.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                meta={metaFor(template, categoryNames, memberNames)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
