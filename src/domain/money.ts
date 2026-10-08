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
