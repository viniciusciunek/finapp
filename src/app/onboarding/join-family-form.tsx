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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { joinFamilyAction, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { error: null };

/**
 * "Entrar com código" — caminho de quem foi convidado.
 *
 * Aceita o código cru ou formatado (`ABC-DEFG-HJK`) e em qualquer caixa: a
 * normalização existe nas duas pontas (TypeScript e a função do banco).
 */
export function JoinFamilyForm() {
  const [state, formAction, isPending] = useActionState(
    joinFamilyAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenho um código</CardTitle>
        <CardDescription>
          Peça o código para quem já está na família e informe aqui.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Código do convite</Label>
            <Input
              id="invite-code"
              name="code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC-DEFG-HJK"
              className="font-mono tracking-widest uppercase"
              maxLength={14}
              required
              disabled={isPending}
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            variant="secondary"
            disabled={isPending}
          >
            {isPending ? "Entrando..." : "Entrar na família"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
