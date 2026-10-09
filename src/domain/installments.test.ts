import { describe, expect, it } from "vitest";

import { installmentStatementMonth, splitInstallments } from "./installments";
import { sumCents } from "./money";

describe("splitInstallments", () => {
  it("divide exato quando a conta fecha", () => {
    expect(splitInstallments(300000, 10)).toEqual(Array(10).fill(30000));
  });

  it("põe o resto na primeira parcela (§5, teste 2: 100,00 em 3x)", () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it("a soma das parcelas é sempre o total", () => {
    const cases: Array<[number, number]> = [
      [10000, 3],
      [300000, 10],
      [999, 7],
      [12345, 48],
      [48, 48],
    ];

    for (const [total, count] of cases) {
      const parts = splitInstallments(total, count);

      expect(parts).not.toBeNull();
      expect(sumCents(parts ?? [])).toBe(total);
    }
  });

  it("uma parcela é o total inteiro", () => {
    expect(splitInstallments(4590, 1)).toEqual([4590]);
  });

  it("recusa o que não dá para dividir em centavos", () => {
    expect(splitInstallments(100, 0)).toBeNull();
    expect(splitInstallments(100, 49)).toBeNull();
    expect(splitInstallments(0, 3)).toBeNull();
    expect(splitInstallments(-100, 3)).toBeNull();
    expect(splitInstallments(10.5, 2)).toBeNull();
    // 10 centavos não rendem 48 parcelas de ao menos 1 centavo.
    expect(splitInstallments(10, 48)).toBeNull();
  });
});

describe("installmentStatementMonth", () => {
  it("a parcela 1 fica na fatura da compra e as seguintes avançam um mês", () => {
    expect(installmentStatementMonth("2026-10", 1)).toBe("2026-10");
    expect(installmentStatementMonth("2026-10", 2)).toBe("2026-11");
    expect(installmentStatementMonth("2026-10", 10)).toBe("2027-07");
  });

  it("atravessa a virada do ano (§5, teste 3)", () => {
    expect(installmentStatementMonth("2026-11", 3)).toBe("2027-01");
    expect(installmentStatementMonth("2026-12", 2)).toBe("2027-01");
    expect(installmentStatementMonth("2026-01", 48)).toBe("2029-12");
  });

  it("recusa mês ou número inválidos", () => {
    expect(installmentStatementMonth("2026-13", 1)).toBeNull();
    expect(installmentStatementMonth("2026-10", 0)).toBeNull();
    expect(installmentStatementMonth("2026-10", 49)).toBeNull();
    expect(installmentStatementMonth("2026-10", 1.5)).toBeNull();
  });
});
