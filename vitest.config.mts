import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Configuração do Vitest para as regras de negócio puras (src/domain).
 *
 * - Ambiente `node`: domínio não conhece DOM, React ou banco de dados.
 * - Alias `@/*` replicado do tsconfig.json para os testes importarem igual ao app.
 *
 * Testes de componente (quando existirem) precisarão de ambiente próprio (jsdom);
 * até lá, manter simples.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
