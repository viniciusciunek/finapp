/**
 * Mês, para a lista e para a Folha do mês.
 *
 * A chave é o que anda na URL e no estado da tela: **"2026-10"**. Guardar
 * assim, em texto, é o que evita o clássico "o mês virou por causa do fuso" —
 * a conversão para data acontece só na hora de consultar o banco, e sempre em
 * UTC, porque `occurred_on` é data pura (sem hora).
 *
 * Puro de propósito: a Fatia 5 (Folha do mês) vai reusar exatamente estas
 * funções para navegar entre meses.
 */

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

/** Chave do mês de uma data (o mês "de calendário" dela). */
export function monthKeyOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

/**
 * Anda `delta` meses para a frente (ou para trás, com delta negativo).
 *
 * A conta é feita em meses inteiros desde o ano zero — nada de somar 30 dias e
 * torcer para cair no mesmo dia do mês seguinte.
 */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = (total % 12) + 1;

  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

/**
 * Primeiro e último dia do mês, em `YYYY-MM-DD`.
 *
 * O último dia sai do "dia zero do mês seguinte" — o caminho mais curto para
 * saber se fevereiro termina em 28, 29, 30 ou 31 sem escrever essa tabela.
 */
export function monthRange(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Rótulo em pt-BR: `"2026-10"` → `"outubro de 2026"`. */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Rótulo curto do dia, para o cabeçalho de cada grupo: `"2026-10-05"` → `"seg, 5"`. */
export function dayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
