import { describe, expect, it } from "vitest";

import {
  isPaymentMethod,
  labelForPaymentMethod,
  MAX_INSTALLMENTS,
  PAYMENT_METHODS,
  usesCard,
} from "./transaction";

describe("isPaymentMethod", () => {
  it("aceita os meios que o banco aceita", () => {
    for (const method of PAYMENT_METHODS) {
      expect(isPaymentMethod(method)).toBe(true);
    }
  });

  it("recusa o que não é meio de pagamento", () => {
    expect(isPaymentMethod("credito")).toBe(false); // sem acento não é o código
    expect(isPaymentMethod("")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
    expect(isPaymentMethod(1)).toBe(false);
  });
});

describe("labelForPaymentMethod", () => {
  it("tem rótulo em português para todos os meios", () => {
    expect(labelForPaymentMethod("pix")).toBe("Pix");
    expect(labelForPaymentMethod("cash")).toBe("Dinheiro");
    expect(labelForPaymentMethod("debit")).toBe("Débito");
    expect(labelForPaymentMethod("boleto")).toBe("Boleto");
    expect(labelForPaymentMethod("credit")).toBe("Crédito");
  });

  it("devolve o valor cru quando não conhece, em vez de inventar", () => {
    expect(labelForPaymentMethod("outro")).toBe("outro");
  });
});

describe("usesCard", () => {
  it("só o crédito vai para o cartão", () => {
    for (const method of PAYMENT_METHODS) {
      expect(usesCard(method)).toBe(method === "credit");
    }
  });
});

describe("MAX_INSTALLMENTS", () => {
  it("acompanha o limite do banco", () => {
    expect(MAX_INSTALLMENTS).toBe(48);
  });
});
