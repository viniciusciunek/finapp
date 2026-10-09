/**
 * Tradução das mensagens do Supabase Auth.
 *
 * O Auth responde em inglês ("User already registered", "Password should be at
 * least 6 characters"). A interface do app é em pt-BR e sem jargão (regra do
 * projeto), então os casos que o usuário consegue provocar são traduzidos aqui;
 * o resto cai numa mensagem genérica.
 *
 * É função pura de propósito: dá para testar sem rede, sem banco e sem React.
 */

/**
 * Converte o texto cru do Supabase em uma mensagem para o usuário.
 *
 * @param message mensagem original do Supabase Auth (em inglês).
 */
export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered")
  ) {
    return "Já existe uma conta com este e-mail. Tente entrar.";
  }

  if (normalized.includes("password should be at least")) {
    return "A senha é curta demais. Use pelo menos 6 caracteres.";
  }

  if (
    normalized.includes("invalid email") ||
    normalized.includes("unable to validate email")
  ) {
    return "E-mail inválido.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }

  return "Não foi possível concluir. Tente de novo em instantes.";
}
