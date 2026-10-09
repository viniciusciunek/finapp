"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { parseScope } from "@/domain/scope";
import {
  createInvite,
  leaveHousehold,
  revokeInvite,
} from "@/server/households";
import { SCOPE_COOKIE, SCOPE_COOKIE_OPTIONS } from "@/server/scope";
import { requireHousehold, requireSession } from "@/server/session";

/**
 * Troca a visão ativa (pessoal ↔ família).
 *
 * O valor vem de um campo do formulário, então passa por `parseScope` antes de
 * virar cookie: entrada de usuário nunca é gravada como veio.
 */
export async function setScopeAction(formData: FormData): Promise<void> {
  const scope = parseScope(formData.get("scope"));
  const cookieStore = await cookies();

  cookieStore.set(SCOPE_COOKIE, scope, SCOPE_COOKIE_OPTIONS);

  // O escopo muda o que o layout e as páginas mostram; sem revalidar, a tela
  // continuaria exibindo a visão anterior até um recarregamento manual.
  revalidatePath("/", "layout");
}

/** Estado do cartão de convite. */
export type InviteActionState = {
  code: string | null;
  error: string | null;
};

/**
 * Gera um convite novo para a família de quem está chamando.
 *
 * O `householdId` **não** vem do formulário: é lido do contexto da requisição.
 * Aceitar um id vindo da tela seria confiar no cliente para dizer a qual família
 * o convite pertence — o tipo de atalho que vira falha de autorização.
 */
export async function createInviteAction(
  _previousState: InviteActionState,
  _formData: FormData,
): Promise<InviteActionState> {
  const context = await requireHousehold();

  const { code, error } = await createInvite({
    householdId: context.household.id,
    createdBy: context.userId,
  });

  if (error) {
    return { code: null, error };
  }

  revalidatePath("/familia");

  return { code, error: null };
}

/** Cancela um convite que ainda não foi usado. */
export async function revokeInviteAction(formData: FormData): Promise<void> {
  await requireHousehold();

  const inviteId = formData.get("inviteId");

  if (typeof inviteId === "string" && inviteId.length > 0) {
    await revokeInvite(inviteId);
  }

  revalidatePath("/familia");
}

/** Estado do botão de sair da família. */
export type LeaveFamilyState = {
  error: string | null;
};

/**
 * Sai da família. Quem criou a família não consegue — o banco recusa, e a
 * mensagem que chega já explica o motivo (ver `src/server/households.ts`).
 */
export async function leaveFamilyAction(
  _previousState: LeaveFamilyState,
): Promise<LeaveFamilyState> {
  await requireSession();

  const { error } = await leaveHousehold();

  if (error) {
    return { error };
  }

  redirect("/onboarding");
}
