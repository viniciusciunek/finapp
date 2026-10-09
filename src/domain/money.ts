/**
 * Utilitários puros de dinheiro.
 *
 * Regra do projeto (docs/DOMAIN.md §1 e .github/instructions/copilot-instructions.md):
 * dinheiro é sempre `integer` em centavos, em BRL. Nunca `float`/`decimal`.
 *
 * Este módulo é a base das regras de negócio: não conhece banco de dados,
 * React nem formatação de exibição (isso fica na camada de apresentação).
 */

/**
 * Verifica se `value` é um inteiro válido de centavos.
 *
 * Usa `Number.isSafeInteger` de propósito: rejeita decimais (`10.5`), `NaN`,
 * `Infinity` e valores fora da faixa exata do JS.
 */
export function isCents(value: number): boolean {
  return Number.isSafeInteger(value);
}

/**
 * Soma uma lista de valores em centavos.
 *
 * A soma usa aritmética inteira, que é exata dentro de `Number.MAX_SAFE_INTEGER`
 * — ao contrário de somar reais em ponto flutuante (0.1 + 0.2 !== 0.3).
 *
 * @throws {RangeError} se algum valor não for um inteiro de centavos.
 */
export function sumCents(values: readonly number[]): number {
  let total = 0;

  for (const value of values) {
    if (!isCents(value)) {
      throw new RangeError(
        `Valor inválido em centavos: ${value}. Dinheiro deve ser inteiro (DOMAIN.md §1).`,
      );
    }

    total += value;
  }

  return total;
}

/**
 * Converte valor digitado por gente em centavos.
 *
 * Aceita os formatos que aparecem no celular: `1234`, `1234,56`, `1.234,56` e
 * `R$ 1.234,56`. Devolve `null` quando não dá para entender — quem chama decide
 * a mensagem, porque só quem chamou sabe o que estava sendo preenchido.
 *
 * **Sem ponto flutuante em nenhum passo:** os milhares saem, a vírgula vira
 * separador decimal e a conta é feita em inteiros. `parseFloat("1234.56") * 100`
 * daria 123455.99999999999 — é exatamente o erro que a regra de dinheiro do
 * projeto existe para evitar (`DOMAIN.md` §1).
 */
export function parseCentsFromText(text: string): number | null {
  const trimmed = text.trim();

  if (trimmed === "") {
    return null;
  }

  const normalized = trimmed
    .replace(/^R\$/i, "")
    .replace(/\s/g, "")
    .replace(/\./g, "") // separador de milhar do pt-BR
    .replace(",", "."); // separador decimal do pt-BR

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [reais, decimals = ""] = normalized.split(".");

  return Number(reais) * 100 + Number(decimals.padEnd(2, "0"));
}

/**
 * Limpa o valor **enquanto se digita**, em vez de só reclamar ao salvar.
 *
 * Ponto é separador de milhar no que as pessoas escrevem ("1.234,56") e a
 * vírgula é o decimal — então o ponto sai e só a primeira vírgula fica, com no
 * máximo duas casas. Letra não entra. O resultado ainda passa por
 * `parseCentsFromText` antes de virar dinheiro: aqui é conforto, lá é garantia.
 */
export function sanitizeAmountInput(text: string): string {
  const withoutThousands = text.replace(/\./g, "");
  const onlyAllowed = withoutThousands.replace(/[^\d,]/g, "");
  const [reais, ...rest] = onlyAllowed.split(",");

  if (rest.length === 0) {
    return reais.slice(0, 9);
  }

  return `${reais.slice(0, 9)},${rest.join("").slice(0, 2)}`;
}
