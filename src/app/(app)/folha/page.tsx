import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, Suspense, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dayLabel,
  isMonthKey,
  longDayLabel,
  monthKeyOf,
  monthLabel,
  shiftMonth,
} from "@/domain/month";
import {
  effectiveCentsFor,
  isItemPaid,
  personalSheetItemsForUser,
  sheetItemStatus,
  sheetTotals,
} from "@/domain/sheet";
import { formatBrl } from "@/lib/format";
import { listHouseholdMembers } from "@/server/households";
import { getIncludeFamilyItems, getScope } from "@/server/scope";
import { requireHousehold } from "@/server/session";
import { listSheet, openSheet, type SheetItemView } from "@/server/sheets";

import { setIncludeFamilyAction } from "./actions";

export const metadata: Metadata = {
  title: "Folha",
};

/**
 * Folha do mês — a leitura (Fatia 5, `DOMAIN.md` §4.4–§4.6).
 *
 * Só abrir a tela já **gera** a folha do mês (o top-up idempotente do
 * servidor): a pessoa não "cria" nada — as fixas e as faturas viram itens
 * sozinhas. Esta fase é de leitura; os formulários chegam na fase 6.
 *
 * Status nunca vem gravado: é calculado (`sheetItemStatus`) — o dia do
 * vencimento vale o dia inteiro. "Levada" é o item que já foi para o mês
 * seguinte; ele **não conta** no "falta pagar" (o que restou dele já está lá
 * — senão faltaria duas vezes).
 *
 * O `<Suspense>` é o mesmo padrão do resto do app (D9).
 */
export default function SheetPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  return (
    <Suspense fallback={<SheetPlaceholder />}>
      <SheetContent searchParams={searchParams} />
    </Suspense>
  );
}

function SheetPlaceholder() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/** Linha de detalhes do item: partes separadas por "·", sem inventar texto. */
function Meta({ parts }: { parts: ReactNode[] }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <span aria-hidden>·</span> : null}
          {part}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Os cinco rótulos que um item pode receber. Os quatro primeiros são o status
 * calculado (§4.5); "Levada" tem precedência — o item que já foi para o mês
 * seguinte não está atrasado aqui.
 */
const CHIP_LABELS = {
  paid: "Paga",
  partial: "Parcial",
  overdue: "Atrasada",
  pending: "Pendente",
  carried: "Levada",
} as const;

type ChipKey = keyof typeof CHIP_LABELS;

const CHIP_CLASSES: Record<ChipKey, string> = {
  paid: "border-emerald-600/30 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
  partial:
    "border-amber-600/30 text-amber-700 dark:border-amber-400/30 dark:text-amber-400",
  overdue: "border-destructive/40 text-destructive",
  pending: "text-muted-foreground",
  carried:
    "border-sky-600/30 text-sky-700 dark:border-sky-400/30 dark:text-sky-400",
};

function chipKeyFor(item: SheetItemView, today: string): ChipKey {
  if (item.carriedToItemId !== null) {
    return "carried";
  }

  return sheetItemStatus(item, today);
}

function StatusChip({ chip }: { chip: ChipKey }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium ${CHIP_CLASSES[chip]}`}
    >
      {CHIP_LABELS[chip]}
    </span>
  );
}

/** Setas de mês — o mesmo desenho da Visão geral e da fatura. */
function MonthNav({ month }: { month: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link
          href={`/folha?mes=${shiftMonth(month, -1)}`}
          aria-label="Mês anterior"
        >
          ←
        </Link>
      </Button>

      <p className="font-medium capitalize">{monthLabel(month)}</p>

      <Button asChild variant="ghost" size="sm">
        <Link
          href={`/folha?mes=${shiftMonth(month, 1)}`}
          aria-label="Próximo mês"
        >
          →
        </Link>
      </Button>
    </div>
  );
}

/** Tela de erro com o mesmo cabeçalho — a navegação de mês continua possível. */
function LoadError({ month, message }: { month: string; message: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Folha do mês</h2>
      <MonthNav month={month} />
      <p className="text-destructive text-sm">{message}</p>
    </div>
  );
}

function ItemRow({
  item,
  month,
  today,
  familyItemIds,
  memberNames,
}: {
  item: SheetItemView;
  month: string;
  today: string;
  /** Na visão pessoal com o switch ligado, marca os itens que vieram da família. */
  familyItemIds: Set<string>;
  /** Nome do pagador, na visão da família (§4.6). */
  memberNames: Map<string, string>;
}) {
  const chip = chipKeyFor(item, today);
  const parts: ReactNode[] = [];

  if (item.dueDate !== null) {
    parts.push(<span key="due">vence {dayLabel(item.dueDate)}</span>);
  }

  if (item.statement) {
    // O mês vai na URL: num item levado, a fatura referida é a do mês em que
    // ela nasceu — não necessariamente a aberta hoje.
    parts.push(
      <Link
        key="statement"
        className="underline underline-offset-2"
        href={`/contas/cartoes/${item.statement.cardId}/fatura?mes=${item.statement.referenceMonth}`}
      >
        Ver fatura
      </Link>,
    );
  }

  if (item.paidCents > 0 && chip !== "paid") {
    parts.push(<span key="paid">pago {formatBrl(item.paidCents)}</span>);
  }

  if (item.carriedToItemId !== null) {
    parts.push(
      <span key="carried">levada para {monthLabel(shiftMonth(month, 1))}</span>,
    );
  }

  if (item.carriedFromItemId !== null) {
    parts.push(
      <span key="from">veio de {monthLabel(shiftMonth(month, -1))}</span>,
    );
  }

  const payerName = item.payerUserId
    ? memberNames.get(item.payerUserId)
    : undefined;

  if (payerName) {
    parts.push(<span key="payer">paga por {payerName}</span>);
  }

  if (familyItemIds.has(item.id)) {
    parts.push(
      <span
        key="family"
        className="bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      >
        Família
      </span>,
    );
  }

  return (
    <li className="p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{item.name}</p>
        <p className="text-sm font-medium">
          {formatBrl(effectiveCentsFor(item))}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Meta parts={parts} />
        <StatusChip chip={chip} />
      </div>
    </li>
  );
}

/** Os grupos da folha, na ordem em que o dinheiro se organiza. */
const GROUPS = [
  { source: "statement", label: "Faturas" },
  { source: "template", label: "Fixas" },
  { source: "one_off", label: "Pontuais" },
] as const;

async function SheetContent({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const context = await requireHousehold();
  const scope = await getScope();

  const { mes } = await searchParams;
  // Mês válido na URL; qualquer outra coisa vira o mês de hoje. Endereço
  // torto não pode virar tela de erro.
  const month = isMonthKey(mes) ? mes : monthKeyOf(new Date());

  const now = new Date();
  const today = `${monthKeyOf(now)}-${String(now.getDate()).padStart(2, "0")}`;

  const ownership = {
    scope,
    userId: context.userId,
    householdId: context.household.id,
  };

  // Abrir é idempotente: garante a linha do mês e completa os itens que
  // faltarem (fase 3). Numa folha fechada, nada é gerado de novo (D40).
  const opened = await openSheet(ownership, month);

  if (opened.error) {
    return <LoadError month={month} message={opened.error} />;
  }

  const includeFamily = scope === "personal" && (await getIncludeFamilyItems());
  const householdOwnership = { ...ownership, scope: "household" as const };

  // O switch ligado promete os itens da família que EU pago (§4.6): a folha da
  // família do mês também é garantida — sem ela, não haveria o que somar.
  let familyError: string | null = null;

  if (includeFamily) {
    const familyOpened = await openSheet(householdOwnership, month);
    familyError = familyOpened.error;
  }

  const [sheetResult, familyResult, membersResult] = await Promise.all([
    listSheet(ownership, month),
    includeFamily ? listSheet(householdOwnership, month) : null,
    scope === "household" ? listHouseholdMembers(context.household.id) : null,
  ]);

  if (sheetResult.error) {
    return <LoadError month={month} message={sheetResult.error} />;
  }

  if (!sheetResult.sheet) {
    return <LoadError month={month} message="Esta folha não existe mais." />;
  }

  const sheet = sheetResult.sheet;

  // Da família, só o que EU pago (§4.6) — e só com o switch ligado.
  const familyItems = familyResult
    ? familyResult.items.filter((item) => item.payerUserId === context.userId)
    : [];

  const familyItemIds = new Set(familyItems.map((item) => item.id));

  // A ordem do banco (vencimento, sem vencimento por último, por nome) manda
  // também na lista somada — item da família não fica colado no fim.
  const items = [
    ...personalSheetItemsForUser(
      sheetResult.items,
      familyItems,
      context.userId,
      includeFamily,
    ),
  ].sort(
    (a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  const memberNames = new Map(
    (membersResult?.members ?? []).map((member) => [
      member.userId,
      member.name,
    ]),
  );

  // Totais (§4.6). "Falta" ignora o que já foi levado: o que restou desses
  // itens está na folha do mês seguinte — não pode faltar duas vezes.
  const totals = sheetTotals(items);
  const missingCents = sheetTotals(
    items.filter((item) => item.carriedToItemId === null),
  ).missingCents;

  // "Mês quitado": TODOS os itens pagos. Levado não conta como pago — não
  // seria verdade dizer "tudo pago" de um mês em que nada foi pago.
  const allPaid = items.length > 0 && items.every(isItemPaid);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Folha do mês</h2>
        <p className="text-muted-foreground text-sm">
          {sheet.status === "closed" ? "Fechada" : "Aberta"} · fechamento
          previsto para {longDayLabel(sheet.plannedCloseDate)}
        </p>
      </div>

      <MonthNav month={month} />

      {sheet.status === "closed" ? (
        <div className="rounded-xl border border-dashed p-3 text-sm">
          Folha fechada — este mês já foi conferido; por aqui, ela fica só de
          leitura.
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 rounded-xl border p-4 text-center">
        <div>
          <p className="text-muted-foreground text-xs">Total</p>
          <p className="text-sm font-semibold">
            {formatBrl(totals.totalCents)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Já pago</p>
          <p className="text-sm font-semibold">{formatBrl(totals.paidCents)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Falta</p>
          <p
            className={
              missingCents > 0
                ? "text-sm font-semibold"
                : "text-sm font-semibold text-emerald-700 dark:text-emerald-400"
            }
          >
            {formatBrl(missingCents)}
          </p>
        </div>
      </div>

      {allPaid ? (
        <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Tudo pago! Obrigado Deus!
        </p>
      ) : null}

      {scope === "personal" ? (
        <form action={setIncludeFamilyAction} className="space-y-1">
          <input
            type="hidden"
            name="include"
            value={includeFamily ? "0" : "1"}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full"
            aria-pressed={includeFamily}
          >
            {includeFamily
              ? "Incluindo contas da família"
              : "Incluir contas da família"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Soma à sua visão os itens da família que você paga.
          </p>
        </form>
      ) : null}

      {familyError ? (
        <p className="text-destructive text-sm">{familyError}</p>
      ) : null}

      {familyResult?.error ? (
        <p className="text-destructive text-sm">{familyResult.error}</p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Nada nesta folha ainda</p>
          <p className="text-muted-foreground mt-1 text-sm">
            As contas fixas e as faturas do mês viram itens sozinhas; pontuais
            entram na mão.
          </p>
        </div>
      ) : (
        GROUPS.map((group) => {
          const groupItems = items.filter(
            (item) => item.source === group.source,
          );

          if (groupItems.length === 0) {
            return null;
          }

          return (
            <section key={group.source} className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-medium uppercase">
                {group.label}
              </h3>
              <ul className="divide-y overflow-hidden rounded-xl border">
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    month={month}
                    today={today}
                    familyItemIds={familyItemIds}
                    memberNames={memberNames}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
