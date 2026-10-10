"use client";

import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type ButtonVariant = ComponentProps<typeof Button>["variant"];

/**
 * Ação que muda o rumo do mês em dois toques: o primeiro troca o botão pela
 * confirmação, com um "Cancelar" ao lado. É o mesmo desenho de apagar conta e
 * sair da família, de propósito — quem já viu uma confirmação no app reconhece
 * a outra.
 *
 * Precisa viver dentro do `<form>` da ação: o segundo toque é um submit.
 *
 * ⚠️ As `key` NÃO são decoração: sem elas, o React reaproveita o mesmo nó
 * `<button>` e o **muta para `type="submit"` no meio do próprio clique** — e aí
 * a ação default daquele clique (submeter o formulário) executa sem segundo
 * toque. Com keys diferentes, o nó do primeiro estágio é trocado por um novo, e
 * o clique nunca vira submit. (Testado no navegador: era um bug real de um
 * toque só.)
 */
export function TwoTapSubmit({
  label,
  confirmLabel,
  variant = "outline",
  confirmVariant = "default",
  disabled = false,
}: {
  label: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  disabled?: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <Button
        key="start"
        type="button"
        variant={variant}
        size="sm"
        disabled={disabled}
        onClick={() => setIsConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button
        key="confirm"
        type="submit"
        variant={confirmVariant}
        size="sm"
        disabled={disabled}
      >
        {confirmLabel}
      </Button>
      <Button
        key="cancel"
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setIsConfirming(false)}
      >
        Cancelar
      </Button>
    </>
  );
}
