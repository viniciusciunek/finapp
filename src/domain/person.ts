import { splitInstallments } from "./installments";
import { isCents } from "./money";
import { dateInMonth, shiftMonth } from "./month";

/**
 * Pessoas de quem a gente é credor e a conta corrente delas (`DOMAIN.md` §4.7).
 *
 * Puro: nada aqui fala com banco, tela ou relógio — `hoje` entra por parâmetro,
 * como em `sheet.ts`. O banco guarda os fatos (`person_ledger_entries`); as
 * contas — cronograma do empréstimo, saldo devido × contratado, quitação FIFO —
 * são feitas aqui, uma vez, com teste (é o caso §5 #7 do documento).
 */

/** Mesmos limites dos CHECKs de `people` (`20261108120000_people_...`). */
export const PERSON_NAME_MAX = 60;
export const PERSON_RELATIONSHIP_MAX = 40;

/** Mesmo limite do CHECK de `person_ledger_entries.notes`. */
export const LEDGER_NOTES_MAX = 500;

const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Data pura no formato do banco (`YYYY-MM-DD`).
 *
 * Estas datas são comparadas como **texto** em vários lugares (inclusive no
 * `<=` do saldo): só funciona porque o formato é o único em que a ordem
 * alfabética é a ordem cronológica. Data com hora ou com barra invertida
 * quebraria isso em silêncio, então a guarda é paranoica de propósito.
 */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}

/** Tipos de lançamento na conta corrente da pessoa — espelha o CHECK `kind`. */
export const LEDGER_KINDS = ["charge", "payment"] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

export function isLedgerKind(value: unknown): value is LedgerKind {
  return (
    typeof value === "string" &&
    (LEDGER_KINDS as readonly string[]).includes(value)
  );
}

const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  charge: "Cobrança",
  payment: "Recebimento",
};

/** Valor desconhecido volta cru, sem mentir (igual a `labelForAccountType`). */
export function labelForLedgerKind(value: string): string {
  return isLedgerKind(value) ? LEDGER_KIND_LABELS[value] : value;
}

/** Uma parcela do cronograma combinado (o que vira um `charge` no banco). */
export interface LoanInstallment {
  /** 1..n, na ordem do cronograma. */
  number: number;
  /** `YYYY-MM-DD` — quando a cobrança vence. */
  date: string;
  amountCents: number;
}

/**
 * Cronograma do empréstimo em dinheiro/Pix (`DOMAIN.md` §4.7).
 *
 * A regra é a do caderno: **uma cobrança por mês, no dia do empréstimo**, a
 * partir da data em que o dinheiro saiu. Com 1 parcela, é uma cobrança só, na
 * própria data — por isso não existe caminho separado para "à vista".
 *
 * O dia é **limitado ao último dia do mês** em mês curto (`month.ts`), sem
 * "escorregar" para o mês seguinte: empréstimo no dia 31 rende 28/02, 31/03,
 * 30/04… e volta para o 31 em maio. O valor sai de `splitInstallments` — o
 * resto fica na primeira parcela, e a soma é exatamente o total (§5 #2).
 *
 * Devolve `null` quando a divisão não existe (valor não positivo, quantidade
 * fora de 1..48, mais parcelas do que centavos) — o mesmo contrato de
 * `splitInstallments`, para a tela conseguir mostrar a mensagem certa.
 *
 * @throws {RangeError} se `firstDate` não for `YYYY-MM-DD` — data malformada
 * não é entrada de gente, é bug de quem chamou.
 */
export function loanSchedule(
  totalCents: number,
  installmentsCount: number,
  firstDate: string,
): LoanInstallment[] | null {
  if (!isIsoDate(firstDate)) {
    throw new RangeError(
      `Data inválida para o empréstimo: ${firstDate}. Esperado YYYY-MM-DD.`,
    );
  }

  const amounts = splitInstallments(totalCents, installmentsCount);

  if (amounts === null) {
    return null;
  }

  const firstMonth = firstDate.slice(0, 7);
  const day = Number(firstDate.slice(8, 10));

  return amounts.map((amountCents, index) => ({
    number: index + 1,
    date: dateInMonth(shiftMonth(firstMonth, index), day),
    amountCents,
  }));
}

/**
 * O mínimo que a conta corrente precisa saber de um lançamento. Deliberadamente
 * estrutural (e não o tipo da linha do banco): as telas já têm seus próprios
 * formatos, e a regra não deve depender do cliente do Supabase.
 */
export interface LedgerEntryLike {
  id: string;
  kind: LedgerKind;
  amountCents: number;
  /** `YYYY-MM-DD` — vencimento da cobrança, ou a data do recebimento. */
  entryDate: string;
}

/** Estado de uma cobrança depois da quitação FIFO. */
export type ChargeStatus = "paid" | "partial" | "open";

export interface ChargeSettlement {
  id: string;
  entryDate: string;
  amountCents: number;
  /** Quanto dos recebimentos caiu nesta cobrança. */
  coveredCents: number;
  remainingCents: number;
  status: ChargeStatus;
}

export interface PersonLedger {
  /** Soma de todas as cobranças — o "contratado" bruto. */
  chargedCents: number;
  /** Soma de todos os recebimentos. */
  receivedCents: number;
  /** Cobranças que já venceram (até `hoje`), sem descontar recebimentos. */
  chargedDueCents: number;
  /**
   * Saldo **devido** (§4.7): vencido − recebido. Pode ficar **negativo** —
   * significa que a pessoa pagou adiantado, e a tela deve mostrar isso como
   * crédito a favor dela, não esconder.
   */
  dueCents: number;
  /** Cobranças que ainda **não** venceram — não entram no devido (§5 #7). */
  futureCents: number;
  /** O que falta receber de **tudo** (vencido + futuro − recebido), nunca negativo. */
  contractedCents: number;
  /** Recebimentos que passaram de todas as cobranças (crédito a favor). */
  creditCents: number;
  /** Cobranças em ordem de quitação (mais antiga primeiro), com o FIFO aplicado. */
  charges: ChargeSettlement[];
}

/**
 * Conta corrente da pessoa (`DOMAIN.md` §4.7 e §5 #7).
 *
 * Duas perguntas diferentes, e é fácil confundi-las:
 *   - **devido** = o que já venceu e não foi recebido (é o que se cobra hoje);
 *   - **contratado** = o que falta receber somando as parcelas futuras (§5 #7).
 *
 * A quitação é **FIFO** (decisão D47): os recebimentos cobrem as cobranças mais
 * antigas primeiro, e não se pergunta ao usuário qual parcela ele está pagando
 * (§4.7). Por isso o total de recebimentos basta — a data deles só serve de
 * histórico, não muda a alocação: um Pix adiantado já abate a próxima parcela.
 *
 * `hoje` vem de fora (nunca `new Date()` aqui) para o teste poder viajar no
 * tempo — e porque o "hoje" do usuário é o fuso dele, não o do servidor.
 *
 * @throws {RangeError} se alguma entrada estiver fora do que o banco permite
 * (valor não inteiro, zero ou negativo, data malformada, `kind` desconhecido).
 * Linha torta é defeito de dados: melhor quebrar alto do que mostrar saldo
 * errado com cara de certo.
 */
export function personLedger(
  entries: readonly LedgerEntryLike[],
  today: string,
): PersonLedger {
  if (!isIsoDate(today)) {
    throw new RangeError(`Data de hoje inválida: ${today}.`);
  }

  let chargedCents = 0;
  let receivedCents = 0;
  let chargedDueCents = 0;
  let futureCents = 0;

  const charges: LedgerEntryLike[] = [];

  for (const entry of entries) {
    if (!isCents(entry.amountCents) || entry.amountCents <= 0) {
      throw new RangeError(
        `Valor inválido em centavos: ${entry.amountCents} (${entry.id}).`,
      );
    }

    if (!isIsoDate(entry.entryDate)) {
      throw new RangeError(
        `Data inválida em ${entry.id}: ${entry.entryDate}. Esperado YYYY-MM-DD.`,
      );
    }

    if (!isLedgerKind(entry.kind)) {
      throw new RangeError(`Tipo de lançamento inválido em ${entry.id}.`);
    }

    if (entry.kind === "payment") {
      receivedCents += entry.amountCents;
      continue;
    }

    chargedCents += entry.amountCents;
    charges.push(entry);

    // Comparação de texto: só vale porque é `YYYY-MM-DD` (ver `isIsoDate`).
    if (entry.entryDate <= today) {
      chargedDueCents += entry.amountCents;
    } else {
      futureCents += entry.amountCents;
    }
  }

  // Ordem de quitação: mais antiga primeiro; o `id` desempata para o resultado
  // não depender da ordem em que o banco devolveu as linhas.
  const ordered = [...charges].sort(
    (a, b) =>
      a.entryDate.localeCompare(b.entryDate) || a.id.localeCompare(b.id),
  );

  let pool = receivedCents;
  const settlements: ChargeSettlement[] = ordered.map((charge) => {
    const coveredCents = Math.min(pool, charge.amountCents);

    pool -= coveredCents;

    const remainingCents = charge.amountCents - coveredCents;

    return {
      id: charge.id,
      entryDate: charge.entryDate,
      amountCents: charge.amountCents,
      coveredCents,
      remainingCents,
      status:
        remainingCents === 0 ? "paid" : coveredCents > 0 ? "partial" : "open",
    };
  });

  // Recebido a mais que o total cobrado não "apaga" cobrança: vira crédito.
  const missingCents = Math.max(chargedCents - receivedCents, 0);

  return {
    chargedCents,
    receivedCents,
    chargedDueCents,
    dueCents: chargedDueCents - receivedCents,
    futureCents,
    contractedCents: missingCents,
    creditCents: Math.max(receivedCents - chargedCents, 0),
    charges: settlements,
  };
}

/**
 * Como está a cobrança de uma parcela específica — é o que a tela da fatura
 * precisa para responder "de terceiros: R$ X, já recebido?" (§4.7).
 *
 * Devolve `null` quando não há cobrança para aquele id (lançamento antigo,
 * anterior à Fatia 6, ou de outra pessoa): quem chama decide se é "não
 * lançado" ou "nada a receber".
 */
export function chargeSettlementOf(
  ledger: PersonLedger,
  chargeId: string,
): ChargeSettlement | null {
  return ledger.charges.find((charge) => charge.id === chargeId) ?? null;
}
