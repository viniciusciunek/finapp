"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isUuid } from "@/domain/uuid";
import { parseCentsFromText } from "@/domain/money";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/server/transactions";
import { createCategory } from "@/server/categories";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";

/**
 * Estado do formulário de lançamento.
 *
 * `category` só vem preenchida pela ação de criar categoria: é como o
 * formulário recebe de volta o que acabou de nascer, para marcar a opção nova
 * sem recarregar a tela (e sem perder o que já estava digitado).
 */
export type TransactionFormState = {
  error: string | null;
  category?: { id: string; name: string };
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
  // Descrição livre, opcional: o rótulo curto fica em `description`.
  notes: z
    .string()
    .trim()
    .max(500, "A descrição está longa demais.")
    .transform((value) => (value === "" ? null : value)),
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
    notes: formData.get("notes"),
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
      notes: parsed.data.notes,
    },
  );

  if (error) {
    return { error };
  }

  // Volta para a Visão geral, que é onde a pessoa vê a lista do mês.
  redirect("/");
}

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome para a categoria.")
    .max(40, "O nome está longo demais."),
});

/**
 * Cria uma categoria no escopo ativo, no meio do lançamento.
 *
 * Devolve a categoria criada para o formulário poder selecioná-la na hora — se
 * isso obrigasse a sair da tela e voltar, o lançamento de 15 segundos viraria
 * dois. Nome repetido volta como erro de negócio (23505), com o texto do banco.
 */
export async function createCategoryAction(
  _previousState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const parsed = categorySchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const { id, error } = await createCategory(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.name,
  );

  if (error || !id) {
    return { error: error ?? "Não foi possível criar a categoria." };
  }

  return { error: null, category: { id, name: parsed.data.name } };
}

/** Id vindo da URL ou de campo escondido: entra como texto, sai validado. */
const entityId = z
  .string()
  .refine(isUuid, "Este endereço não é válido. Volte para a lista do mês.");

const updateSchema = quickEntrySchema.extend({ id: entityId });

/** Salva as mudanças do lançamento (escopo e dono não mudam — o banco recusaria). */
export async function updateTransactionAction(
  _previousState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    description: formData.get("description"),
    notes: formData.get("notes"),
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

  await requireHousehold();

  const { error } = await updateTransaction(parsed.data.id, {
    description: parsed.data.description,
    categoryId: parsed.data.categoryId,
    totalCents,
    occurredOn: parsed.data.occurredOn,
    paymentMethod: parsed.data.paymentMethod,
    accountId: parsed.data.accountId,
    cardId: null,
    installmentsCount: 1,
    notes: parsed.data.notes,
  });

  if (error) {
    return { error };
  }

  redirect("/");
}

/**
 * Apaga o lançamento.
 *
 * A confirmação em dois toques fica na tela, como no apagar de conta e cartão.
 * No servidor, apagar o que já não existe é sucesso: a lista fica sem ele dos
 * dois jeitos.
 */
export async function deleteTransactionAction(
  _previousState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const parsed = z
    .object({ id: entityId })
    .safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const { error } = await deleteTransaction(parsed.data.id);

  if (error) {
    return { error };
  }

  redirect("/");
}
