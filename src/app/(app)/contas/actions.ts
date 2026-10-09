"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ACCOUNT_TYPES } from "@/domain/account";
import { createAccount } from "@/server/accounts";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

/** Estado do formulário de conta devolvido pela Server Action. */
export type AccountFormState = {
  error: string | null;
};

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome para a conta.")
    .max(60, "O nome está longo demais."),
  // Banco é opcional de propósito: dinheiro em espécie não tem banco. O campo
  // vazio vira `null` depois da validação (o banco distingue "sem banco" de
  // "banco vazio").
  bank: z.string().trim().max(60, "O nome do banco está longo demais."),
  type: z.enum(ACCOUNT_TYPES, "Escolha o tipo da conta."),
});

/**
 * Cria a conta no escopo ativo.
 *
 * O escopo **não** vem do formulário: vem do cookie, lido aqui no servidor.
 * Campo escondido no HTML é entrada do usuário — quem abrisse o inspetor poderia
 * criar uma conta "pessoal" achando que era da família, ou o contrário.
 */
export async function createAccountAction(
  _previousState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const context = await requireHousehold();
  const scope = await getScope();

  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    bank: formData.get("bank"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const { error } = await createAccount(
    { scope, userId: context.userId, householdId: context.household.id },
    {
      name: parsed.data.name,
      bank: parsed.data.bank === "" ? null : parsed.data.bank,
      type: parsed.data.type,
    },
  );

  if (error) {
    return { error };
  }

  redirect("/contas");
}
