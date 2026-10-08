import { createClient } from "@/lib/supabase/server";

/**
 * Operações de autenticação — camada de acesso ao Supabase.
 *
 * As páginas e Server Actions chamam estas funções e **nunca** falam com o
 * cliente Supabase diretamente (regra das instruções do projeto: acesso a
 * dados em camada separada, fora dos componentes de UI).
 */

/** Usuário autenticado, no formato mínimo que a interface precisa. */
export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

/**
 * Assina com e-mail e senha.
 * Em caso de sucesso retorna `{ error: null }`; caso contrário, a mensagem.
 */
export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword(input);

  return { error: error?.message ?? null };
}

/** Encerra a sessão da requisição atual (apaga os cookies de sessão). */
export async function signOut(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();
}

/**
 * Retorna o usuário autenticado da requisição atual, ou `null` se não houver
 * sessão válida.
 *
 * Usa `getClaims()` de propósito: ele **valida a assinatura** do token. Como o
 * cookie de sessão é controlado pelo cliente, ele pode ser forjado — tratá-lo
 * como verdade (via `getSession()` ou lendo o cookie direto) seria uma falha de
 * segurança.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return null;
  }

  return {
    id: data.claims.sub,
    email: data.claims.email ?? null,
  };
}
