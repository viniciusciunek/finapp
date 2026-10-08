import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

/**
 * Cliente Supabase para código que roda **apenas no servidor**
 * (Server Components, Server Actions e Route Handlers).
 *
 * Um cliente novo por requisição é obrigatório: ele carrega os cookies daquela
 * requisição. Reaproveitar uma instância entre requisições misturaria sessões
 * de usuários diferentes (e, na prática, deslogaria todo mundo).
 *
 * Server Components não podem escrever cookies — por isso o `setAll` abaixo
 * engole o erro. Quem persiste os cookies renovados é o `src/proxy.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Esperado ao rodar dentro de Server Component (não pode escrever cookie).
          // O proxy cuida da renovação; aqui não há nada a corrigir.
        }
      },
    },
  });
}
