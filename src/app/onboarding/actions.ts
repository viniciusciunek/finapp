"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isValidInviteCode } from "@/domain/invite-code";
import { createHousehold, joinHouseholdWithCode } from "@/server/households";

/** Estado dos formulários de onboarding devolvido pelas Server Actions. */
export type OnboardingFormState = {
  error: string | null;
};

const createFamilySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome para a família.")
    .max(60, "O nome está longo demais."),
});

const joinFamilySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Informe o código do convite.")
    // Valida o formato antes de ir ao banco: "O código tem 10 caracteres"
    // explica melhor do que um "código inválido" genérico.
    .refine(
      isValidInviteCode,
      "O código tem 10 caracteres. Confira e tente de novo.",
    ),
});

/** Cria a família e leva para a visão geral. */
export async function createFamilyAction(
  _previousState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = createFamilySchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique o nome informado.",
    };
  }

  const { error } = await createHousehold(parsed.data.name);

  if (error) {
    return { error };
  }

  redirect("/");
}

/** Entra numa família existente a partir do código de convite. */
export async function joinFamilyAction(
  _previousState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = joinFamilySchema.safeParse({ code: formData.get("code") });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique o código informado.",
    };
  }

  const { error } = await joinHouseholdWithCode(parsed.data.code);

  if (error) {
    return { error };
  }

  redirect("/");
}
