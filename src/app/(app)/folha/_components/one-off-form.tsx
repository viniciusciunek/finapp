"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeAmountInput } from "@/domain/money";

import { addOneOffItemAction, type SheetActionState } from "../actions";

const initialState: SheetActionState = { error: null };

/**
 * Item pontual (§4.4) — IPVA, licenciamento, multa. Vive num `<details>`:
 * fechado, a folha continua sendo só a lista do mês. Na família, sem pagador
 * escolhido, quem cria assume (o servidor decide).
 *
 * Depois de um envio com sucesso o formulário se limpa e se fecha; o retorno
 * de verdade é o item aparecendo na lista logo acima.
 */
export function OneOffForm({ month }: { month: string }) {
  const [state, formAction, isPending] = useActionState(
    addOneOffItemAction,
    initialState,
  );
  const [isOpen, setIsOpen] = useState(false);
  // Controlado, como no lançamento: o sanitizador age enquanto se digita.
  const [amountText, setAmountText] = useState("");

  // Depois de um envio com sucesso, limpa o valor controlado e fecha o
  // formulário — os campos sem estado o próprio React reseta ao terminar a
  // ação. É o padrão "ajustar estado durante o render" (e não um efeito):
  // cada envio devolve um estado NOVO, e a identidade separa "ainda não
  // enviei" (o estado inicial) de "enviei e deu certo".
  const [lastState, setLastState] = useState(state);

  if (lastState !== state) {
    setLastState(state);

    if (state.error === null) {
      setAmountText("");
      setIsOpen(false);
    }
  }

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="rounded-xl border border-dashed p-4"
    >
      <summary className="w-fit cursor-pointer text-sm font-medium">
        Adicionar item pontual
      </summary>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="month" value={month} />

        <div className="space-y-2">
          <Label htmlFor="oneOffName">No que foi</Label>
          <Input
            id="oneOffName"
            name="name"
            placeholder="IPVA, licenciamento, multa…"
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="oneOffAmount">Valor</Label>
            <Input
              id="oneOffAmount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="12,50"
              disabled={isPending}
              value={amountText}
              onChange={(event) =>
                setAmountText(sanitizeAmountInput(event.target.value))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="oneOffDue">Vencimento</Label>
            <Input
              id="oneOffDue"
              name="dueDate"
              type="date"
              disabled={isPending}
            />
          </div>
        </div>

        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>
    </details>
  );
}
