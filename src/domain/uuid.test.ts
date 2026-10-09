import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("aceita um id de verdade, em maiúsculas ou minúsculas", () => {
    expect(isUuid("6f5d1e2a-0f5b-4a3c-9d1e-2b7c8a4f0d31")).toBe(true);
    expect(isUuid("6F5D1E2A-0F5B-4A3C-9D1E-2B7C8A4F0D31")).toBe(true);
  });

  it("recusa texto que não é id", () => {
    expect(isUuid("abc")).toBe(false);
    expect(isUuid("")).toBe(false);
    // Faltando um dígito no último bloco.
    expect(isUuid("6f5d1e2a-0f5b-4a3c-9d1e-2b7c8a4f0d3")).toBe(false);
    // Com espaço sobrando (o clássico "copiei do lugar errado").
    expect(isUuid(" 6f5d1e2a-0f5b-4a3c-9d1e-2b7c8a4f0d31")).toBe(false);
    // Letra fora do hexadecimal.
    expect(isUuid("6f5d1e2a-0f5b-4a3c-9d1e-2b7c8a4f0d3z")).toBe(false);
  });

  it("recusa o que nem é texto", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
