#!/usr/bin/env node
/**
 * Sobe o servidor de desenvolvimento apontando para o Supabase **local**.
 *
 * ## Por que este arquivo existe
 *
 * O `.env.local` aponta para o projeto de verdade. Está certo para desenvolver
 * (você vê os seus dados), mas é perigoso para testar fluxo de cadastro: cada
 * conta criada vai para o projeto real e só sai pelo painel, na mão — apagar
 * usuário exige a chave secreta.
 *
 * Variáveis de ambiente do shell têm precedência sobre os arquivos `.env*` do
 * Next, então este comando troca o alvo **sem tocar no `.env.local`**.
 *
 * ## Uso
 *
 *   npx supabase start     # uma vez, se ainda não estiver rodando
 *   npm run dev:local
 */
import { spawn } from "node:child_process";

/**
 * Mesmo endereço e mesma chave de `vitest.integration.config.mts`: se o CLI um
 * dia mudar o valor, mude nos dois.
 */
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

console.log(
  `\n▶  App apontando para o Supabase local (${LOCAL_SUPABASE_URL}).`,
);
console.log(
  "   Cadastro, convite e testes de fluxo aqui não tocam o projeto real.\n",
);

const child = spawn("next", ["dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_SUPABASE_PUBLISHABLE_KEY,
  },
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(
      "\nNão encontrei o comando `next`. Rode por aqui: npm run dev:local\n",
    );
    process.exit(1);
  }

  throw error;
});

// Repassa Ctrl+C e afins como saída normal, para o shell não ver erro onde não há.
child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
