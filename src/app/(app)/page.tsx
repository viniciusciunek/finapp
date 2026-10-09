import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

/**
 * Visão geral — a tela inicial do app.
 *
 * Nesta fatia ela mostra o essencial do contexto: qual visão está ativa e o que
 * cada visão significa. A Folha do mês entra aqui na Fatia 5.
 *
 * O estado ativo vem de cookie (`getScope`), não de parâmetro na URL: assim a
 * escolha do usuário sobrevive à navegação sem poluir o endereço.
 *
 * O conteúdo fica dentro de um `<Suspense>`: ele depende de cookie e da
 * validação do token, então precisa de um limite explícito para a casca ser
 * pré-renderizada (ver `src/server/session.ts`).
 */
export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewPlaceholder />}>
      <OverviewContent />
    </Suspense>
  );
}

function OverviewPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

async function OverviewContent() {
  const context = await requireHousehold();
  const scope = await getScope();

  const isHouseholdView = scope === "household";

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {isHouseholdView ? "Visão da família" : "Sua visão"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isHouseholdView
            ? `Tudo que é compartilhado com ${context.household.name} aparece aqui.`
            : "O que é só seu — invisível para qualquer outra pessoa, inclusive para a família."}
        </p>
      </div>

      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium">Nada por aqui ainda</p>
        <p className="text-muted-foreground mt-1 text-sm">
          As contas, os cartões e a Folha do mês entram nas próximas fatias.
        </p>
      </div>
    </section>
  );
}
