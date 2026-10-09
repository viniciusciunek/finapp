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
import { BILLING_DAY_MAX, BILLING_DAY_MIN } from "@/domain/credit-card";

import { createCreditCardAction, type AccountFormState } from "../actions";

const initialState: AccountFormState = { error: null };

/**
 * Formulário de cartão de crédito.
 *
 * Mesmo desenho do formulário de conta (e o mesmo estado de erro): o
 * `scopeLabel` é só exibição — o escopo de verdade é lido no servidor, dentro
 * da Server Action.
 */
export function CardForm({ scopeLabel }: { scopeLabel: string }) {
  const [state, formAction, isPending] = useActionState(
    createCreditCardAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo cartão</CardTitle>
        <CardDescription>Vai entrar em {scopeLabel}.</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-name">Nome</Label>
            <Input
              id="card-name"
              name="name"
              type="text"
              placeholder="Nubank"
              maxLength={60}
              required
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="card-closing-day">Fecha dia</Label>
              <Input
                id="card-closing-day"
                name="closingDay"
                type="number"
                inputMode="numeric"
                min={BILLING_DAY_MIN}
                max={BILLING_DAY_MAX}
                defaultValue={BILLING_DAY_MAX}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-due-day">Vence dia</Label>
              <Input
                id="card-due-day"
                name="dueDay"
                type="number"
                inputMode="numeric"
                min={BILLING_DAY_MIN}
                max={BILLING_DAY_MAX}
                defaultValue={10}
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-limit">Limite (opcional)</Label>
            <Input
              id="card-limit"
              name="limit"
              type="text"
              inputMode="decimal"
              placeholder="1.234,56"
              maxLength={20}
              disabled={isPending}
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Criando..." : "Criar cartão"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
