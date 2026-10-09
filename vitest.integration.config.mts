import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Configuração dos testes de INTEGRAÇÃO (`npm run test:rls`).
 *
 * Diferente do `npm test`, estes testes falam com um Supabase de verdade e
 * **criam dados**: dois usuários e uma família. Por isso só podem rodar contra
 * um banco **descartável** — o Supabase local desta máquina ou o que sobe
 * dentro do CI (job `isolation`).
 *
 * ## A trava
 *
 * O alvo padrão é o Supabase local. Se `SUPABASE_TEST_URL` apontar para
 * qualquer outro host, esta configuração **falha antes de rodar um único
 * teste**, a menos que se confirme de propósito com `RLS_ALLOW_REMOTE=true`.
 *
 * A trava existe por um motivo concreto: o padrão antigo caía no `.env.local`,
 * que aponta para o projeto de verdade. Um `npm run test:rls` criava contas
 * reais lá — e apagar usuário exige a chave secreta, que este teste não usa,
 * então o resíduo só saía pelo painel, na mão.
 *
 * Só a chave **publishable** é usada: o teste se comporta como um usuário
 * comum do app. Nenhum teste precisa da chave secreta.
 */

/** Endereço do Supabase que o CLI sobe (`npx supabase start`). */
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

/**
 * Chave publicável do Supabase local.
 *
 * **Não é segredo:** é o valor fixo que o CLI usa em qualquer máquina, e vale
 * apenas para o stack local (é o mesmo que aparece em `supabase status -o env`).
 * Está escrita aqui para `npm run test:rls` funcionar sem ninguém precisar
 * copiar variável nenhuma. O mesmo valor existe em `scripts/dev-local.mjs` —
 * se um dia o CLI mudar, mude nos dois.
 */
const LOCAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

/** Diz se o endereço é um banco descartável (desta máquina ou do runner do CI). */
function pointsToDisposableDatabase(url: string): boolean {
  try {
    const { hostname } = new URL(url);

    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/** Explica o bloqueio e mostra as duas saídas possíveis. */
function blockedTargetMessage(targetUrl: string): string {
  return [
    "",
    "Testes de isolamento bloqueados: o alvo não é um banco descartável.",
    "",
    `  Alvo: ${targetUrl}`,
    "",
    "Estes testes CRIAM dois usuários e uma família. Num projeto de verdade",
    "isso vira resíduo que só sai pelo painel — apagar usuário exige a chave",
    "secreta, que o teste não usa.",
    "",
    "Contra o Supabase local (o caminho normal):",
    "",
    "  npx supabase start",
    "  npm run test:rls",
    "",
    "Se o alvo é mesmo um projeto real e você aceita criar essas contas lá:",
    "",
    "  RLS_ALLOW_REMOTE=true npm run test:rls",
    "",
  ].join("\n");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const targetUrl = process.env.SUPABASE_TEST_URL ?? LOCAL_SUPABASE_URL;
  const targetIsDisposable = pointsToDisposableDatabase(targetUrl);
  const remoteExplicitlyAllowed = process.env.RLS_ALLOW_REMOTE === "true";

  if (!targetIsDisposable && !remoteExplicitlyAllowed) {
    throw new Error(blockedTargetMessage(targetUrl));
  }

  if (!targetIsDisposable) {
    // Quem chegou aqui pediu de propósito — mas que fique registrado.
    console.warn(
      `\n⚠️  Testes de isolamento apontando para um banco REMOTO: ${targetUrl}\n` +
        "   Serão criados (ou reutilizados) dois usuários e uma família lá.\n",
    );
  }

  const targetKey =
    process.env.SUPABASE_TEST_KEY ??
    (targetIsDisposable
      ? LOCAL_SUPABASE_PUBLISHABLE_KEY
      : (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""));

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
        RLS_TEST_URL: targetUrl,
        RLS_TEST_KEY: targetKey,
      },
    },
  };
});
