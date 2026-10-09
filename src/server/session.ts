import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { parseHouseholdRole, type HouseholdRole } from "@/domain/household";
import { createClient } from "@/lib/supabase/server";

/**
 * Contexto da requisição: quem está logado, o perfil e a família.
 *
 * Centraliza as perguntas que **toda** tela privada faz ("está logado?", "já
 * tem família?") e elimina o risco de cada página inventar a sua versão.
 *
 * Está embrulhado em `cache()` do React: mesmo sendo chamado pelo layout e por
 * cada página, o banco é consultado **uma vez por requisição**.
 *
 * Nota de segurança: a autorização de verdade é do RLS no Postgres. O que está
 * aqui é contexto para a interface decidir o que mostrar — nunca a barreira de
 * proteção dos dados.
 */

export type SessionProfile = {
  id: string;
  name: string;
  email: string;
};

export type SessionHousehold = {
  id: string;
  name: string;
  role: HouseholdRole;
};

export type SessionContext = {
  userId: string;
  email: string | null;
  profile: SessionProfile;
  household: SessionHousehold | null;
};

/** Nome de exibição quando, por algum motivo, não há perfil no banco. */
function fallbackNameFromEmail(email: string | null): string {
  const local = email?.split("@")[0]?.trim();

  return local && local.length > 0 ? local : "Sem nome";
}

/**
 * Devolve o contexto da requisição, ou `null` quando não há sessão válida.
 *
 * Usa `getClaims()` (valida a assinatura do token) e não `getSession()` — o
 * cookie de sessão é controlado pelo cliente e não pode ser tratado como verdade.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    // `connection()` marca o ponto em que o render passa a depender da
    // requisição. É obrigatório **antes** de `getClaims()`: o Supabase chama
    // `Date.now()` para conferir a validade do token, e com os Cache Components
    // um valor instável só pode ser calculado em tempo de requisição — sem
    // isto, o Next acusa `blocking-prerender-current-time` (docs do Next 16,
    // seção "Random values and timestamps").
    await connection();

    const supabase = await createClient();

    const { data, error } = await supabase.auth.getClaims();

    if (error || !data) {
      return null;
    }

    const userId = data.claims.sub;
    const email = data.claims.email ?? null;

    // Duas consultas em paralelo: perfil e vínculo com a família. A consulta de
    // perfil pode voltar vazia apenas em cenário de dados inconsistente (o trigger
    // de cadastro cria a linha), por isso o fallback.
    const [profileResult, membershipResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("household_members")
        .select("role, household:households ( id, name )")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const membership = membershipResult.data;

    return {
      userId,
      email,
      profile: profileResult.data ?? {
        id: userId,
        name: fallbackNameFromEmail(email),
        email: email ?? "",
      },
      household: membership?.household
        ? {
            id: membership.household.id,
            name: membership.household.name,
            role: parseHouseholdRole(membership.role),
          }
        : null,
    };
  },
);

/**
 * Como `getSessionContext`, mas garante que existe sessão: sem ela, manda para
 * `/login`. Use nas telas privadas.
 */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}

/**
 * Garante sessão **e** família: sem família, manda para `/onboarding` (criar
 * uma ou entrar com convite).
 */
export async function requireHousehold(): Promise<
  SessionContext & { household: SessionHousehold }
> {
  const context = await requireSession();

  if (!context.household) {
    redirect("/onboarding");
  }

  return { ...context, household: context.household };
}
