import { describe, expect, it } from "vitest";

import {
  chargeSettlementOf,
  isIsoDate,
  labelForLedgerKind,
  loanSchedule,
  personLedger,
  type LedgerEntryLike,
} from "./person";

function charge(
  id: string,
  amountCents: number,
  entryDate: string,
): LedgerEntryLike {
  return { id, kind: "charge", amountCents, entryDate };
}

function payment(
  id: string,
  amountCents: number,
  entryDate: string,
): LedgerEntryLike {
  return { id, kind: "payment", amountCents, entryDate };
}

const TODAY = "2026-11-08";

describe("loanSchedule", () => {
  it("com uma parcela só, cobra na própria data do empréstimo", () => {
    expect(loanSchedule(50_000, 1, "2026-11-08")).toEqual([
      { number: 1, date: "2026-11-08", amountCents: 50_000 },
    ]);
  });

  it("10x de R$ 300,00 vira uma cobrança por mês, atravessando o ano", () => {
    // Caso do aceite da fatia: a geladeira em 10x de R$ 300,00.
    const schedule = loanSchedule(300_000, 10, "2026-11-15");

    expect(schedule).not.toBeNull();
    expect(schedule?.map((installment) => installment.date)).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
      "2027-03-15",
      "2027-04-15",
      "2027-05-15",
      "2027-06-15",
      "2027-07-15",
      "2027-08-15",
    ]);
    expect(
      schedule?.every((installment) => installment.amountCents === 30_000),
    ).toBe(true);
    expect(schedule?.reduce((sum, i) => sum + i.amountCents, 0)).toBe(300_000);
  });

  it("dia 31 em mês curto vale o último dia e não escorrega para o mês seguinte", () => {
    expect(loanSchedule(10_000, 3, "2026-01-31")?.map((i) => i.date)).toEqual([
      "2026-01-31",
      "2026-02-28", // 2026 não é bissexto
      "2026-03-31", // e o dia 31 volta, sem ter "virado" dia 28
    ]);

    expect(loanSchedule(10_000, 2, "2028-01-31")?.map((i) => i.date)).toEqual([
      "2028-01-31",
      "2028-02-29", // 2028 é bissexto
    ]);
  });

  it("o resto fica na primeira parcela, como no parcelamento do cartão", () => {
    const schedule = loanSchedule(10_000, 3, "2026-11-01");

    expect(schedule?.map((i) => i.amountCents)).toEqual([3_334, 3_333, 3_333]);
    expect(schedule?.reduce((sum, i) => sum + i.amountCents, 0)).toBe(10_000);
  });

  it("numera as parcelas de 1 a n, na ordem", () => {
    expect(loanSchedule(30_000, 3, "2026-11-01")?.map((i) => i.number)).toEqual(
      [1, 2, 3],
    );
  });

  it("recusa divisão impossível com null", () => {
    expect(loanSchedule(0, 1, "2026-11-01")).toBeNull();
    expect(loanSchedule(-10_000, 2, "2026-11-01")).toBeNull();
    expect(loanSchedule(10_000.5, 2, "2026-11-01")).toBeNull();
    expect(loanSchedule(10_000, 0, "2026-11-01")).toBeNull();
    expect(loanSchedule(10_000, 49, "2026-11-01")).toBeNull();
    expect(loanSchedule(10, 12, "2026-11-01")).toBeNull(); // mais parcelas que centavos
  });

  it("quebra alto com data malformada (bug de quem chamou, não da pessoa)", () => {
    expect(() => loanSchedule(10_000, 2, "01/11/2026")).toThrow(RangeError);
    expect(() => loanSchedule(10_000, 2, "2026-11")).toThrow(RangeError);
    expect(() => loanSchedule(10_000, 2, "")).toThrow(RangeError);
  });
});

describe("personLedger", () => {
  it("sem lançamentos, tudo zerado", () => {
    expect(personLedger([], TODAY)).toEqual({
      chargedCents: 0,
      receivedCents: 0,
      chargedDueCents: 0,
      dueCents: 0,
      futureCents: 0,
      contractedCents: 0,
      creditCents: 0,
      charges: [],
    });
  });

  it("§5 #7: parcela futura não entra no devido, mas entra no contratado", () => {
    const ledger = personLedger(
      [
        charge("c1", 10_000, "2026-09-10"),
        charge("c2", 20_000, "2026-11-05"),
        charge("c3", 30_000, "2026-12-10"),
      ],
      TODAY,
    );

    expect(ledger.chargedDueCents).toBe(30_000); // 10/09 + 05/11
    expect(ledger.futureCents).toBe(30_000); // 10/12
    expect(ledger.dueCents).toBe(30_000);
    expect(ledger.contractedCents).toBe(60_000);
  });

  it("recebimento abate o devido e o contratado, sem apagar o histórico", () => {
    const ledger = personLedger(
      [
        charge("c1", 10_000, "2026-09-10"),
        charge("c2", 20_000, "2026-11-05"),
        charge("c3", 30_000, "2026-12-10"),
        payment("p1", 25_000, "2026-11-01"),
      ],
      TODAY,
    );

    expect(ledger.receivedCents).toBe(25_000);
    expect(ledger.chargedCents).toBe(60_000);
    expect(ledger.dueCents).toBe(5_000); // 30.000 vencido − 25.000 recebido
    expect(ledger.futureCents).toBe(30_000);
    expect(ledger.contractedCents).toBe(35_000); // falta receber de tudo
  });

  it("quitação FIFO: o recebimento cobre a cobrança mais antiga primeiro", () => {
    const ledger = personLedger(
      [
        charge("nova", 20_000, "2026-12-10"),
        charge("antiga", 10_000, "2026-10-10"), // fora de ordem de propósito
        payment("p1", 15_000, "2026-11-08"),
      ],
      TODAY,
    );

    expect(ledger.charges.map((c) => c.id)).toEqual(["antiga", "nova"]);
    expect(ledger.charges[0]).toMatchObject({
      coveredCents: 10_000,
      remainingCents: 0,
      status: "paid",
    });
    expect(ledger.charges[1]).toMatchObject({
      coveredCents: 5_000,
      remainingCents: 15_000,
      status: "partial",
    });
  });

  it("recebimento que não alcança a primeira cobrança deixa ela parcial", () => {
    const ledger = personLedger(
      [charge("c1", 10_000, "2026-10-10"), payment("p1", 4_000, "2026-11-01")],
      TODAY,
    );

    expect(ledger.charges[0]).toMatchObject({
      coveredCents: 4_000,
      remainingCents: 6_000,
      status: "partial",
    });
    expect(ledger.dueCents).toBe(6_000);
  });

  it("recebimento adiantado vira crédito a favor, sem esconder o sinal", () => {
    const ledger = personLedger(
      [charge("c1", 10_000, "2026-11-05"), payment("p1", 15_000, "2026-11-01")],
      TODAY,
    );

    expect(ledger.dueCents).toBe(-5_000);
    expect(ledger.creditCents).toBe(5_000);
    expect(ledger.contractedCents).toBe(0);
    expect(ledger.charges[0].status).toBe("paid");
  });

  it("recebimento adiantado já abate a parcela que ainda vai vencer", () => {
    const ledger = personLedger(
      [
        charge("c1", 10_000, "2026-09-10"),
        charge("c2", 10_000, "2026-12-10"),
        payment("p1", 10_000, "2026-11-01"),
      ],
      TODAY,
    );

    expect(ledger.dueCents).toBe(0);
    expect(ledger.futureCents).toBe(10_000);
    expect(ledger.contractedCents).toBe(10_000);
    expect(ledger.charges.map((c) => c.status)).toEqual(["paid", "open"]);
  });

  it("cobrança que vence hoje já é devida", () => {
    const ledger = personLedger([charge("c1", 10_000, TODAY)], TODAY);

    expect(ledger.chargedDueCents).toBe(10_000);
    expect(ledger.futureCents).toBe(0);
  });

  it("o resultado não depende da ordem em que o banco devolveu as linhas", () => {
    const entries = [
      charge("c1", 10_000, "2026-09-10"),
      charge("c2", 20_000, "2026-11-05"),
      charge("c3", 30_000, "2026-12-10"),
      payment("p1", 25_000, "2026-11-01"),
    ];

    expect(personLedger([...entries].reverse(), TODAY)).toEqual(
      personLedger(entries, TODAY),
    );
  });

  it("quebra alto com dado torto, em vez de mostrar saldo errado", () => {
    expect(() => personLedger([charge("c1", 0, TODAY)], TODAY)).toThrow(
      RangeError,
    );
    expect(() => personLedger([charge("c1", -10, TODAY)], TODAY)).toThrow(
      RangeError,
    );
    expect(() => personLedger([charge("c1", 10.5, TODAY)], TODAY)).toThrow(
      RangeError,
    );
    expect(() =>
      personLedger([charge("c1", 10_000, "10/09/2026")], TODAY),
    ).toThrow(RangeError);
    expect(() =>
      personLedger(
        [{ ...charge("c1", 10_000, TODAY), kind: "refund" as never }],
        TODAY,
      ),
    ).toThrow(RangeError);
    expect(() => personLedger([], "hoje")).toThrow(RangeError);
  });
});

describe("chargeSettlementOf", () => {
  const ledger = personLedger(
    [charge("c1", 10_000, "2026-10-10"), payment("p1", 10_000, "2026-11-01")],
    TODAY,
  );

  it("acha a cobrança pelo id (é o que a fatura pergunta)", () => {
    expect(chargeSettlementOf(ledger, "c1")).toMatchObject({
      id: "c1",
      status: "paid",
      remainingCents: 0,
    });
  });

  it("devolve null para cobrança que não existe", () => {
    expect(chargeSettlementOf(ledger, "p1")).toBeNull(); // recebimento não é cobrança
    expect(chargeSettlementOf(ledger, "nao-existe")).toBeNull();
  });
});

describe("isIsoDate", () => {
  it("aceita data pura do banco", () => {
    expect(isIsoDate("2026-11-08")).toBe(true);
    expect(isIsoDate("2026-01-31")).toBe(true);
  });

  it("recusa o que quebraria a comparação de texto", () => {
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-31")).toBe(false);
    expect(isIsoDate("31/01/2026")).toBe(false);
    expect(isIsoDate("2026-11-08T10:00:00Z")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("labelForLedgerKind", () => {
  it("traduz os dois tipos e devolve o resto cru", () => {
    expect(labelForLedgerKind("charge")).toBe("Cobrança");
    expect(labelForLedgerKind("payment")).toBe("Recebimento");
    expect(labelForLedgerKind("outro")).toBe("outro");
  });
});
