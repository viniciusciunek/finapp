import { describe, expect, it } from "vitest";

import { BUSINESS_ERROR_CODES, toUserMessage } from "./errors";

describe("toUserMessage", () => {
  it("sem erro não há mensagem (é o caminho de sucesso)", () => {
    expect(toUserMessage(null, "Não foi possível.")).toBeNull();
  });

  it("mostra a mensagem do banco quando o código é de negócio", () => {
    for (const code of BUSINESS_ERROR_CODES) {
      expect(
        toUserMessage(
          { code, message: "Mensagem escrita para o usuário" },
          "Não foi possível.",
        ),
      ).toBe("Mensagem escrita para o usuário");
    }
  });

  it("esconde erro técnico atrás da mensagem padrão", () => {
    expect(
      toUserMessage(
        { code: "42P01", message: 'relation "accounts" does not exist' },
        "Não foi possível.",
      ),
    ).toBe("Não foi possível.");

    expect(
      toUserMessage({ message: "fetch failed" }, "Não foi possível."),
    ).toBe("Não foi possível.");

    // Código de negócio com mensagem vazia também cai no padrão: sem texto não
    // há o que mostrar, e uma tela em branco é pior que uma frase genérica.
    expect(
      toUserMessage({ code: "42501", message: "   " }, "Não foi possível."),
    ).toBe("Não foi possível.");
  });
});
