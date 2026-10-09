"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signInWithPassword } from "@/server/auth";

/** Estado do formulário de login devolvido pela Server Action. */
export type SignInFormState = {
  error: string | null;
};

const signInSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

/**
 * Server Action do formulário de login.
 *
 * Valida a entrada com Zod **no servidor** (a validação do browser é só
 * conveniência; quem decide é aqui) e delega a autenticação para `src/server/`.
 */
export async function signInAction(
  _previousState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const { error } = await signInWithPassword(parsed.data);

  if (error) {
    // A mensagem já vem traduzida de `src/server/auth.ts` e continua genérica
    // quando as credenciais são inválidas — não revela se o e-mail existe.
    return { error };
  }

  // `redirect` lança internamente; o retorno abaixo nunca é alcançado.
  redirect("/");
}
