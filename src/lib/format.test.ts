import { describe, expect, it } from "vitest";

import { formatBrl } from "./format";

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
