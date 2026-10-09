"use client";

import { Home, UserRound, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Itens da barra inferior, na ordem de uso esperado no dia a dia.
 * Só entram telas que existem hoje — item que não leva a lugar nenhum confunde.
 *
 * "Contas" (bancárias) e "Perfil" (a conta do usuário) ficam longe uma da outra
 * de propósito: lado a lado, "Conta" e "Contas" seriam confundidos no celular.
 */
const NAV_ITEMS = [
  { href: "/", label: "Visão geral", icon: Home },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/familia", label: "Família", icon: Users },
  { href: "/perfil", label: "Perfil", icon: UserRound },
] as const;

/**
 * Barra de navegação fixa no rodapé (padrão de app de celular: alvo grande e ao
 * alcance do polegar).
 *
 * É Client Component só por causa do `usePathname`, que decide o item ativo.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background/95 fixed inset-x-0 bottom-0 border-t backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
