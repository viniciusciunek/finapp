import { describe, expect, it } from "vitest";

import {
  BILLING_DAY_MAX,
  BILLING_DAY_MIN,
  isValidBillingDay,
} from "./credit-card";

describe("isValidBillingDay", () => {
  it("aceita os limites e o meio do mês", () => {
    expect(isValidBillingDay(BILLING_DAY_MIN)).toBe(true);
    expect(isValidBillingDay(BILLING_DAY_MAX)).toBe(true);
    expect(isValidBillingDay(15)).toBe(true);
  });

  it("recusa dia que não existe no calendário", () => {
    expect(isValidBillingDay(0)).toBe(false);
    expect(isValidBillingDay(32)).toBe(false);
    expect(isValidBillingDay(-1)).toBe(false);
  });

  it("recusa o que não é dia inteiro", () => {
    expect(isValidBillingDay(15.5)).toBe(false);
    expect(isValidBillingDay(Number.NaN)).toBe(false);
    expect(isValidBillingDay(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("recusa valores de outro tipo, em vez de converter", () => {
    // "20" vem de formulário e é convertido antes de chegar aqui (Zod); se
    // chegar string, é sinal de que alguém esqueceu a conversão.
    expect(isValidBillingDay("20")).toBe(false);
    expect(isValidBillingDay(null)).toBe(false);
    expect(isValidBillingDay(undefined)).toBe(false);
  });
});
