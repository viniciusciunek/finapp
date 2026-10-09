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

import type { AccountFormState } from "../actions";

const initialState: AccountFormState = { error: null };

type DeleteAction = (
  state: AccountFormState,
  formData: FormData,
) => Promise<AccountFormState>;

/**
 * Apagar, em dois toques.
 *
 * Mesmo desenho do cartão de sair da família, de propósito: quem já viu uma
 * confirmação no app reconhece a outra. O primeiro toque troca o botão pela
 * confirmação, com um "Cancelar" ao lado — o que se está evitando é apagar por
 * engano.
 *
 * A frase (`description`) é de quem chama, porque o que sai da tela é diferente
 * em cada caso — e é ela que evita a leitura errada de que o dinheiro some
 * junto com a conta.
 *
 * A Server Action chega como prop (`action`): é referência, então funciona sem
 * mandar lógica para o navegador.
 */
export function DeleteCard({
  id,
  action,
  title,
  description,
  label,
}: {
  id: string;
  action: DeleteAction;
  title: string;
  description: string;
  label: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Apagando..." : "Apagar mesmo"}
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
            {label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
