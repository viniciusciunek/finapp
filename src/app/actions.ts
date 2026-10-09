"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/server/auth";

/**
 * Server Action do botão "Sair".
 *
 * Fica na raiz de `src/app/` porque é usada por mais de um grupo de rotas: o
 * app (`(app)`) e o onboarding.
 */
export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
