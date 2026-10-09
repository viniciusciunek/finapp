import { cookies } from "next/headers";
import { cache } from "react";

import { parseScope, type Scope } from "@/domain/scope";

/**
 * Nome do cookie que guarda a preferência de visão (pessoal ou família).
 *
 * Sem prefixo `__Host-` porque o app também roda em `http://localhost` no
 * desenvolvimento, onde esse prefixo é recusado pelo navegador.
 */
export const SCOPE_COOKIE = "finapp_scope";

/**
 * Opções do cookie de escopo.
 *
 * - `httpOnly`: o escopo só é lido no servidor; não há motivo para o JavaScript
 *   da página enxergá-lo.
 * - `sameSite: lax`: sobrevive à navegação normal e não vai em requisição de
 *   outro site.
 * - `secure` só em produção, senão o navegador recusa o cookie em `localhost`.
 */
export const SCOPE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
} as const;

/**
 * Escopo ativo da requisição.
 *
 * Fica em cookie (e não na URL) para o usuário não perder a escolha ao navegar.
 * O valor é validado por `parseScope` — cookie é entrada controlada pelo
 * usuário. Embrulhado em `cache()`: layout e páginas leem uma vez por requisição.
 */
export const getScope = cache(async (): Promise<Scope> => {
  const cookieStore = await cookies();

  return parseScope(cookieStore.get(SCOPE_COOKIE)?.value);
});
