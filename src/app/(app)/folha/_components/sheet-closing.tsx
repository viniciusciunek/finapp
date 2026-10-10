"use client";

import { useActionState } from "react";

import {
  closeSheetAction,
  reopenSheetAction,
  type SheetActionState,
} from "../actions";
import { TwoTapSubmit } from "./two-tap-submit";

const initialState: SheetActionState = { error: null };

/**
 * Fechar a folha (§4.4), no fim da lista: o servidor exige todo item pago ou
 * levado e recusa com a contagem do que ficou em aberto — a mensagem de erro
 * é da fase 4 e já fala a língua do caderno ("quite ou leve").
 */
export function CloseSheetSection({ month }: { month: string }) {
  const [state, formAction, isPending] = useActionState(
    closeSheetAction,
    initialState,
  );

  return (
    <section className="space-y-2 rounded-xl border border-dashed p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Fechar o mês</h3>
        <p className="text-muted-foreground text-xs">
          Todo item precisa estar pago ou levado para o mês seguinte. Depois de
          fechada, a folha fica só de leitura — reabrir também pede confirmação.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="month" value={month} />
        <TwoTapSubmit
          label="Fechar a folha"
          confirmLabel="Fechar mesmo"
          disabled={isPending}
        />
      </form>
    </section>
  );
}

/** Reabrir, dentro do aviso de folha fechada — mesmo desenho de dois toques. */
export function ReopenSheetButton({ month }: { month: string }) {
  const [state, formAction, isPending] = useActionState(
    reopenSheetAction,
    initialState,
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="month" value={month} />
        <TwoTapSubmit
          label="Reabrir a folha"
          confirmLabel="Reabrir mesmo"
          disabled={isPending}
        />
      </form>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
