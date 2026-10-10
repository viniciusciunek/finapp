import { describe, expect, it } from "vitest";

import {
  isItemPaid,
  nthBusinessDay,
  personalSheetItemsForUser,
  plannedCloseDate,
  sheetItemStatus,
  sheetTotals,
  suggestedExpectedCents,
} from "./sheet";

describe("nthBusinessDay", () => {
  it("conta só de segunda a sexta", () => {
    // Outubro de 2026 começa numa quinta: 1º útil = 1, 5º útil = 7.
    expect(nthBusinessDay("2026-10", 1)).toBe("2026-10-01");
    expect(nthBusinessDay("2026-10", 5)).toBe("2026-10-07");
  });

  it("mês que começa no sábado (§5, teste 5)", () => {
    // Agosto de 2026 começa num sábado: o 1º útil é dia 3, o 5º é dia 7.
    expect(nthBusinessDay("2026-08", 1)).toBe("2026-08-03");
    expect(nthBusinessDay("2026-08", 5)).toBe("2026-08-07");
  });

  it("mês que começa no domingo (§5, teste 5)", () => {
    // Novembro de 2026 começa num domingo: o 1º útil é dia 2, o 5º é dia 6.
    expect(nthBusinessDay("2026-11", 1)).toBe("2026-11-02");
    expect(nthBusinessDay("2026-11", 5)).toBe("2026-11-06");
  });

  it("continua no mês seguinte quando o mês tem menos dias úteis", () => {
    // Fevereiro de 2026 (começa no domingo) tem 20 dias úteis; o 21º é 02/03.
    expect(nthBusinessDay("2026-02", 20)).toBe("2026-02-27");
    expect(nthBusinessDay("2026-02", 21)).toBe("2026-03-02");
  });

  it("recusa n inválido", () => {
    expect(() => nthBusinessDay("2026-10", 0)).toThrow(RangeError);
    expect(() => nthBusinessDay("2026-10", 1.5)).toThrow(RangeError);
  });
});

describe("plannedCloseDate", () => {
  it("é o dia útil pedido do mês SEGUINTE (§4.4)", () => {
    expect(plannedCloseDate("2026-09", 5)).toBe("2026-10-07");
  });

  it("mês seguinte começando no sábado ou domingo (§5, teste 5)", () => {
    // A folha de julho fecha no 5º dia útil de agosto (começa num sábado).
    expect(plannedCloseDate("2026-07", 5)).toBe("2026-08-07");
    // A de outubro fecha no 5º dia útil de novembro (começa num domingo).
    expect(plannedCloseDate("2026-10", 5)).toBe("2026-11-06");
  });
});

describe("sheetItemStatus", () => {
  const base = {
    expectedCents: 10000,
    actualCents: null,
    paidCents: 0,
    dueDate: "2026-10-20",
  };

  it("pago quando o pago cobre o efetivo", () => {
    expect(sheetItemStatus({ ...base, paidCents: 10000 }, "2026-10-25")).toBe(
      "paid",
    );
    expect(sheetItemStatus({ ...base, paidCents: 12000 }, "2026-10-25")).toBe(
      "paid",
    );
  });

  it("parcial quando pagou, mas não tudo", () => {
    expect(sheetItemStatus({ ...base, paidCents: 4000 }, "2026-10-10")).toBe(
      "partial",
    );
  });

  it("atrasado quando venceu sem pagamento (o dia do vencimento ainda vale)", () => {
    expect(sheetItemStatus(base, "2026-10-21")).toBe("overdue");
    expect(sheetItemStatus(base, "2026-10-20")).toBe("pending");
  });

  it("o real manda no efetivo", () => {
    // Real menor que o previsto: pagar o real já quita.
    expect(
      sheetItemStatus(
        { ...base, actualCents: 9000, paidCents: 9000 },
        "2026-10-25",
      ),
    ).toBe("paid");
    // Real maior: o mesmo pagamento do previsto agora é parcial.
    expect(
      sheetItemStatus(
        { ...base, actualCents: 11000, paidCents: 10000 },
        "2026-10-25",
      ),
    ).toBe("partial");
  });

  it("sem vencimento, não atrasa", () => {
    expect(sheetItemStatus({ ...base, dueDate: null }, "2027-01-01")).toBe(
      "pending",
    );
  });

  it("item zerado não nasce pago", () => {
    expect(
      isItemPaid({ expectedCents: 0, actualCents: null, paidCents: 0 }),
    ).toBe(false);
  });
});

describe("sheetTotals", () => {
  it("soma efetivos, pagos e o que falta", () => {
    const items = [
      { expectedCents: 10000, actualCents: null, paidCents: 10000 },
      { expectedCents: 5000, actualCents: 6000, paidCents: 1000 },
      { expectedCents: 2000, actualCents: null, paidCents: 0 },
    ];

    expect(sheetTotals(items)).toEqual({
      totalCents: 10000 + 6000 + 2000,
      paidCents: 11000,
      missingCents: 5000 + 2000,
    });
  });

  it("pagar a mais num item não abate o que falta em outro", () => {
    const items = [
      { expectedCents: 1000, actualCents: null, paidCents: 1500 },
      { expectedCents: 2000, actualCents: null, paidCents: 0 },
    ];

    expect(sheetTotals(items).missingCents).toBe(2000);
  });
});

describe("personalSheetItemsForUser (switch da família — §4.6)", () => {
  const personal = [
    { name: "Nubank", payerUserId: null as string | null },
    { name: "Condomínio", payerUserId: null as string | null },
  ];
  const familyItems = [
    { name: "Internet", payerUserId: "usuario-1" },
    { name: "Carro", payerUserId: "usuario-2" },
  ];

  it("desligado: só os itens pessoais", () => {
    const items = personalSheetItemsForUser(
      personal,
      familyItems,
      "usuario-1",
      false,
    );

    expect(items.map((item) => item.name)).toEqual(["Nubank", "Condomínio"]);
  });

  it("ligado: soma os da família que ELE paga (§5, teste 6)", () => {
    const items = personalSheetItemsForUser(
      personal,
      familyItems,
      "usuario-1",
      true,
    );

    expect(items.map((item) => item.name)).toEqual([
      "Nubank",
      "Condomínio",
      "Internet",
    ]);
  });

  it("pagador diferente não entra (§5, teste 6)", () => {
    const items = personalSheetItemsForUser(
      personal,
      familyItems,
      "usuario-1",
      true,
    );

    expect(items.some((item) => item.name === "Carro")).toBe(false);
  });
});

describe("suggestedExpectedCents", () => {
  it("o real do mês anterior sugere", () => {
    expect(
      suggestedExpectedCents({ expectedCents: 5000, actualCents: 6200 }, 4000),
    ).toBe(6200);
  });

  it("sem real, o previsto do mês anterior", () => {
    expect(
      suggestedExpectedCents({ expectedCents: 5000, actualCents: null }, 4000),
    ).toBe(5000);
  });

  it("sem mês anterior, o padrão do modelo", () => {
    expect(suggestedExpectedCents(null, 4000)).toBe(4000);
  });

  it("real zero é um valor, não ausência", () => {
    expect(
      suggestedExpectedCents({ expectedCents: 5000, actualCents: 0 }, 4000),
    ).toBe(0);
  });
});
