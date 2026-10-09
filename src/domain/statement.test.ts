import { describe, expect, it } from "vitest";

import { resolveStatementMonth } from "./statement";

describe("resolveStatementMonth", () => {
  it("compra antes do fechamento entra na fatura do próprio mês", () => {
    expect(resolveStatementMonth("2026-10-05", 20)).toBe("2026-10");
    expect(resolveStatementMonth("2026-10-01", 20)).toBe("2026-10");
  });

  it("compra no próprio dia do fechamento entra na fatura daquele mês", () => {
    // A regra discutida com o usuário: o dia do fechamento é **inclusive**.
    expect(resolveStatementMonth("2026-10-20", 20)).toBe("2026-10");
  });

  it("compra depois do fechamento entra na fatura seguinte", () => {
    expect(resolveStatementMonth("2026-10-21", 20)).toBe("2026-11");
    expect(resolveStatementMonth("2026-10-31", 20)).toBe("2026-11");
  });

  it("atravessa a virada do ano", () => {
    expect(resolveStatementMonth("2026-12-25", 20)).toBe("2027-01");
  });

  it("dia 31 em mês curto vale o último dia do mês", () => {
    // Fecha dia 31, mas fevereiro de 2026 tem 28. O dia 28 é o fechamento.
    expect(resolveStatementMonth("2026-02-28", 31)).toBe("2026-02");
    expect(resolveStatementMonth("2026-03-01", 31)).toBe("2026-03");
    // Dia 29 em fevereiro comum já é depois do fechamento.
    expect(resolveStatementMonth("2027-03-01", 31)).toBe("2027-03");
  });

  it("fechamento no começo do mês deixa quase tudo para o mês seguinte", () => {
    expect(resolveStatementMonth("2026-10-02", 2)).toBe("2026-10");
    expect(resolveStatementMonth("2026-10-03", 2)).toBe("2026-11");
  });
});
