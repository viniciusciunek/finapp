/**
 * Papéis dentro da família.
 *
 * O banco garante os valores possíveis por `CHECK` (`role in ('owner','member')`),
 * mas o TypeScript gerado a partir do schema devolve `string` — então existe uma
 * conversão acontecendo na borda. Ela é **restritiva de propósito**: papel
 * desconhecido vira `member`, o de menos privilégio. Nunca `owner`.
 */

export const HOUSEHOLD_ROLES = ["owner", "member"] as const;

export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

/** Guarda de tipo: diz se o valor é um papel conhecido (não converte). */
export function isHouseholdRole(value: unknown): value is HouseholdRole {
  return (
    typeof value === "string" &&
    (HOUSEHOLD_ROLES as readonly string[]).includes(value)
  );
}

/** Converte o que veio do banco em um papel conhecido (desconhecido → `member`). */
export function parseHouseholdRole(value: unknown): HouseholdRole {
  return isHouseholdRole(value) ? value : "member";
}

/**
 * Só o `owner` administra a família (renomear, por exemplo) — DOMAIN.md §3.1.
 * Gerar convite, ao contrário, qualquer membro pode.
 */
export function canManageHousehold(role: HouseholdRole): boolean {
  return role === "owner";
}
