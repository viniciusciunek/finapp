"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { setTemplateActiveAction, type TemplateFormState } from "../actions";

const initialState: TemplateFormState = { error: null };

/**
 * Desativar/Reativar uma conta fixa. Um toque só, sem confirmação: nada se
 * perde (as folhas já geradas ficam como estão) e é reversível.
 */
export function TemplateToggle({
  templateId,
  active,
}: {
  templateId: string;
  active: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    setTemplateActiveAction,
    initialState,
  );

  return (
    <form action={formAction} className="shrink-0 space-y-1">
      <input type="hidden" name="id" value={templateId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        {active ? "Desativar" : "Reativar"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
