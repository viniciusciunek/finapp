import { describe, expect, it } from "vitest";

import {
  HOUSEHOLD_ROLES,
  canManageHousehold,
  isHouseholdRole,
  parseHouseholdRole,
} from "./household";

describe("isHouseholdRole", () => {
  it("aceita os papéis do domínio", () => {
    for (const role of HOUSEHOLD_ROLES) {
      expect(isHouseholdRole(role)).toBe(true);
    }
  });

  it("rejeita qualquer outra coisa", () => {
    expect(isHouseholdRole("admin")).toBe(false);
    expect(isHouseholdRole("OWNER")).toBe(false);
    expect(isHouseholdRole(undefined)).toBe(false);
    expect(isHouseholdRole(null)).toBe(false);
    expect(isHouseholdRole(1)).toBe(false);
  });
});

describe("parseHouseholdRole", () => {
  it("preserva os papéis válidos", () => {
    expect(parseHouseholdRole("owner")).toBe("owner");
    expect(parseHouseholdRole("member")).toBe("member");
  });

  it("desconhecido vira member (nunca promove ninguém a dono por acidente)", () => {
    expect(parseHouseholdRole("superuser")).toBe("member");
    expect(parseHouseholdRole(undefined)).toBe("member");
    expect(parseHouseholdRole(null)).toBe("member");
    expect(parseHouseholdRole(42)).toBe("member");
  });
});

describe("canManageHousehold", () => {
  it("só o dono administra a família", () => {
    expect(canManageHousehold("owner")).toBe(true);
    expect(canManageHousehold("member")).toBe(false);
  });
});
