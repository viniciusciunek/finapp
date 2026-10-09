/**
 * Tradução de erro do banco em mensagem de tela.
 *
 * O banco escreve em português, sem jargão, aquilo que o usuário precisa saber
 * — mas só nos erros que **nós** levantamos (funções e triggers das
 * migrations). Erro de conexão, de sintaxe ou de permissão inesperada vem em
 * inglês e técnico: aí a mensagem padrão é melhor do que vazar detalhe.
 *
 * A lista é fechada de propósito. Um código novo entra aqui quando — e somente
 * quando — a mensagem dele tiver sido escrita para ser lida por quem usa o app.
 *
 * Mora fora dos módulos de acesso a dados porque todos eles precisam da mesma
 * regra: sem isso, cada um inventaria a sua — e um deles mostraria demais.
 */

/** Códigos do Postgres cujas mensagens são escritas **para o usuário**. */
export const BUSINESS_ERROR_CODES = new Set([
  "22023", // valor inválido: convite inexistente, expirado ou já utilizado
  "23505", // conflito: já faz parte de uma família
  "42501", // autorização: não autenticado, dono não pode sair, dono/escopo imutável
]);

/**
 * Devolve a mensagem do banco quando ela é para o usuário; caso contrário,
 * devolve `fallback`. Erro nulo devolve `null` — o caminho de sucesso.
 */
export function toUserMessage(
  error: { code?: string; message?: string } | null,
  fallback: string,
): string | null {
  if (!error) {
    return null;
  }

  const message = error.message?.trim();

  if (message && BUSINESS_ERROR_CODES.has(error.code ?? "")) {
    return message;
  }

  return fallback;
}
