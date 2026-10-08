import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * Cliente Supabase para código que roda no **browser** (Client Components).
 *
 * `createBrowserClient` já aplica singleton internamente: pode ser chamado
 * quantas vezes for necessário — uma única instância será reutilizada.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();

  return createBrowserClient(url, publishableKey);
}
