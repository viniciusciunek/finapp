import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getSessionContext } from "@/server/session";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

/**
 * Cadastro (Server Component).
 *
 * Quem já tem sessão não vê o formulário: vai direto para onde faz sentido —
 * o onboarding (se ainda não tem família) ou a visão geral.
 *
 * A checagem fica dentro de um `<Suspense>` pelo mesmo motivo do `/login`:
 * depende de cookie e da validação do token.
 */
export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpPlaceholder />}>
      <SignUpContent />
    </Suspense>
  );
}

function SignUpPlaceholder() {
  return (
    <div className="w-full space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="mx-auto h-8 w-44" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

async function SignUpContent() {
  const context = await getSessionContext();

  if (context) {
    redirect(context.household ? "/" : "/onboarding");
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Leva menos de um minuto. Depois você cria a família ou entra com um
          código de convite.
        </p>
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-sm">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </>
  );
}
