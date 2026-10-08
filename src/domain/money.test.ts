import { describe, expect, it } from "vitest";

import { isCents, sumCents } from "./money";

describe("isCents", () => {
  it("aceita inteiros, incluindo zero e negativos", () => {
    expect(isCents(0)).toBe(true);
    expect(isCents(1250)).toBe(true);
    expect(isCents(-300)).toBe(true);
  });

  it("rejeita decimais, NaN e Infinity", () => {
    expect(isCents(10.5)).toBe(false);
    expect(isCents(0.1)).toBe(false);
    expect(isCents(Number.NaN)).toBe(false);
    expect(isCents(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("sumCents", () => {
  it("retorna 0 para uma lista vazia", () => {
    expect(sumCents([])).toBe(0);
  });

  it("soma valores em centavos", () => {
    expect(sumCents([1240, 350, 5])).toBe(1595);
  });

  it("preserva a exatidão que a soma de floats não garante", () => {
    // Em ponto flutuante, 0.1 + 0.2 === 0.30000000000000004.
    // Em centavos inteiros, 10 + 20 === 30, sempre.
    expect(sumCents([10, 20])).toBe(30);
    expect(0.1 + 0.2).not.toBe(0.3); // documenta o problema que a regra evita
  });

  it("lança RangeError quando recebe um valor que não é inteiro de centavos", () => {
    expect(() => sumCents([100, 10.5])).toThrow(RangeError);
    expect(() => sumCents([100, Number.NaN])).toThrow(RangeError);
  });
});
