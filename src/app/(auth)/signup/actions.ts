"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signUpWithPassword } from "@/server/auth";

/** Estado do formulário de cadastro devolvido pela Server Action. */
export type SignUpFormState = {
  error: string | null;
  /** Mensagem de sucesso quando o projeto exige confirmação de e-mail. */
  info: string | null;
};

const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe seu nome.")
    .max(80, "O nome está longo demais."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres."),
});

/**
 * Server Action do cadastro.
 *
 * Valida no servidor (a validação do browser é conveniência) e delega para a
 * camada de autenticação. Quem entra sem precisar confirmar e-mail vai direto
 * para o onboarding — lá escolhe criar a família ou usar um código de convite.
 */
export async function signUpAction(
  _previousState: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
      info: null,
    };
  }

  const { error, needsEmailConfirmation } = await signUpWithPassword(
    parsed.data,
  );

  if (error) {
    return { error, info: null };
  }

  // Projeto com confirmação de e-mail ligada: não há sessão ainda, então não dá
  // para seguir para o onboarding. Avisamos em vez de deixar a pessoa perdida.
  if (needsEmailConfirmation) {
    return {
      error: null,
      info: "Conta criada! Confirme o e-mail que enviamos para poder entrar.",
    };
  }

  // `redirect` lança internamente; o retorno abaixo nunca é alcançado.
  redirect("/onboarding");
}
