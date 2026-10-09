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
import { formatCentsForInput } from "@/lib/format";
import type { CardValues } from "@/server/credit-cards";

import {
  createCreditCardAction,
  updateCreditCardAction,
  type AccountFormState,
} from "../actions";

const initialState: AccountFormState = { error: null };

/** Mesma união do formulário de conta: no modo `edit` o id é obrigatório. */
type CardFormProps =
  | { mode: "create"; description: string }
  | {
      mode: "edit";
      description: string;
      id: string;
      initialValues: CardValues;
    };

/**
 * Formulário de cartão — criar e editar, um só (mesmo desenho do de conta).
 *
 * O limite vai e volta como **texto**: acaba de ser digitado ("1.234,56") e
 * volta no formato em que se digita, via `formatCentsForInput`. O banco guarda
 * centavos inteiros nos dois sentidos.
 */
export function CardForm(props: CardFormProps) {
  const isCreate = props.mode === "create";
  const initial = props.mode === "edit" ? props.initialValues : null;

  const [state, formAction, isPending] = useActionState(
    isCreate ? createCreditCardAction : updateCreditCardAction,
    initialState,
  );

  // Campo vazio e "sem limite" são a mesma coisa aqui (o banco também trata
  // assim: `limit_cents` nulo).
  const limitText =
    initial?.limitCents === null || initial?.limitCents === undefined
      ? ""
      : formatCentsForInput(initial.limitCents);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isCreate ? "Novo cartão" : "Editar cartão"}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.id} />
          ) : null}

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
              defaultValue={initial?.name ?? ""}
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
                defaultValue={initial?.closingDay ?? BILLING_DAY_MAX}
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
                defaultValue={initial?.dueDay ?? 10}
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
              defaultValue={limitText}
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? isCreate
                ? "Criando..."
                : "Salvando..."
              : isCreate
                ? "Criar cartão"
                : "Salvar mudanças"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
