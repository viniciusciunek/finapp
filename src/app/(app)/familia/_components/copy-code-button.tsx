"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Copia o código de convite para a área de transferência.
 *
 * Sem `navigator.clipboard` (ou sem permissão, o que acontece em http), o
 * código continua visível na tela — então a falha é silenciosa de propósito, em
 * vez de interromper a pessoa com um erro que ela não pode resolver.
 */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copyToClipboard}>
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}
