import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Configuração dos testes de INTEGRAÇÃO.
 *
 * Diferente do `npm test`, estes testes falam com um Supabase de verdade e
 * criam dados — por isso vivem em arquivo e comando separados
 * (`npm run test:rls`), e **não** entram no CI (que continua hermético, sem
 * segredo nenhum).
 *
 * De onde vêm as credenciais (em ordem de precedência):
 *   1. `SUPABASE_TEST_URL` / `SUPABASE_TEST_KEY` no ambiente — útil para
 *      apontar para um Supabase local (`npx supabase start`);
 *   2. `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do
 *      `.env.local` — o mesmo projeto que o app usa.
 *
 * Só a chave **publishable** é necessária: o teste se comporta como um usuário
 * comum do app. Nenhum teste precisa da chave secreta.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const supabaseUrl =
    process.env.SUPABASE_TEST_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_TEST_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.integration.test.ts"],
      testTimeout: 30_000,
      hookTimeout: 60_000,
      // Um arquivo por vez: os cenários compartilham os mesmos usuários de teste
      // no mesmo banco, então paralelismo embaralharia o estado.
      fileParallelism: false,
      env: {
        RLS_TEST_URL: supabaseUrl,
        RLS_TEST_KEY: supabaseKey,
      },
    },
  };
});
