"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { isMonthKey } from "@/domain/month";
import { parseCentsFromText } from "@/domain/money";
import { isUuid } from "@/domain/uuid";
import {
  getScope,
  INCLUDE_FAMILY_COOKIE,
  INCLUDE_FAMILY_COOKIE_OPTIONS,
} from "@/server/scope";
import { requireHousehold } from "@/server/session";
import {
  addOneOffItem,
  carryItem,
  closeSheet,
  deleteOneOffItem,
  registerSheetItemPayment,
  reopenSheet,
  setSheetItemActualCents,
} from "@/server/sheets";

/**
 * Liga/desliga o "incluir contas da família" da folha pessoal (§4.6).
 *
 * O estado mora em cookie (preferência de visão, não dado de negócio) e o
 * valor vem de um campo do formulário: `"1"` liga; qualquer outra coisa
 * desliga — entrada de usuário nunca é gravada como veio.
 */
export async function setIncludeFamilyAction(
  formData: FormData,
): Promise<void> {
  const include = formData.get("include") === "1";
  const cookieStore = await cookies();

  cookieStore.set(
    INCLUDE_FAMILY_COOKIE,
    include ? "1" : "0",
    INCLUDE_FAMILY_COOKIE_OPTIONS,
  );

  // A folha muda de conteúdo na hora (totais e lista); sem revalidar, a tela
  // continuaria exibindo a visão anterior até um recarregamento.
  revalidatePath("/folha");
}

/**
 * Estado das ações da folha: só existe para mostrar erro — quando dá certo, a
 * revalidação redesenha a tela.
 */
export type SheetActionState = {
  error: string | null;
};

/** Id de item vindo de um campo escondido: entra como texto, sai validado. */
const itemId = z
  .string()
  .refine(isUuid, "Este item não é válido. Recarregue a folha.");

/** Mês vindo de campo escondido — mesmo trato do id. */
const monthField = z
  .string()
  .refine(isMonthKey, "Este mês não é válido. Recarregue a folha.");

/** "AAAA-MM-DD" do `<input type="date">`; vazio vale como "sem vencimento". */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O que uma mudança na folha alcança na tela: a própria folha e a Visão geral
 * (o aviso de fechamento lê a folha). Os itens de fatura também mexem nas
 * telas de conta — quem chama revalida `/contas` por cima (D38).
 */
function revalidateSheetScreens(): void {
  revalidatePath("/folha");
  revalidatePath("/");
}

/**
 * Grava (ou limpa) o valor real de um item (§4.5).
 *
 * Campo vazio devolve o item ao previsto — `null` é "não informado", diferente
 * de zero. Em item de fatura, quem grava é o `statement` (D38): a tela da
 * fatura mostra o mesmo número.
 */
export async function setItemActualValueAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({
      itemId,
      amount: z.string().trim(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      amount: formData.get("amount"),
    });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  let actualCents: number | null = null;

  if (parsed.data.amount !== "") {
    actualCents = parseCentsFromText(parsed.data.amount);

    if (actualCents === null || actualCents < 0) {
      return { error: "Confira o valor real: use algo como 1.234,56." };
    }
  }

  // Sessão depois da validação (ver `createAccountAction`).
  await requireHousehold();

  const { error } = await setSheetItemActualCents(
    parsed.data.itemId,
    actualCents,
  );

  if (error) {
    return { error };
  }

  revalidateSheetScreens();
  revalidatePath("/contas", "layout");

  return { error: null };
}

/**
 * Registra o pagamento de um item (§4.5): o valor decide o status — integral
 * vira "paga", parcial fica registrado, e zero desfaz. Em item de fatura, o
 * pagamento **é** o da fatura (D38).
 */
export async function registerItemPaymentAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({
      itemId,
      amount: z.string().trim(),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      amount: formData.get("amount"),
    });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const paidCents = parseCentsFromText(parsed.data.amount);

  if (paidCents === null || paidCents < 0) {
    return {
      error: "Confira o valor pago: use algo como 1.234,56. O 0,00 desfaz.",
    };
  }

  await requireHousehold();

  const { error } = await registerSheetItemPayment(
    parsed.data.itemId,
    paidCents,
  );

  if (error) {
    return { error };
  }

  revalidateSheetScreens();
  revalidatePath("/contas", "layout");

  return { error: null };
}

/**
 * Leva um item para a folha do mês seguinte (§4.4) — o que ficou para trás não
 * some, muda de mês. As regras da cópia (fatura mantém o vínculo, modelo vira
 * pontual, leva só o que falta) são do servidor.
 */
export async function carryItemAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({ itemId })
    .safeParse({ itemId: formData.get("itemId") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const { error } = await carryItem(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.itemId,
  );

  if (error) {
    return { error };
  }

  revalidateSheetScreens();

  return { error: null };
}

/**
 * Apaga um item pontual (D37) — item de modelo ou de fatura não se apaga; o
 * que a pessoa quer (sair do caminho) é editar o valor ou levar adiante.
 */
export async function deleteOneOffItemAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({ itemId })
    .safeParse({ itemId: formData.get("itemId") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  await requireHousehold();

  const { error } = await deleteOneOffItem(parsed.data.itemId);

  if (error) {
    return { error };
  }

  revalidateSheetScreens();

  return { error: null };
}

/**
 * Adiciona um item pontual (§4.4) ao mês em exibição. Na família, sem pagador
 * escolhido, quem cria assume (o seletor de pagador chega na fase 7).
 */
export async function addOneOffItemAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({
      month: monthField,
      name: z
        .string()
        .trim()
        .min(1, "Dê um nome para o item.")
        .max(80, "O nome pode ter até 80 caracteres."),
      amount: z.string().trim(),
      dueDate: z.string().trim(),
    })
    .safeParse({
      month: formData.get("month"),
      name: formData.get("name"),
      amount: formData.get("amount"),
      dueDate: formData.get("dueDate"),
    });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const expectedCents = parseCentsFromText(parsed.data.amount);

  if (expectedCents === null || expectedCents < 0) {
    return { error: "Confira o valor: use algo como 1.234,56." };
  }

  let dueDate: string | null = null;

  if (parsed.data.dueDate !== "") {
    if (!DATE_PATTERN.test(parsed.data.dueDate)) {
      return { error: "Confira o vencimento." };
    }

    dueDate = parsed.data.dueDate;
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const { error } = await addOneOffItem(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.month,
    {
      name: parsed.data.name,
      expectedCents,
      dueDate,
      // Na família, sem escolha na tela, quem cria assume; no pessoal o
      // servidor ignora este campo.
      payerUserId: null,
    },
  );

  if (error) {
    return { error };
  }

  revalidateSheetScreens();

  return { error: null };
}

/**
 * Fecha a folha (§4.4): o servidor exige todo item pago ou levado e recusa com
 * a contagem do que ficou em aberto. Fechada, a folha vira somente leitura NA
 * FOLHA; a tela da fatura mantém a vida própria (D38).
 */
export async function closeSheetAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({ month: monthField })
    .safeParse({ month: formData.get("month") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const { error } = await closeSheet(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.month,
  );

  if (error) {
    return { error };
  }

  revalidateSheetScreens();

  return { error: null };
}

/** Reabre a folha fechada — a tela pede confirmação em dois toques. */
export async function reopenSheetAction(
  _previousState: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  const parsed = z
    .object({ month: monthField })
    .safeParse({ month: formData.get("month") });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }

  const context = await requireHousehold();
  const scope = await getScope();

  const { error } = await reopenSheet(
    { scope, userId: context.userId, householdId: context.household.id },
    parsed.data.month,
  );

  if (error) {
    return { error };
  }

  revalidateSheetScreens();

  return { error: null };
}
