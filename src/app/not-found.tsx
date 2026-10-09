import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Página de "não existe".
 *
 * A primeira tela do app a chamar `notFound()` foi a edição de conta e cartão
 * (id que não existe, ou que é de outra pessoa e o RLS esconde). Até então o
 * 404 era o padrão do Next, em inglês, no meio de um app em português.
 *
 * Aqui não se lê cookie nem sessão: esta página precisa poder ser servida para
 * qualquer endereço errado, inclusive para quem não está logado.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Esta página não existe</h1>
        <p className="text-muted-foreground text-sm">
          O endereço pode estar errado ou o item pode ter sido apagado.
        </p>
      </div>

      <Button asChild variant="outline">
        <Link href="/">Voltar para o início</Link>
      </Button>
    </main>
  );
}
