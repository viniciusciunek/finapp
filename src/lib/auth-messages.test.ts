import { describe, expect, it } from "vitest";

import { translateAuthError } from "./auth-messages";

describe("translateAuthError", () => {
  it("traduz os casos que o usuário provoca", () => {
    expect(translateAuthError("User already registered")).toBe(
      "Já existe uma conta com este e-mail. Tente entrar.",
    );
    expect(
      translateAuthError("Password should be at least 6 characters."),
    ).toBe("A senha é curta demais. Use pelo menos 6 caracteres.");
    expect(
      translateAuthError("Unable to validate email address: invalid format"),
    ).toBe("E-mail inválido.");
    expect(translateAuthError("Email not confirmed")).toBe(
      "Confirme seu e-mail antes de entrar.",
    );
    expect(translateAuthError("Invalid login credentials")).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("reconhece variações de escrita do Supabase", () => {
    // O texto já mudou de forma entre versões; o match é por trecho e sem caixa.
    expect(translateAuthError("USER ALREADY BEEN REGISTERED")).toContain(
      "Já existe uma conta",
    );
    expect(translateAuthError("email rate limit exceeded")).toContain(
      "Muitas tentativas",
    );
    expect(
      translateAuthError("over_email_send_rate_limit: too many requests"),
    ).toContain("Muitas tentativas");
  });

  it("não vaza mensagem técnica: o desconhecido vira texto genérico em português", () => {
    const unknown = translateAuthError(
      "PGRST301: JWT expired, signature mismatch",
    );

    expect(unknown).toBe(
      "Não foi possível concluir. Tente de novo em instantes.",
    );
    expect(unknown).not.toMatch(/jwt|pgrst|signature/i);
  });
});
