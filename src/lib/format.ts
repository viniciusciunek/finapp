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

/**
 * Centavos no formato que se **digita** num campo: `123456` → `1234,56`.
 *
 * Diferente do `formatBrl`: sem "R$" e sem separador de milhar, porque o texto
 * volta para dentro de um campo de formulário e precisa ser fácil de corrigir.
 * É o inverso exato de `parseCentsFromText` — os dois são testados juntos para
 * não se desencontrarem.
 *
 * Aritmética inteira, sem `toFixed`: a regra de dinheiro vale também na saída.
 */
export function formatCentsForInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const reais = Math.trunc(absolute / 100);
  const centavos = String(absolute % 100).padStart(2, "0");

  return `${sign}${reais},${centavos}`;
}
