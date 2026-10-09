import { describe, expect, it } from "vitest";

import {
  isCents,
  parseCentsFromText,
  sanitizeAmountInput,
  sumCents,
} from "./money";

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

describe("parseCentsFromText", () => {
  it("entende os formatos que as pessoas digitam", () => {
    expect(parseCentsFromText("1234")).toBe(123400);
    expect(parseCentsFromText("1234,56")).toBe(123456);
    expect(parseCentsFromText("1.234,56")).toBe(123456);
    expect(parseCentsFromText("R$ 1.234,56")).toBe(123456);
    expect(parseCentsFromText(" 12,5 ")).toBe(1250);
  });

  it("não perde centavos na conversão", () => {
    // `parseFloat("1234.56") * 100` daria 123455.99999999999.
    expect(parseCentsFromText("1234,56")).toBe(123456);
    expect(parseCentsFromText("0,01")).toBe(1);
    expect(parseCentsFromText("0")).toBe(0);
  });

  it("devolve null no que não dá para entender, em vez de adivinhar", () => {
    expect(parseCentsFromText("")).toBeNull();
    expect(parseCentsFromText("   ")).toBeNull();
    expect(parseCentsFromText("abc")).toBeNull();
    expect(parseCentsFromText("1,234")).toBeNull(); // três casas: ambíguo
    expect(parseCentsFromText("12,3,4")).toBeNull();
    expect(parseCentsFromText("-50")).toBeNull(); // sinal é decisão de quem chama
  });
});

describe("sanitizeAmountInput", () => {
  it("deixa entrar só o que é número de dinheiro", () => {
    expect(sanitizeAmountInput("12a,5x")).toBe("12,5");
    expect(sanitizeAmountInput("abc")).toBe("");
    expect(sanitizeAmountInput("R$ 12,50")).toBe("12,50");
  });

  it("trata ponto como milhar, não como decimal", () => {
    expect(sanitizeAmountInput("1.234,56")).toBe("1234,56");
    expect(sanitizeAmountInput("1.234")).toBe("1234");
  });

  it("deixa no máximo duas casas e uma vírgula", () => {
    expect(sanitizeAmountInput("12,345")).toBe("12,34");
    expect(sanitizeAmountInput("12,5,6")).toBe("12,56");
  });

  it("o que sai daqui continua entendível pelo parser", () => {
    expect(parseCentsFromText(sanitizeAmountInput("1.234,56"))).toBe(123456);
    expect(parseCentsFromText(sanitizeAmountInput("12a,5"))).toBe(1250);
  });
});
