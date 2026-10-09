/**
 * Regras da categoria.
 *
 * `categoryNameKey` espelha o índice único do banco (`lower(btrim(name))`): o
 * formulário usa isto para avisar "já existe uma categoria com esse nome" antes
 * de tentar gravar — mas quem decide continua sendo o banco, com a lista
 * inteira em mãos (código 23505). Espelho é atalho para a pessoa, não
 * autoridade.
 *
 * Diferença conhecida e aceita: `toLocaleLowerCase` do JavaScript e `lower` do
 * Postgres não tratam todo caractere Unicode igual. Em caso de dúvida, o banco
 * ganha — o pior que acontece é a tela deixar tentar e o banco recusar.
 */

/** Mesmo limite do CHECK `length(btrim(name)) between 1 and 40`. */
export const CATEGORY_NAME_MAX = 40;

/** Espaços das pontas fora; espaços repetidos no meio viram um só. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Como o banco compara dois nomes: sem diferenciar maiúsculas. */
export function categoryNameKey(name: string): string {
  return normalizeCategoryName(name).toLocaleLowerCase("pt-BR");
}

export function isValidCategoryName(name: string): boolean {
  const normalized = normalizeCategoryName(name);

  return normalized.length >= 1 && normalized.length <= CATEGORY_NAME_MAX;
}
