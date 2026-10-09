"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { leaveFamilyAction, type LeaveFamilyState } from "../../actions";

const initialState: LeaveFamilyState = { error: null };

/**
 * Sair da família, em dois toques.
 *
 * A confirmação existe porque a saída **não** é reversível pelo próprio usuário:
 * para voltar é preciso de um convite novo. Quem criou a família não vê este
 * cartão (o banco recusaria a saída de qualquer forma).
 */
export function LeaveFamilyCard() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(
    leaveFamilyAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sair da família</CardTitle>
        <CardDescription>
          Você deixa de ver os dados compartilhados. Para voltar depois, vai
          precisar de um convite novo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}

        {isConfirming ? (
          <div className="flex flex-wrap gap-2">
            <form action={formAction}>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Saindo..." : "Confirmar saída"}
              </Button>
            </form>

            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setIsConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfirming(true)}
          >
            Sair da família
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
