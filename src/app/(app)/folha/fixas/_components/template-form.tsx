"use client";

import { useActionState, useState } from "react";

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
import { monthName } from "@/domain/month";
import { sanitizeAmountInput } from "@/domain/money";
import { TEMPLATE_NAME_MAX } from "@/domain/sheet";
import { formatCentsForInput } from "@/lib/format";
import type { RecurringTemplate } from "@/server/sheets";

import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateFormState,
} from "../actions";

const initialState: TemplateFormState = { error: null };

/**
 * Aparência do `<select>` nativo, igual à de `account-form.tsx` — nativo de
 * propósito: no celular abre o seletor do sistema, e aqui são poucas opções.
 */
const SELECT_CLASSES =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 h-8 w-full min-w-0 appearance-none rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

type MemberOption = { userId: string; name: string };
type CategoryOption = { id: string; name: string };

/**
 * O que o formulário precisa em cada modo — criar e editar usam os mesmos
 * campos; o que muda é o título, o botão e a ação. União discriminada como na
 * conta: no modo `edit` o id existe **de tipo**.
 */
type TemplateFormProps =
  | {
      mode: "create";
      description: string;
      members: MemberOption[];
      categories: CategoryOption[];
      currentUserId: string;
    }
  | {
      mode: "edit";
      description: string;
      id: string;
      initialValues: RecurringTemplate;
      members: MemberOption[];
      categories: CategoryOption[];
      currentUserId: string;
    };

/**
 * Formulário de conta fixa — criar e editar, um só (§4.4).
 *
 * "Quando" é chip (todo mês / uma vez por ano) e só mostra o mês quando é
 * anual — o CHECK do banco exige exatamente essa combinação. O pagador só
 * existe na família (o pessoal não tem esse campo, como no banco).
 */
export function TemplateForm(props: TemplateFormProps) {
  const isCreate = props.mode === "create";
  const initial = props.mode === "edit" ? props.initialValues : null;

  const [state, formAction, isPending] = useActionState(
    isCreate ? createTemplateAction : updateTemplateAction,
    initialState,
  );

  // Controlado, como no lançamento: o sanitizador age enquanto se digita.
  const [amountText, setAmountText] = useState(
    initial ? formatCentsForInput(initial.defaultAmountCents) : "",
  );
  const [frequency, setFrequency] = useState<"monthly" | "yearly">(
    initial?.frequency ?? "monthly",
  );

  const showPayer = props.members.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isCreate ? "Nova conta fixa" : "Editar conta fixa"}
        </CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {props.mode === "edit" ? (
            <input type="hidden" name="id" value={props.id} />
          ) : null}
          <input type="hidden" name="frequency" value={frequency} />

          <div className="space-y-2">
            <Label htmlFor="template-name">Nome</Label>
            <Input
              id="template-name"
              name="name"
              type="text"
              placeholder="Internet, Luz, Condomínio…"
              maxLength={TEMPLATE_NAME_MAX}
              required
              disabled={isPending}
              defaultValue={initial?.name ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="template-amount">Valor previsto</Label>
              <Input
                id="template-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="120,00"
                required
                disabled={isPending}
                value={amountText}
                onChange={(event) =>
                  setAmountText(sanitizeAmountInput(event.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-due">Vence dia</Label>
              <Input
                id="template-due"
                name="dueDay"
                type="number"
                min={1}
                max={31}
                placeholder="10"
                required
                disabled={isPending}
                defaultValue={initial?.dueDay ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Quando</span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={frequency === "monthly" ? "default" : "outline"}
                aria-pressed={frequency === "monthly"}
                disabled={isPending}
                onClick={() => setFrequency("monthly")}
              >
                Todo mês
              </Button>
              <Button
                type="button"
                size="sm"
                variant={frequency === "yearly" ? "default" : "outline"}
                aria-pressed={frequency === "yearly"}
                disabled={isPending}
                onClick={() => setFrequency("yearly")}
              >
                Uma vez por ano
              </Button>
            </div>
          </div>

          {frequency === "yearly" ? (
            <div className="space-y-2">
              <Label htmlFor="template-month">Em que mês</Label>
              <select
                id="template-month"
                name="yearlyMonth"
                defaultValue={initial?.yearlyMonth ?? ""}
                className={SELECT_CLASSES}
                disabled={isPending}
                required
              >
                <option value="" disabled>
                  Escolha o mês
                </option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (month) => (
                    <option key={month} value={month}>
                      {monthName(month)}
                    </option>
                  ),
                )}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="template-category">Categoria (opcional)</Label>
            <select
              id="template-category"
              name="categoryId"
              defaultValue={initial?.categoryId ?? ""}
              className={SELECT_CLASSES}
              disabled={isPending}
            >
              <option value="">Sem categoria</option>
              {props.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {showPayer ? (
            <div className="space-y-2">
              <Label htmlFor="template-payer">Quem paga</Label>
              <select
                id="template-payer"
                name="payerUserId"
                defaultValue={initial?.payerUserId ?? props.currentUserId}
                className={SELECT_CLASSES}
                disabled={isPending}
              >
                {props.members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? isCreate
                ? "Criando..."
                : "Salvando..."
              : isCreate
                ? "Criar conta fixa"
                : "Salvar mudanças"}
          </Button>

          {!isCreate ? (
            <p className="text-muted-foreground text-xs">
              As mudanças valem para os próximos meses — a folha de cada mês
              guarda o retrato de quando foi gerada.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
