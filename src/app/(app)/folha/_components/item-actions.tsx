"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeAmountInput } from "@/domain/money";
import { effectiveCentsFor, isItemPaid } from "@/domain/sheet";
import { formatBrl, formatCentsForInput } from "@/lib/format";
import type { SheetItemView } from "@/server/sheets";

import {
  carryItemAction,
  deleteOneOffItemAction,
  registerItemPaymentAction,
  setItemActualValueAction,
  type SheetActionState,
} from "../actions";
import { TwoTapSubmit } from "./two-tap-submit";

const initialState: SheetActionState = { error: null };

/**
 * As ações de um item da folha (fase 6).
 *
 * "Pagar tudo" é o caminho de um toque do fechamento: o valor cheio entra como
 * pago. "Ajustar" abre os campos — valor real, pagamento com outro valor,
 * levar adiante e (só pontual, D37) apagar. Em item de fatura, valor real e
 * pagamento **são** os da fatura (D38): mudar aqui muda na tela dela.
 *
 * Só aparece com a folha aberta (quem decide é a página) — folha fechada é
 * somente leitura por aqui.
 */
export function ItemActions({ item }: { item: SheetItemView }) {
  const [actualState, actualFormAction, actualPending] = useActionState(
    setItemActualValueAction,
    initialState,
  );
  const [paymentState, paymentFormAction, paymentPending] = useActionState(
    registerItemPaymentAction,
    initialState,
  );
  const [carryState, carryFormAction, carryPending] = useActionState(
    carryItemAction,
    initialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteOneOffItemAction,
    initialState,
  );

  const effectiveCents = effectiveCentsFor(item);
  const isPaid = isItemPaid(item);
  const isCarried = item.carriedToItemId !== null;
  const isPending =
    actualPending || paymentPending || carryPending || deletePending;

  // Pagar e levar só enquanto o item está em aberto — levado já tem destino.
  const canSettle = !isPaid && !isCarried;

  // Controlados, como no lançamento: o sanitizador age enquanto se digita.
  const [actualText, setActualText] = useState(
    item.actualCents === null ? "" : formatCentsForInput(item.actualCents),
  );
  const [paidText, setPaidText] = useState(
    formatCentsForInput(item.paidCents > 0 ? item.paidCents : effectiveCents),
  );

  return (
    <div className="mt-2 space-y-2">
      {canSettle ? (
        <form action={paymentFormAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <input
            type="hidden"
            name="amount"
            value={formatCentsForInput(effectiveCents)}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isPending}
          >
            Pagar tudo ({formatBrl(effectiveCents)})
          </Button>
        </form>
      ) : null}

      <details>
        <summary className="text-muted-foreground w-fit cursor-pointer text-xs underline underline-offset-2">
          Ajustar
        </summary>

        <div className="mt-3 space-y-4 rounded-lg border p-3">
          {item.statement ? (
            <p className="text-muted-foreground text-xs">
              O valor real e o pagamento são os mesmos da tela da fatura — mudar
              aqui muda lá, e vice-versa.
            </p>
          ) : null}

          <form action={actualFormAction} className="space-y-2">
            <input type="hidden" name="itemId" value={item.id} />
            <Label htmlFor={`actual-${item.id}`}>Valor real</Label>
            <Input
              id={`actual-${item.id}`}
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder={formatCentsForInput(effectiveCents)}
              disabled={isPending}
              value={actualText}
              onChange={(event) =>
                setActualText(sanitizeAmountInput(event.target.value))
              }
            />
            <p className="text-muted-foreground text-xs">
              O que veio de verdade, quando diferente do previsto. Em branco,
              vale o previsto.
            </p>
            {actualState.error ? (
              <p role="alert" className="text-destructive text-sm">
                {actualState.error}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isPending}
            >
              {actualPending ? "Salvando..." : "Salvar valor real"}
            </Button>
          </form>

          <form action={paymentFormAction} className="space-y-2">
            <input type="hidden" name="itemId" value={item.id} />
            <Label htmlFor={`paid-${item.id}`}>Valor pago</Label>
            <Input
              id={`paid-${item.id}`}
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder={formatCentsForInput(effectiveCents)}
              disabled={isPending}
              value={paidText}
              onChange={(event) =>
                setPaidText(sanitizeAmountInput(event.target.value))
              }
            />
            <p className="text-muted-foreground text-xs">
              O total marca como paga; a menos, fica parcial; 0,00 desfaz.
            </p>
            {paymentState.error ? (
              <p role="alert" className="text-destructive text-sm">
                {paymentState.error}
              </p>
            ) : null}
            <Button type="submit" size="sm" disabled={isPending}>
              {paymentPending ? "Registrando..." : "Registrar pagamento"}
            </Button>
          </form>

          {canSettle || item.source === "one_off" ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {canSettle ? (
                <form action={carryFormAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <TwoTapSubmit
                    label="Levar para o próximo mês"
                    confirmLabel="Levar mesmo"
                    disabled={isPending}
                  />
                </form>
              ) : null}

              {item.source === "one_off" ? (
                <form action={deleteFormAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <TwoTapSubmit
                    label="Apagar"
                    confirmLabel="Apagar mesmo"
                    variant="ghost"
                    confirmVariant="destructive"
                    disabled={isPending}
                  />
                </form>
              ) : null}
            </div>
          ) : null}

          {carryState.error ? (
            <p role="alert" className="text-destructive text-sm">
              {carryState.error}
            </p>
          ) : null}

          {deleteState.error ? (
            <p role="alert" className="text-destructive text-sm">
              {deleteState.error}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
