import { describe, expect, it } from "vitest";

import { ACCOUNT_TYPES, isAccountType, labelForAccountType } from "./account";

describe("isAccountType", () => {
  it("aceita os tipos do domínio", () => {
    for (const type of ACCOUNT_TYPES) {
      expect(isAccountType(type)).toBe(true);
    }
  });

  it("rejeita qualquer outra coisa", () => {
    expect(isAccountType("credit")).toBe(false);
    expect(isAccountType("Checking")).toBe(false);
    expect(isAccountType(undefined)).toBe(false);
    expect(isAccountType(null)).toBe(false);
    expect(isAccountType(3)).toBe(false);
  });
});

describe("labelForAccountType", () => {
  it("traduz os tipos conhecidos", () => {
    expect(labelForAccountType("checking")).toBe("Conta corrente");
    expect(labelForAccountType("savings")).toBe("Poupança");
    expect(labelForAccountType("cash")).toBe("Dinheiro");
  });

  it("valor desconhecido volta como veio, sem inventar rótulo", () => {
    expect(labelForAccountType("investment")).toBe("investment");
    expect(labelForAccountType("")).toBe("");
  });
});
