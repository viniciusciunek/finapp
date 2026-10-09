import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getSessionContext } from "@/server/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

/**
 * Login (Server Component).
 *
 * Verifica a sessão **no servidor** antes de renderizar: quem já está logado vai
 * direto para onde faz sentido — o onboarding (se ainda não tem família) ou a
 * visão geral.
 *
 * Nota: aqui há dois "portões" — este e o do `src/proxy.ts`. O proxy renova a
 * sessão; a checagem de verdade fica nesta camada.
 *
 * A checagem fica dentro de um `<Suspense>` porque depende de cookie e da
 * validação do token: sem o limite explícito, o Next 16 acusa
 * `blocking-prerender-dynamic`. Com ele, a casca da tela aparece na hora e o
 * formulário entra logo depois.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPlaceholder />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginPlaceholder() {
  return (
    <div className="w-full space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="mx-auto h-8 w-52" />
        <Skeleton className="mx-auto h-4 w-64" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}

async function LoginContent() {
  const context = await getSessionContext();

  if (context) {
    redirect(context.household ? "/" : "/onboarding");
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Finanças do Casal
        </h1>
        <p className="text-muted-foreground text-sm text-balance">
          Entre para continuar. Suas contas e as da família em um só lugar.
        </p>
      </div>

      <LoginForm />

      <p className="text-muted-foreground text-sm">
        Ainda não tem conta?{" "}
        <Link
          href="/signup"
          className="text-foreground underline underline-offset-4"
        >
          Criar conta
        </Link>
      </p>
    </>
  );
}
