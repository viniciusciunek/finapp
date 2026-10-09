/**
 * Formatação para exibição.
 *
 * O domínio guarda dinheiro em centavos e não conhece apresentação
 * (`src/domain/money.ts` é explícito sobre isso), então a conversão para texto
 * mora aqui — um lugar só, para o app inteiro exibir do mesmo jeito.
 */

/** Formata centavos como moeda brasileira: `5000` → `R$ 50,00`. */
export function formatBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
