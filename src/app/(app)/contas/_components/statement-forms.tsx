"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeAmountInput } from "@/domain/money";
import { formatCentsForInput } from "@/lib/format";

import {
  registerPaymentAction,
  setActualValueAction,
  type AccountFormState,
} from "../actions";

const initialState: AccountFormState = { error: null };

/**
 * Valor real da fatura (§4.3): opcional; em branco, a fatura volta a valer o
 * calculado (`null` é "não informado", diferente de zero).
 */
export function ActualValueForm({
  statementId,
  cardId,
  currentActualCents,
  calculatedCents,
}: {
  statementId: string;
  cardId: string;
  currentActualCents: number | null;
  calculatedCents: number;
}) {
  const [state, formAction, isPending] = useActionState(
    setActualValueAction,
    initialState,
  );
  // Controlado, como no lançamento: o sanitizador age enquanto se digita.
  const [amountText, setAmountText] = useState(
    currentActualCents === null ? "" : formatCentsForInput(currentActualCents),
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="statementId" value={statementId} />
          <input type="hidden" name="cardId" value={cardId} />

          <div className="space-y-2">
            <Label htmlFor="actualAmount">Valor real da fatura</Label>
            <Input
              id="actualAmount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder={formatCentsForInput(calculatedCents)}
              disabled={isPending}
              value={amountText}
              onChange={(event) =>
                setAmountText(sanitizeAmountInput(event.target.value))
              }
            />
            <p className="text-muted-foreground text-xs">
              O valor que veio no app do banco, quando for diferente do
              calculado. Em branco, a fatura volta a valer o calculado.
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar valor real"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Pagamento da fatura (§4.3): o valor decide o status — o total (ou mais) vira
 * "paga", a menos fica como pagamento parcial, e 0,00 desfaz.
 */
export function PaymentForm({
  statementId,
  cardId,
  effectiveCents,
  paidCents,
}: {
  statementId: string;
  cardId: string;
  effectiveCents: number;
  paidCents: number;
}) {
  const [state, formAction, isPending] = useActionState(
    registerPaymentAction,
    initialState,
  );
  const [amountText, setAmountText] = useState(
    formatCentsForInput(paidCents > 0 ? paidCents : effectiveCents),
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="statementId" value={statementId} />
          <input type="hidden" name="cardId" value={cardId} />

          <div className="space-y-2">
            <Label htmlFor="paidAmount">Valor pago</Label>
            <Input
              id="paidAmount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder={formatCentsForInput(effectiveCents)}
              disabled={isPending}
              value={amountText}
              onChange={(event) =>
                setAmountText(sanitizeAmountInput(event.target.value))
              }
            />
            <p className="text-muted-foreground text-xs">
              Pagando o total (ou mais), a fatura fica marcada como paga; a
              menos, fica como pagamento parcial. 0,00 desfaz o pagamento.
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
