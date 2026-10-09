import { SCOPES, type Scope } from "@/domain/scope";
import { cn } from "@/lib/utils";

import { setScopeAction } from "../actions";

/** Rótulos em pt-BR — a interface é em português, o código em inglês. */
const SCOPE_LABELS: Record<Scope, string> = {
  personal: "Pessoal",
  household: "Família",
};

/**
 * Alternância entre a visão pessoal e a da família.
 *
 * É um formulário com dois botões de envio, **sem JavaScript no cliente**: o
 * estado ativo é decidido no servidor (o escopo vem de cookie), então a tela já
 * nasce no estado certo, sem piscar depois da hidratação.
 */
export function ScopeSwitch({ scope }: { scope: Scope }) {
  return (
    <form
      action={setScopeAction}
      aria-label="Escolher visão"
      className="bg-muted flex rounded-lg p-1"
    >
      {SCOPES.map((option) => {
        const isActive = option === scope;

        return (
          <button
            key={option}
            type="submit"
            name="scope"
            value={option}
            aria-pressed={isActive}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-background text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {SCOPE_LABELS[option]}
          </button>
        );
      })}
    </form>
  );
}
