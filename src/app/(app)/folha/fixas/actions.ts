"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseCentsFromText } from "@/domain/money";
import type { Scope } from "@/domain/scope";
import { TEMPLATE_NAME_MAX } from "@/domain/sheet";
import { isUuid } from "@/domain/uuid";
import { getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import {
  createRecurringTemplate,
  setRecurringTemplateActive,
  updateRecurringTemplate,
  type RecurringTemplateValues,
} from "@/server/sheets";

/**
 * Ações das contas fixas (modelos recorrentes — §4.4).
 *
 * Mesmo plano das outras telas: o formulário manda texto, o Zod valida, a
 * sessão e o escopo vêm do servidor, e a camada de dados escreve. Criar e
 * salvar levam de volta para a lista; desativar/reativar fica na própria
 * linha, sem sair da tela.
 */

/** Estado dos formulários: quando dá certo o `redirect` acontece; só erro aparece. */
export type TemplateFormState = {
  error: string | null;
};

/** Id vindo de um campo escondido: entra como texto, sai validado. */
const templateId = z
  .string()
  .refine(isUuid, "Esta conta fixa não é válida. Volte para a lista.");

const fieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome para a conta fixa.")
    .max(
      TEMPLATE_NAME_MAX,
      `O nome pode ter até ${TEMPLATE_NAME_MAX} caracteres.`,
    ),
  amount: z.string().trim(),
  dueDay: z.string().trim(),
  frequency: z.enum(["monthly", "yearly"]),
  yearlyMonth: z.string().trim(),
  categoryId: z.string().trim(),
  payerUserId: z.string().trim(),
});

type TemplateFields = z.infer<typeof fieldsSchema>;

/** Os campos do formulário no formato cru que o Zod valida — criar e salvar usam o mesmo. */
function readFields(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get("name"),
    amount: formData.get("amount"),
    dueDay: formData.get("dueDay"),
    frequency: formData.get("frequency"),
    // Campos que só existem em certos modos do formulário chegam como null.
    yearlyMonth: formData.get("yearlyMonth") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    payerUserId: formData.get("payerUserId") ?? "",
  };
}

/**
 * Converte os campos validados nos valores do modelo; cada recusa fala o que a
 * pessoa precisa corrigir. Os limites são os mesmos dos CHECKs do banco.
 */
function toValues(
  fields: TemplateFields,
  scope: Scope,
): { values: RecurringTemplateValues } | { error: string } {
  const defaultAmountCents = parseCentsFromText(fields.amount);

  if (defaultAmountCents === null) {
    return { error: "Confira o valor: use algo como 1.234,56." };
  }

  if (defaultAmountCents <= 0) {
    return { error: "O valor previsto precisa ser maior que zero." };
  }

  const dueDay = Number(fields.dueDay);

  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return { error: "O vencimento é um dia de 1 a 31." };
  }

  let yearlyMonth: number | null = null;

  if (fields.frequency === "yearly") {
    yearlyMonth = Number(fields.yearlyMonth);

    if (!Number.isInteger(yearlyMonth) || yearlyMonth < 1 || yearlyMonth > 12) {
      return { error: "Escolha o mês em que a conta cai." };
    }
  }

  let categoryId: string | null = null;

  if (fields.categoryId !== "") {
    if (!isUuid(fields.categoryId)) {
      return { error: "Escolha uma categoria da lista." };
    }

    categoryId = fields.categoryId;
  }

  let payerUserId: string | null = null;

  if (scope === "household") {
    if (!isUuid(fields.payerUserId)) {
      return { error: "Escolha quem paga." };
    }

    payerUserId = fields.payerUserId;
  }

  return {
    values: {
      name: fields.name,
      categoryId,
      defaultAmountCents,
      dueDay,
      payerUserId,
      frequency: fields.frequency,
      yearlyMonth,
    },
  };
}

/**
 * O que uma mudança nas fixas alcança: a lista e a folha (o top-up pega a
 * conta nova/alterada na próxima abertura — D40; o retrato dos meses já
 * gerados não muda).
 */
function revalidateTemplateScreens(): void {
  revalidatePath("/folha/fixas");
  revalidatePath("/folha");
}

/** Cria a conta fixa e volta para a lista. */
export async function createTemplateAction(
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const parsed = fieldsSchema.safeParse(readFields(formData));

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  // Sessão depois da validação (ver `createAccountAction`).
  const context = await requireHousehold();
  const scope = await getScope();

  const converted = toValues(parsed.data, scope);

  if ("error" in converted) {
    return { error: converted.error };
  }

  const { error } = await createRecurringTemplate(
    { scope, userId: context.userId, householdId: context.household.id },
    converted.values,
  );

  if (error) {
    return { error };
  }

  revalidateTemplateScreens();

  redirect("/folha/fixas");
}

/** Salva as mudanças da conta fixa e volta para a lista. */
export async function updateTemplateAction(
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const parsed = z
    .object({ id: templateId })
    .and(fieldsSchema)
    .safeParse({ id: formData.get("id"), ...readFields(formData) });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const converted = toValues(parsed.data, scope);

  if ("error" in converted) {
    return { error: converted.error };
  }

  const { error } = await updateRecurringTemplate(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.id,
    converted.values,
  );

  if (error) {
    return { error };
  }

  revalidateTemplateScreens();

  redirect("/folha/fixas");
}

/**
 * Desativa (ou reativa) a conta fixa — fica na própria linha, sem sair da
 * tela. Desativada, ela não entra nas folhas seguintes; as já geradas ficam
 * como estão (o retrato de cada mês).
 */
export async function setTemplateActiveAction(
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const parsed = z
    .object({ id: templateId, active: z.enum(["0", "1"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const { error } = await setRecurringTemplateActive(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.id,
    parsed.data.active === "1",
  );

  if (error) {
    return { error };
  }

  revalidateTemplateScreens();

  return { error: null };
}
