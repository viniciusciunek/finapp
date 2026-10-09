import type { ReactNode } from "react";

/**
 * Layout das telas públicas: `/login` e `/signup`.
 *
 * O grupo `(auth)` não aparece na URL — serve só para agrupar arquivos e
 * compartilhar este enquadramento (conteúdo centralizado, respiro no celular).
 * Como não lê nada da requisição, esta parte é casca estática: aparece na hora.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      {children}
    </main>
  );
}
