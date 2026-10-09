import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Bloco cinza pulsante que representa conteúdo que ainda está carregando.
 *
 * Existe para os estados de carregamento serem **parecidos entre si**: sem isso,
 * cada tela inventa o seu "Carregando…" e a interface fica irregular. É usado
 * como `fallback` dos limites `<Suspense>` (ver `(app)/layout.tsx`).
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
