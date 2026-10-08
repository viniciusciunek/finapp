"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/server/auth";

/** Server Action do botão "Sair". */
export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
