import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCOPE,
  SCOPES,
  isScope,
  ownershipForScope,
  parseScope,
} from "./scope";

describe("isScope", () => {
  it("aceita os escopos do domínio", () => {
    for (const scope of SCOPES) {
      expect(isScope(scope)).toBe(true);
    }
  });

  it("rejeita valores que não são escopo", () => {
    expect(isScope(undefined)).toBe(false);
    expect(isScope(null)).toBe(false);
    expect(isScope("")).toBe(false);
    expect(isScope("PERSONAL")).toBe(false); // o cookie é escrito por nós: exato
    expect(isScope("family")).toBe(false);
    expect(isScope(1)).toBe(false);
    expect(isScope({ scope: "personal" })).toBe(false);
  });
});

describe("parseScope", () => {
  it("devolve o próprio escopo quando é válido", () => {
    expect(parseScope("personal")).toBe("personal");
    expect(parseScope("household")).toBe("household");
  });

  it("cai no padrão quando a entrada é inválida ou ausente", () => {
    expect(DEFAULT_SCOPE).toBe("personal");
    expect(parseScope(undefined)).toBe(DEFAULT_SCOPE);
    expect(parseScope(null)).toBe(DEFAULT_SCOPE);
    expect(parseScope("qualquer coisa")).toBe(DEFAULT_SCOPE);
    expect(parseScope("")).toBe(DEFAULT_SCOPE);
  });
});

describe("ownershipForScope", () => {
  it("no escopo pessoal, a linha é do usuário e não tem família", () => {
    expect(ownershipForScope("personal", "usuario-1", "familia-1")).toEqual({
      ownerUserId: "usuario-1",
      householdId: null,
    });
  });

  it("no escopo da família, a linha é da família e não tem dono", () => {
    expect(ownershipForScope("household", "usuario-1", "familia-1")).toEqual({
      ownerUserId: null,
      householdId: "familia-1",
    });
  });
});
