import { describe, expect, it } from "vitest";

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  formatInviteCode,
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
  type RandomInt,
} from "./invite-code";

// Repare: sem "I" — ele está fora do alfabeto (junto de L, O, 0 e 1).
const VALID_CODE = "ABCDEFGHJK";

describe("normalizeInviteCode", () => {
  it("coloca em maiúsculas e remove separadores e espaços", () => {
    expect(normalizeInviteCode("abc-defg-hjk")).toBe(VALID_CODE);
    expect(normalizeInviteCode("  ABC DEFG HJK  ")).toBe(VALID_CODE);
    expect(normalizeInviteCode("abc_defg.hjk")).toBe(VALID_CODE);
  });

  it("mantém o código já normalizado inalterado", () => {
    expect(normalizeInviteCode(VALID_CODE)).toBe(VALID_CODE);
  });

  it("devolve string vazia quando não há letras nem números", () => {
    expect(normalizeInviteCode("--- ... ---")).toBe("");
  });
});

describe("isValidInviteCode", () => {
  it("aceita um código válido, cru ou formatado", () => {
    expect(isValidInviteCode(VALID_CODE)).toBe(true);
    expect(isValidInviteCode("ABC-DEFG-HJK")).toBe(true);
    expect(isValidInviteCode("abc-defg-hjk")).toBe(true);
  });

  it("rejeita quando o tamanho é diferente de 10", () => {
    expect(isValidInviteCode("")).toBe(false);
    expect(isValidInviteCode("ABC")).toBe(false);
    expect(isValidInviteCode(VALID_CODE.slice(0, 9))).toBe(false);
    expect(isValidInviteCode("ABCDEFGHJKM")).toBe(false); // 11 caracteres
  });

  it("rejeita os caracteres ambíguos que ficaram fora do alfabeto", () => {
    // I, L, O, 0 e 1 não existem no alfabeto justamente para não confundir.
    for (const ambiguous of ["I", "L", "O", "0", "1"]) {
      const code = `${VALID_CODE.slice(0, 9)}${ambiguous}`;
      expect(isValidInviteCode(code), `esperava rejeitar "${ambiguous}"`).toBe(
        false,
      );
    }
  });

  it("ignora pontuação e espaços antes de validar (código colado com ruído)", () => {
    expect(isValidInviteCode("  abc defg hjk  ")).toBe(true);
    expect(isValidInviteCode("@-@")).toBe(false);
  });
});

describe("formatInviteCode", () => {
  it("agrupa no padrão ABC-DEFG-HJK", () => {
    expect(formatInviteCode(VALID_CODE)).toBe("ABC-DEFG-HJK");
  });

  it("é idempotente: formatar o que já está formatado não muda nada", () => {
    const formatted = formatInviteCode(VALID_CODE);
    expect(formatInviteCode(formatted)).toBe(formatted);
  });

  it("não quebra com entrada incompleta ou vazia", () => {
    expect(formatInviteCode("ABCDE")).toBe("ABC-DE");
    expect(formatInviteCode("")).toBe("");
  });
});

describe("generateInviteCode", () => {
  it("gera código no tamanho do contrato e só com o alfabeto permitido", () => {
    // Fonte determinística que percorre os índices do alfabeto em ciclo.
    let counter = 0;
    const cyclingRandom: RandomInt = (max) => {
      const value = counter % max;
      counter += 1;
      return value;
    };

    const code = generateInviteCode(cyclingRandom);

    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(isValidInviteCode(code)).toBe(true);
  });

  it("respeita a fonte de aleatoriedade injetada", () => {
    const alwaysFirst = generateInviteCode(() => 0);
    expect(alwaysFirst).toBe(VALID_CODE[0].repeat(INVITE_CODE_LENGTH));

    const lastIndex = INVITE_CODE_ALPHABET.length - 1;
    const alwaysLast = generateInviteCode(() => lastIndex);
    expect(alwaysLast).toBe(
      INVITE_CODE_ALPHABET[lastIndex].repeat(INVITE_CODE_LENGTH),
    );
  });

  it("consegue alcançar todos os símbolos do alfabeto", () => {
    const generated = new Set<string>();

    for (let index = 0; index < INVITE_CODE_ALPHABET.length; index += 1) {
      generated.add(generateInviteCode(() => index));
    }

    expect(generated.size).toBe(INVITE_CODE_ALPHABET.length);
  });

  it("recusa fonte de aleatoriedade fora da faixa (evita código mais fraco em silêncio)", () => {
    expect(() => generateInviteCode(() => -1)).toThrow(RangeError);
    expect(() => generateInviteCode(() => INVITE_CODE_ALPHABET.length)).toThrow(
      RangeError,
    );
    expect(() => generateInviteCode(() => 1.5)).toThrow(RangeError);
  });

  it("fecha o ciclo gerar → exibir → normalizar → validar", () => {
    const code = generateInviteCode((max) => max - 1);

    expect(normalizeInviteCode(formatInviteCode(code))).toBe(code);
    expect(isValidInviteCode(formatInviteCode(code))).toBe(true);
  });
});
