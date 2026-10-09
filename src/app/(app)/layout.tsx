import { Suspense, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

import { AppNav } from "./_components/app-nav";
import { ScopeSwitch } from "./_components/scope-switch";

/**
 * Shell do app autenticado: cabeçalho com a família, alternância de visão,
 * conteúdo e barra de navegação fixa embaixo (mobile-first).
 *
 * ## Por que existe um `<Suspense>` no meio do layout
 *
 * O cabeçalho mostra a família e o nome de quem está logado, então essa parte
 * depende de cookie **e** da validação do token — dados que só existem na
 * requisição. Com os Cache Components do Next 16, esse acesso precisa de um
 * limite `<Suspense>` explícito: o enquadramento e a barra inferior são
 * pré-renderizados como casca, e o cabeçalho entra logo depois, transmitido
 * junto da resposta.
 *
 * Sem o limite, o Next 16 acusa `blocking-prerender-dynamic` no servidor. Note
 * que o `loading.tsx` deste grupo **não** resolve esse caso: ele envolve o
 * conteúdo das páginas, não o layout que as contém.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col">
      <Suspense fallback={<AppChromePlaceholder />}>
        <AppChrome />
      </Suspense>

      <main className="flex-1 px-4 py-4 pb-24">{children}</main>

      <AppNav />
    </div>
  );
}

/**
 * Cabeçalho + alternância de visão, já com os dados da requisição em mãos.
 *
 * `requireHousehold()` garante sessão **e** família: sem família, o usuário vai
 * para o onboarding em vez de ver uma tela vazia.
 */
async function AppChrome() {
  const context = await requireHousehold();
  const scope = await getScope();

  return (
    <>
      <header className="flex items-baseline justify-between gap-4 px-4 pt-6 pb-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Família</p>
          <p className="truncate font-medium">{context.household.name}</p>
        </div>
        <p className="text-muted-foreground shrink-0 text-sm">
          {context.profile.name}
        </p>
      </header>

      <div className="px-4 py-2">
        <ScopeSwitch scope={scope} />
      </div>
    </>
  );
}

/**
 * Casca do cabeçalho. Os blocos têm a mesma altura do conteúdo real para a tela
 * não "pular" quando os dados chegam.
 */
function AppChromePlaceholder() {
  return (
    <>
      <div
        className="flex items-baseline justify-between gap-4 px-4 pt-6 pb-2"
        aria-busy="true"
      >
        <span className="sr-only">Carregando…</span>
        <div className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="px-4 py-2">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </>
  );
}
