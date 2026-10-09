import { translateAuthError } from "@/lib/auth-messages";
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
 *
 * Em caso de sucesso retorna `{ error: null }`; caso contrário, a mensagem já
 * traduzida e sem jargão (ver `src/lib/auth-messages.ts`). A tradução preserva
 * o genérico em "credenciais inválidas" — não revelamos se o e-mail existe.
 */
export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword(input);

  return { error: error ? translateAuthError(error.message) : null };
}

/** Resultado do cadastro, no formato que a tela de cadastro precisa. */
export type SignUpResult = {
  error: string | null;
  /**
   * `true` quando o projeto exige confirmação de e-mail: a conta foi criada,
   * mas ainda **não há sessão**. Sem isso, quem cadastra com a confirmação
   * ligada ficaria preso sem entender o motivo.
   */
  needsEmailConfirmation: boolean;
};

/**
 * Cria a conta (nome, e-mail e senha).
 *
 * O nome vai em `options.data`, de onde o trigger `handle_new_user` o lê para
 * preencher `profiles.name` — o perfil nasce junto com a conta, no banco.
 */
export async function signUpWithPassword(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SignUpResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name } },
  });

  if (error) {
    return {
      error: translateAuthError(error.message),
      needsEmailConfirmation: false,
    };
  }

  return { error: null, needsEmailConfirmation: !data.session };
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
