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
import { ACCOUNT_TYPES, labelForAccountType } from "@/domain/account";

import { createAccountAction, type AccountFormState } from "../actions";

const initialState: AccountFormState = { error: null };

/**
 * Aparência do `<select>` nativo, igual à do `Input` (`src/components/ui/input.tsx`).
 *
 * Nativo de propósito: no celular ele abre o seletor do sistema, que é mais
 * rápido e mais acessível do que uma lista customizada — e aqui são só três
 * opções, que não justificam um componente novo.
 */
const SELECT_CLASSES =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 h-8 w-full min-w-0 appearance-none rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/**
 * Formulário de conta, usado para criar (e, depois, para editar).
 *
 * O `scopeLabel` é **só exibição**: serve para a pessoa saber onde a conta vai
 * entrar. O escopo de verdade é lido no servidor, dentro da Server Action —
 * passá-lo pelo formulário seria confiar no cliente.
 */
export function AccountForm({ scopeLabel }: { scopeLabel: string }) {
  const [state, formAction, isPending] = useActionState(
    createAccountAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova conta</CardTitle>
        <CardDescription>Vai entrar em {scopeLabel}.</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Nome</Label>
            <Input
              id="account-name"
              name="name"
              type="text"
              placeholder="Mercado Pago"
              maxLength={60}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-bank">Banco (opcional)</Label>
            <Input
              id="account-bank"
              name="bank"
              type="text"
              placeholder="Deixe vazio para dinheiro em espécie"
              maxLength={60}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Tipo</Label>
            <select
              id="account-type"
              name="type"
              defaultValue="checking"
              className={SELECT_CLASSES}
              disabled={isPending}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labelForAccountType(type)}
                </option>
              ))}
            </select>
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Criando..." : "Criar conta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
