"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  INCLUDE_FAMILY_COOKIE,
  INCLUDE_FAMILY_COOKIE_OPTIONS,
} from "@/server/scope";

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
