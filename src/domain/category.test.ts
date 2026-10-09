import { describe, expect, it } from "vitest";

import {
  CATEGORY_NAME_MAX,
  categoryNameKey,
  isValidCategoryName,
  normalizeCategoryName,
} from "./category";

describe("normalizeCategoryName", () => {
  it("tira os espaços das pontas e junta os do meio", () => {
    expect(normalizeCategoryName("  Mercado  ")).toBe("Mercado");
    expect(normalizeCategoryName("Conta   de   luz")).toBe("Conta de luz");
  });

  it("preserva acentos e maiúsculas: quem guarda é o banco", () => {
    expect(normalizeCategoryName("Saúde")).toBe("Saúde");
  });
});

describe("categoryNameKey", () => {
  it("considera iguais os nomes que o banco considera iguais", () => {
    expect(categoryNameKey("Mercado")).toBe(categoryNameKey("mercado"));
    expect(categoryNameKey(" MERCADO ")).toBe(categoryNameKey("Mercado"));
    expect(categoryNameKey("Saúde")).toBe(categoryNameKey("saúde"));
  });

  it("não confunde nomes diferentes", () => {
    expect(categoryNameKey("Mercado")).not.toBe(categoryNameKey("Mercadinho"));
  });
});

describe("isValidCategoryName", () => {
  it("aceita nome de verdade", () => {
    expect(isValidCategoryName("Mercado")).toBe(true);
    expect(isValidCategoryName(`  ${"a".repeat(CATEGORY_NAME_MAX)}  `)).toBe(
      true,
    );
  });

  it("recusa vazio, só espaços e o que passa do limite", () => {
    expect(isValidCategoryName("")).toBe(false);
    expect(isValidCategoryName("   ")).toBe(false);
    expect(isValidCategoryName("a".repeat(CATEGORY_NAME_MAX + 1))).toBe(false);
  });
});
