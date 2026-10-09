import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Cliente Supabase para código que roda no **browser** (Client Components).
 *
 * `createBrowserClient` já aplica singleton internamente: pode ser chamado
 * quantas vezes for necessário — uma única instância será reutilizada.
 *
 * Tipado com `Database` (gerado por `npm run db:types`): as consultas conhecem
 * as tabelas, colunas e funções reais do banco.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
