import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/server/session";

import { signOutAction } from "../actions";
import { CreateFamilyForm } from "./create-family-form";
import { JoinFamilyForm } from "./join-family-form";

export const metadata: Metadata = {
  title: "Sua família",
};

/**
 * Onboarding — o passo entre ter conta e ter família.
 *
 * O `<Suspense>` aqui não é enfeite: o conteúdo depende da sessão (cookie +
 * validação do token), então ele precisa de um limite explícito para o Next
 * conseguir pré-renderizar a casca e transmitir o resto (ver
 * `getSessionContext` em `src/server/session.ts`). Sem ele, o dev overlay acusa
 * `blocking-prerender-dynamic`.
 */
export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-6">
      <Suspense fallback={<OnboardingPlaceholder />}>
        <OnboardingContent />
      </Suspense>
    </main>
  );
}

/** Casca estática: o que dá para mostrar antes de saber quem está logado. */
function OnboardingPlaceholder() {
  return (
    <div className="space-y-2 text-center" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="mx-auto h-7 w-40" />
      <Skeleton className="mx-auto h-4 w-56" />
    </div>
  );
}

async function OnboardingContent() {
  const context = await requireSession();

  // Só faz sentido para quem ainda **não** tem família: quem já tem vai direto
  // para a visão geral.
  if (context.household) {
    redirect("/");
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sua família</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Olá, {context.profile.name}! Crie a família ou entre em uma que já
          existe.
        </p>
      </div>

      <CreateFamilyForm />
      <JoinFamilyForm />

      <form action={signOutAction} className="text-center">
        <Button type="submit" variant="ghost" size="sm">
          Sair da conta
        </Button>
      </form>
    </>
  );
}
