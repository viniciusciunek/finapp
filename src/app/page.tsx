import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getAuthenticatedUser } from "@/server/auth";

import { signOutAction } from "./actions";

/**
 * Visão inicial — rota protegida.
 *
 * O placeholder abaixo será substituído pela Folha do mês nas próximas fatias.
 * O que importa aqui é provar o fluxo completo: sem sessão válida, o usuário é
 * mandado para `/login`; com sessão, vê os próprios dados.
 */
export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Finanças do Casal
        </h1>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>

      <section className="space-y-3">
        <p className="text-sm">
          Você entrou como <strong>{user.email ?? user.id}</strong>.
        </p>
        <p className="text-muted-foreground text-sm">
          Fundação pronta: login, Supabase e testes funcionando. A Folha do mês
          começa a ser construída na próxima fatia.
        </p>
      </section>
    </main>
  );
}
