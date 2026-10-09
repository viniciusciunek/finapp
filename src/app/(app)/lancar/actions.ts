"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isUuid } from "@/domain/uuid";
import { parseCentsFromText } from "@/domain/money";
import { createTransaction } from "@/server/transactions";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

/** Estado do formulário de lançamento devolvido pela Server Action. */
export type TransactionFormState = {
  error: string | null;
};

/**
 * Meios aceitos pelo lançamento rápido.
 *
 * Crédito **não** entra aqui: ele é a Fatia 4, junto com parcelas e fatura.
 * Deixar o crédito fora agora evita a compra no cartão ter dois caminhos
 * diferentes vivendo ao mesmo tempo.
 */
const QUICK_PAYMENT_METHODS = ["pix", "cash", "debit", "boleto"] as const;

const optionalId = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || isUuid(value),
    "Escolha uma opção da lista.",
  );

const quickEntrySchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Escreva no que foi o gasto.")
    .max(80, "A descrição está longa demais."),
  // Texto livre: quem digita escreve "12,50", não "1250".
  amount: z.string().trim().min(1, "Informe o valor."),
  categoryId: optionalId,
  accountId: z
    .string()
    .refine(isUuid, "Escolha de qual conta saiu o dinheiro."),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Confira a data."),
  paymentMethod: z.enum(QUICK_PAYMENT_METHODS, "Escolha como foi pago."),
});

/**
 * Lança uma despesa no escopo ativo.
 *
 * Igual às ações de conta e cartão: o escopo vem do **cookie, lido no servidor**.
 * O formulário só diz o que aconteceu — nunca de quem é.
 */
export async function createTransactionAction(
  _previousState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const parsed = quickEntrySchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    accountId: formData.get("accountId"),
    occurredOn: formData.get("occurredOn"),
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const totalCents = parseCentsFromText(parsed.data.amount);

  if (totalCents === null || totalCents <= 0) {
    return { error: "Confira o valor: use algo como 12,50." };
  }

  // Sessão e escopo depois da validação: erro de digitação não custa ida ao banco.
  const context = await requireHousehold();
  const scope = await getScope();

  const { error } = await createTransaction(
    { scope, userId: context.userId, householdId: context.household.id },
    {
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      totalCents,
      occurredOn: parsed.data.occurredOn,
      paymentMethod: parsed.data.paymentMethod,
      accountId: parsed.data.accountId,
      cardId: null,
      installmentsCount: 1,
      notes: null,
    },
  );

  if (error) {
    return { error };
  }

  // Volta para a Visão geral, que é onde a pessoa vê a lista do mês.
  redirect("/");
}
