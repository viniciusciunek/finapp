import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/server/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

/**
 * Página de login (Server Component).
 *
 * Verifica a sessão **no servidor** antes de renderizar: quem já está logado vai
 * direto para a visão geral, sem ver o formulário de novo.
 *
 * Nota: aqui temos dois "portões" — este e o do `src/proxy.ts`. O proxy renova a
 * sessão; a checagem de verdade fica nesta camada.
 */
export default async function LoginPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Finanças do Casal
        </h1>
        <p className="text-muted-foreground text-sm text-balance">
          Entre para continuar. Suas contas e as da família em um só lugar.
        </p>
      </div>

      <LoginForm />
    </main>
  );
}
