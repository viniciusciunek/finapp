/**
 * Leitura e validação das variáveis de ambiente públicas do Supabase.
 *
 * As duas variáveis usam o prefixo `NEXT_PUBLIC_` e por isso são embutidas no
 * bundle do browser. Isso é esperado: a chave "publishable" é pública por
 * definição e quem protege os dados é o Row Level Security (RLS) do Postgres,
 * não o segredo da chave (ver docs/DOMAIN.md §3).
 *
 * A chave SECRETA (`service_role` / `sb_secret_...`) nunca deve chegar aqui:
 * ela ignora o RLS.
 */
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Configuração do Supabase ausente. Copie .env.example para .env.local e preencha " +
        "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}
