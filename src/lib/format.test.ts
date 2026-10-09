import { describe, expect, it } from "vitest";

import { parseCentsFromText } from "@/domain/money";

import { formatBrl, formatCentsForInput } from "./format";

describe("formatBrl", () => {
  it("formata centavos como moeda brasileira", () => {
    // Sem comparar a string inteira: o espaço entre "R$" e o número varia com a
    // versão do ICU do Node, e isso não é problema nosso.
    expect(formatBrl(5_000)).toContain("50,00");
    expect(formatBrl(5_000)).toContain("R$");
  });

  it("usa o separador de milhar brasileiro", () => {
    expect(formatBrl(500_000)).toContain("5.000,00");
  });

  it("não perde os centavos", () => {
    expect(formatBrl(1)).toContain("0,01");
    expect(formatBrl(1_234)).toContain("12,34");
  });
});

describe("formatCentsForInput", () => {
  it("escreve centavos como se digita", () => {
    expect(formatCentsForInput(123_456)).toBe("1234,56");
    expect(formatCentsForInput(30_000)).toBe("300,00");
    expect(formatCentsForInput(50)).toBe("0,50");
    expect(formatCentsForInput(0)).toBe("0,00");
  });

  it("mantém o sinal", () => {
    expect(formatCentsForInput(-1_234)).toBe("-12,34");
  });

  it("é o inverso de parseCentsFromText", () => {
    // Os dois vivem em módulos diferentes e são usados em pontas opostas do
    // formulário de limite: se um mudar sozinho, este teste avisa.
    for (const cents of [0, 1, 50, 1_234, 123_456, 999_999_99]) {
      expect(parseCentsFromText(formatCentsForInput(cents))).toBe(cents);
    }
  });
});
