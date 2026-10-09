import { describe, expect, it } from "vitest";

import {
  dayLabel,
  isMonthKey,
  monthKeyOf,
  monthLabel,
  monthRange,
  shiftMonth,
} from "./month";

describe("isMonthKey", () => {
  it("aceita o formato que anda na URL", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-01")).toBe(true);
  });

  it("recusa mês impossível e texto solto", () => {
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey("outubro")).toBe(false);
    expect(isMonthKey(null)).toBe(false);
  });
});

describe("shiftMonth", () => {
  it("anda dentro do mesmo ano", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
  });

  it("atravessa a virada do ano nos dois sentidos", () => {
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-01", -13)).toBe("2024-12");
  });

  it("volta para o mesmo lugar quando anda zero", () => {
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });
});

describe("monthRange", () => {
  it("pega o mês inteiro", () => {
    expect(monthRange("2026-10")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("acerta o fim de fevereiro em ano bissexto e comum", () => {
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(monthRange("2026-02").to).toBe("2026-02-28");
  });
});

describe("monthLabel", () => {
  it("escreve o mês em português", () => {
    expect(monthLabel("2026-10")).toBe("outubro de 2026");
    expect(monthLabel("2026-03")).toBe("março de 2026");
  });
});

describe("dayLabel", () => {
  it("mostra o dia da semana com o número", () => {
    // 2026-10-05 é uma segunda-feira.
    expect(dayLabel("2026-10-05")).toContain("05");
    expect(dayLabel("2026-10-05")).toMatch(/seg/i);
  });
});

describe("monthKeyOf", () => {
  it("usa o mês do calendário local", () => {
    expect(monthKeyOf(new Date(2026, 9, 9))).toBe("2026-10");
    expect(monthKeyOf(new Date(2026, 0, 1))).toBe("2026-01");
  });
});
