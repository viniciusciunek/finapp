import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

/**
 * Configuração do Vitest para os testes UNITÁRIOS (regras puras em src/domain).
 *
 * - Ambiente `node`: domínio não conhece DOM, React ou banco de dados.
 * - Alias `@/*` replicado do tsconfig.json para os testes importarem igual ao app.
 * - Os testes de integração (`*.integration.test.ts`) ficam DE FORA daqui de
 *   propósito: eles falam com um Supabase de verdade, criam dados e exigem
 *   credenciais. Rodam no comando separado `npm run test:rls`. Assim o `npm test`
 *   e o CI continuam rápidos, hermeticos e sem segredo nenhum.
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
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
  },
});
