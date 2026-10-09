"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labelForPaymentMethod } from "@/domain/transaction";
import { formatCentsForInput } from "@/lib/format";
import type { Account } from "@/server/accounts";
import type { Category } from "@/server/categories";

import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionFormState,
} from "../actions";

const initialState: TransactionFormState = { error: null };

/** Os meios do lançamento rápido (crédito entra na Fatia 4, com parcelas). */
const METHODS = ["pix", "cash", "debit", "boleto"] as const;
type Method = (typeof METHODS)[number];

function isMethod(value: string | undefined): value is Method {
  return METHODS.some((method) => method === value);
}

/**
 * O que o formulário precisa em cada modo. União discriminada, como nos
 * formulários de conta e cartão: no modo `edit`, o id é obrigatório de tipo.
 */
type QuickEntryFormProps =
  | {
      mode: "create";
      accounts: Account[];
      categories: Category[];
      today: string;
    }
  | {
      mode: "edit";
      accounts: Account[];
      categories: Category[];
      today: string;
      id: string;
      initialValues: {
        description: string;
        totalCents: number;
        occurredOn: string;
        paymentMethod: string;
        categoryId: string | null;
        accountId: string | null;
      };
    };

/**
 * Formulário de lançamento rápido — criar e editar, um só.
 *
 * A ordem dos campos segue a ordem em que se pensa no gasto: **valor**,
 * descrição, categoria, como foi pago, de qual conta — e a data, que quase
 * sempre é hoje e por isso já vem preenchida.
 *
 * Categoria e forma de pagamento são botões (chips), não listas: com poucas
 * opções, um toque em cada resolve, e cada toque a menos conta para o critério
 * dos 15 segundos. Os valores viajam em campos escondidos, então o formulário
 * continua funcionando igual para o servidor.
 */
export function QuickEntryForm(props: QuickEntryFormProps) {
  const isCreate = props.mode === "create";
  const initial = props.mode === "edit" ? props.initialValues : null;

  const [state, formAction, isPending] = useActionState(
    isCreate ? createTransactionAction : updateTransactionAction,
    initialState,
  );
  const [method, setMethod] = useState<Method>(
    isMethod(initial?.paymentMethod) ? initial.paymentMethod : "pix",
  );
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ?? "",
  );

  const { accounts, categories, today } = props;

  // Sem conta no escopo não há de onde tirar o dinheiro — e o banco recusaria.
  // Melhor dizer isso agora do que só descobrir ao salvar.
  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-medium">Crie uma conta primeiro</p>
          <p className="text-muted-foreground text-sm">
            Todo lançamento sai de uma conta (ou do dinheiro em espécie). Depois
            disso, lançar aqui leva segundos.
          </p>
          <Button asChild variant="outline">
            <Link href="/contas/nova">Criar conta</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.id} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="12,50"
              required
              autoFocus={isCreate}
              disabled={isPending}
              defaultValue={
                initial ? formatCentsForInput(initial.totalCents) : undefined
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">No que foi</Label>
            <Input
              id="description"
              name="description"
              type="text"
              placeholder="Futebol"
              maxLength={80}
              required
              disabled={isPending}
              defaultValue={initial?.description ?? ""}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Categoria</span>
            <input type="hidden" name="categoryId" value={categoryId} />
            <div className="flex flex-wrap gap-2">
              <Chip
                selected={categoryId === ""}
                disabled={isPending}
                onClick={() => setCategoryId("")}
              >
                Sem categoria
              </Chip>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  selected={categoryId === category.id}
                  disabled={isPending}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Como foi pago</span>
            <input type="hidden" name="paymentMethod" value={method} />
            <div className="flex flex-wrap gap-2">
              {METHODS.map((option) => (
                <Chip
                  key={option}
                  selected={method === option}
                  disabled={isPending}
                  onClick={() => setMethod(option)}
                >
                  {labelForPaymentMethod(option)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountId">De qual conta</Label>
            <select
              id="accountId"
              name="accountId"
              required
              disabled={isPending}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 h-8 w-full min-w-0 appearance-none rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.bank ? ` · ${account.bank}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurredOn">Quando</Label>
            <Input
              id="occurredOn"
              name="occurredOn"
              type="date"
              defaultValue={initial?.occurredOn ?? today}
              required
              disabled={isPending}
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
                ? "Lançando..."
                : "Salvando..."
              : isCreate
                ? "Lançar"
                : "Salvar mudanças"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Botão de escolha rápida. `type="button"` de propósito: dentro de um form, o
 * padrão é `submit` — e um toque em "Pix" não pode lançar nada.
 */
function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? "default" : "outline"}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
    >
      {children}
    </Button>
  );
}
