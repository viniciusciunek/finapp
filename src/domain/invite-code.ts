/**
 * Contrato do código de convite da família.
 *
 * O formato é compartilhado entre o aplicativo e o banco de dados: a coluna
 * `household_invites.code` tem um `CHECK` com exatamente este alfabeto e este
 * tamanho (ver `supabase/migrations/20261008180810_identity_and_households.sql`).
 * Se mudar aqui, muda lá por migration.
 *
 * Este módulo é puro de propósito: não conhece banco, React nem rede. A
 * aleatoriedade entra por injeção (`generateInviteCode` recebe a fonte), o que
 * deixa o gerador testável e mantém o domínio determinístico.
 */

/**
 * Alfabeto sem caracteres ambíguos: fora `I`, `L`, `O`, `0` e `1`.
 * Quem digita o código de um celular não deve errar entre `O` e `0`.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 10 caracteres sobre 31 símbolos → 31^10 ≈ 8,2 × 10^14 combinações (~49,5 bits). */
export const INVITE_CODE_LENGTH = 10;

/** Grupos da exibição: `ABC-DEFG-HIJ`. */
const DISPLAY_GROUPS = [3, 4, 3] as const;

/**
 * Fonte de aleatoriedade: devolve um inteiro em `[0, maxExclusive)`.
 * Na aplicação é `crypto.randomInt`; nos testes, uma função determinística.
 */
export type RandomInt = (maxExclusive: number) => number;

/**
 * Tira separadores e espaços e coloca em maiúsculas.
 *
 * O banco guarda o código **normalizado** (só o alfabeto, sem hífen), então
 * toda entrada do usuário passa por aqui antes de ser comparada.
 */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Diz se o texto tem o formato de um código válido.
 *
 * Aceita tanto o código "cru" (`ABCDEFGHIJ`) quanto o formatado
 * (`ABC-DEFG-HIJ`) — a normalização acontece antes da checagem.
 */
export function isValidInviteCode(input: string): boolean {
  const code = normalizeInviteCode(input);

  if (code.length !== INVITE_CODE_LENGTH) {
    return false;
  }

  return [...code].every((character) =>
    INVITE_CODE_ALPHABET.includes(character),
  );
}

/**
 * Formata para exibição em grupos: `ABC-DEFG-HIJ`.
 *
 * Serve para leitura humana; a validação e o armazenamento usam a forma
 * normalizada. Entradas mais curtas (ou incompletas) não quebram a exibição.
 */
export function formatInviteCode(input: string): string {
  const code = normalizeInviteCode(input);
  const groups: string[] = [];

  let cursor = 0;
  for (const size of DISPLAY_GROUPS) {
    if (cursor >= code.length) {
      break;
    }

    groups.push(code.slice(cursor, cursor + size));
    cursor += size;
  }

  if (cursor < code.length) {
    groups.push(code.slice(cursor));
  }

  return groups.join("-");
}

/**
 * Gera um código novo.
 *
 * A fonte de aleatoriedade é injetada — em produção, `crypto.randomInt`
 * (criptograficamente seguro). Recusar valores fora da faixa evita gerar um
 * código silenciosamente mais fraco se a fonte estiver errada.
 *
 * @throws {RangeError} se a fonte devolver algo que não seja um índice válido.
 */
export function generateInviteCode(randomInt: RandomInt): string {
  const characters: string[] = [];

  for (let position = 0; position < INVITE_CODE_LENGTH; position += 1) {
    const index = randomInt(INVITE_CODE_ALPHABET.length);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= INVITE_CODE_ALPHABET.length
    ) {
      throw new RangeError(
        `Fonte de aleatoriedade inválida: esperado inteiro entre 0 e ${
          INVITE_CODE_ALPHABET.length - 1
        }, recebido ${index}.`,
      );
    }

    characters.push(INVITE_CODE_ALPHABET[index]);
  }

  return characters.join("");
}
