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

import { createFamilyAction, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { error: null };

/**
 * "Criar família" — caminho de quem está começando agora.
 *
 * O nome aqui é só um rótulo carinhoso ("Nossa casa"); a família é um espaço
 * compartilhado, não um usuário (PRODUCT.md §5.1).
 */
export function CreateFamilyForm() {
  const [state, formAction, isPending] = useActionState(
    createFamilyAction,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar a família</CardTitle>
        <CardDescription>
          Você fica como dono da família e pode convidar a outra pessoa depois.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="family-name">Nome da família</Label>
            <Input
              id="family-name"
              name="name"
              type="text"
              placeholder="Nossa casa"
              maxLength={60}
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
            {isPending ? "Criando..." : "Criar família"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
