import { describe, expect, it } from "vitest";

import { resolveStatementMonth, statementDates } from "./statement";

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

  it("fechamento dia 31 — dia anterior, no dia e no seguinte (§5, teste 1)", () => {
    expect(resolveStatementMonth("2026-10-30", 31)).toBe("2026-10");
    expect(resolveStatementMonth("2026-10-31", 31)).toBe("2026-10");
    expect(resolveStatementMonth("2026-11-01", 31)).toBe("2026-11");
  });

  it("fechamento 31 em fevereiro — o mês curto manda (§5, teste 1)", () => {
    expect(resolveStatementMonth("2026-02-27", 31)).toBe("2026-02");
    expect(resolveStatementMonth("2026-02-28", 31)).toBe("2026-02");
    expect(resolveStatementMonth("2026-03-01", 31)).toBe("2026-03");
  });

  it("fechamento no começo do mês deixa quase tudo para o mês seguinte", () => {
    expect(resolveStatementMonth("2026-10-02", 2)).toBe("2026-10");
    expect(resolveStatementMonth("2026-10-03", 2)).toBe("2026-11");
  });
});

describe("statementDates", () => {
  it("fecha no mês de referência e vence no seguinte", () => {
    expect(statementDates("2026-09", 20, 5)).toEqual({
      closingDate: "2026-09-20",
      dueDate: "2026-10-05",
    });
  });

  it("dia 31 vale o último dia do mês de fechamento", () => {
    expect(statementDates("2026-09", 31, 10)).toEqual({
      closingDate: "2026-09-30",
      dueDate: "2026-10-10",
    });
  });

  it("fevereiro curto limita fechamento e vencimento", () => {
    expect(statementDates("2026-02", 31, 31)).toEqual({
      closingDate: "2026-02-28",
      dueDate: "2026-03-31",
    });
    // 2028 é bissexto: fevereiro tem 29.
    expect(statementDates("2028-02", 30, 31)).toEqual({
      closingDate: "2028-02-29",
      dueDate: "2028-03-31",
    });
  });

  it("vencimento atravessa a virada do ano", () => {
    expect(statementDates("2026-12", 20, 5)).toEqual({
      closingDate: "2026-12-20",
      dueDate: "2027-01-05",
    });
  });
});
