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
import type { AccountValues } from "@/server/accounts";

import {
  createAccountAction,
  updateAccountAction,
  type AccountFormState,
} from "../actions";

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
 * O que o formulário precisa em cada modo. União discriminada de propósito: no
 * modo `edit`, o id é obrigatório **de tipo**, então não existe o caminho de
 * renderizar o campo escondido com valor indefinido.
 */
type AccountFormProps =
  | { mode: "create"; description: string }
  | {
      mode: "edit";
      description: string;
      id: string;
      initialValues: AccountValues;
    };

/**
 * Formulário de conta — criar e editar, um só.
 *
 * Os campos são os mesmos nos dois modos; o que muda é o título, o texto do
 * botão e a ação chamada. Um formulário só evita a duplicação que sempre acaba
 * com os dois lados diferentes.
 *
 * A `description` chega pronta de quem chama: criar fala em onde a conta vai
 * entrar, editar fala de quem é a conta (o escopo é imutável — D20). O escopo
 * de verdade continua sendo lido no servidor, dentro da Server Action.
 */
export function AccountForm(props: AccountFormProps) {
  const isCreate = props.mode === "create";
  const initial = props.mode === "edit" ? props.initialValues : null;

  const [state, formAction, isPending] = useActionState(
    isCreate ? createAccountAction : updateAccountAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isCreate ? "Nova conta" : "Editar conta"}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.id} />
          ) : null}

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
              defaultValue={initial?.name ?? ""}
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
              defaultValue={initial?.bank ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Tipo</Label>
            <select
              id="account-type"
              name="type"
              defaultValue={initial?.type ?? "checking"}
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
            {isPending
              ? isCreate
                ? "Criando..."
                : "Salvando..."
              : isCreate
                ? "Criar conta"
                : "Salvar mudanças"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
