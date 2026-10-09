"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatInviteCode } from "@/domain/invite-code";

import { createInviteAction, type InviteActionState } from "../../actions";
import { CopyCodeButton } from "./copy-code-button";

const initialState: InviteActionState = { code: null, error: null };

/**
 * Gera um convite e mostra o código na hora, já formatado para leitura
 * (`ABC-DEFG-HJK`) e com botão de copiar.
 *
 * O código só aparece aqui, no retorno da ação — quem gerou vê uma vez. Os
 * convites ainda válidos ficam listados abaixo, na página.
 */
export function InviteCard() {
  const [state, formAction, isPending] = useActionState(
    createInviteAction,
    initialState,
  );
  const formattedCode = state.code ? formatInviteCode(state.code) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convidar para a família</CardTitle>
        <CardDescription>
          Gere um código e envie para a pessoa (WhatsApp, e-mail...). Vale 30
          dias e serve uma única vez.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form action={formAction}>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar código de convite"}
          </Button>
        </form>

        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}

        {formattedCode ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <code className="font-mono text-lg tracking-widest">
              {formattedCode}
            </code>
            <CopyCodeButton code={formattedCode} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
