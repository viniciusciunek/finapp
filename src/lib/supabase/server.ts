import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * O `fetch` dos Server Components **memoiza** GETs idênticos dentro do mesmo
 * render (a doc do Next explica: `fetch.md`, seção "Memoization"): duas
 * consultas iguais no mesmo request viram uma só. Numa operação de
 * "grava e lê" — abrir a folha faz o insert da linha e o top-up dos itens e,
 * logo depois, a leitura para a tela usa a MESMA URL — a memoização devolveria
 * o retrato de antes: a folha recém-criada apareceria vazia.
 *
 * O opt-out documentado é passar um `AbortSignal`: cada consulta vira única e
 * nunca mente sobre o que acabou de ser gravado. O sinal de quem chamou
 * (quando existir) é preservado.
 */
const fetchWithoutMemoization: typeof fetch = (input, init) => {
  if (init?.signal) {
    return fetch(input, init);
  }

  return fetch(input, { ...init, signal: new AbortController().signal });
};

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

  return createServerClient<Database>(url, publishableKey, {
    global: {
      fetch: fetchWithoutMemoization,
    },
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
