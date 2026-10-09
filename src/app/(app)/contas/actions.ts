"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ACCOUNT_TYPES } from "@/domain/account";
import { BILLING_DAY_MAX, BILLING_DAY_MIN } from "@/domain/credit-card";
import { parseCentsFromText } from "@/domain/money";
import { createAccount } from "@/server/accounts";
import { createCreditCard } from "@/server/credit-cards";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

/**
 * Estado devolvido pelas Server Actions de conta e de cartão: quando dá certo o
 * `redirect` acontece, então só existe estado para mostrar quando há erro.
 */
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

const billingDay = (label: string) =>
  z.coerce
    .number()
    .int(`${label} precisa ser um número inteiro.`)
    .min(BILLING_DAY_MIN, `O dia de ${label.toLowerCase()} vai de 1 a 31.`)
    .max(BILLING_DAY_MAX, `O dia de ${label.toLowerCase()} vai de 1 a 31.`);

const cardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome para o cartão.")
    .max(60, "O nome está longo demais."),
  closingDay: billingDay("Fechamento"),
  dueDay: billingDay("Vencimento"),
  // Texto livre: quem digita escreve "1.234,56", não "123456".
  limit: z.string().trim(),
});

/**
 * Cria o cartão no escopo ativo — mesma regra da conta: o escopo vem do cookie,
 * lido no servidor, nunca de um campo do formulário.
 */
export async function createCreditCardAction(
  _previousState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const context = await requireHousehold();
  const scope = await getScope();

  const parsed = cardSchema.safeParse({
    name: formData.get("name"),
    closingDay: formData.get("closingDay"),
    dueDay: formData.get("dueDay"),
    limit: formData.get("limit"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const limitCents =
    parsed.data.limit === "" ? null : parseCentsFromText(parsed.data.limit);

  // Limite é opcional, mas se foi digitado precisa fazer sentido: melhor dizer
  // o formato esperado do que gravar um número errado.
  if (parsed.data.limit !== "" && limitCents === null) {
    return { error: "Confira o limite: use algo como 1.234,56." };
  }

  const { error } = await createCreditCard(
    { scope, userId: context.userId, householdId: context.household.id },
    {
      name: parsed.data.name,
      closingDay: parsed.data.closingDay,
      dueDay: parsed.data.dueDay,
      limitCents,
    },
  );

  if (error) {
    return { error };
  }

  redirect("/contas");
}
