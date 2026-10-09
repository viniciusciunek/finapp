import { randomInt } from "node:crypto";

import { parseHouseholdRole, type HouseholdRole } from "@/domain/household";
import { generateInviteCode } from "@/domain/invite-code";
import { createClient } from "@/lib/supabase/server";

/**
 * Família e convites — camada de acesso a dados.
 *
 * As páginas e Server Actions chamam estas funções e **nunca** falam com o
 * Supabase diretamente (regra das instruções do projeto).
 *
 * Importante: autorização não mora aqui. Quem decide o que cada um pode fazer é
 * o RLS e as funções do banco (`DOMAIN.md` §3) — estas funções só transportam o
 * resultado. Se um dia alguém chamar uma delas achando que ela "protege" algo,
 * o comentário acima é o aviso.
 */

export type HouseholdMember = {
  userId: string;
  name: string;
  email: string;
  role: HouseholdRole;
};

export type HouseholdInvite = {
  id: string;
  code: string;
  expiresAt: string;
};

/**
 * Códigos de erro do Postgres cujas mensagens são escritas **para o usuário**.
 *
 * As funções `create_household`, `accept_household_invite` e `leave_household`
 * levantam exceções em português e sem jargão — são essas que queremos mostrar.
 * Qualquer outro erro (conexão, `PGRST`, permissão inesperada) vem em inglês e
 * técnico: nesses casos é melhor a mensagem padrão do que vazar detalhe.
 */
const BUSINESS_ERROR_CODES = new Set([
  "22023", // valor inválido: código inexistente, expirado ou já utilizado
  "23505", // conflito: já faz parte de uma família
  "42501", // autorização: não autenticado / dono não pode sair
]);

function toUserMessage(
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

/** Cria a família e torna quem chamou o `owner` (atômico, no banco). */
export async function createHousehold(
  name: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_household", {
    household_name: name,
  });

  return {
    error: toUserMessage(
      error,
      "Não foi possível criar a família. Tente de novo.",
    ),
  };
}

/** Entra numa família a partir do código de convite. */
export async function joinHouseholdWithCode(
  code: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("accept_household_invite", {
    invite_code: code,
  });

  return {
    error: toUserMessage(
      error,
      "Não foi possível entrar na família. Tente de novo.",
    ),
  };
}

/**
 * Sai da família atual. Sem política de `DELETE` em `household_members`, esta
 * função do banco é o único caminho — e ela só remove o **próprio** vínculo.
 */
export async function leaveHousehold(): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("leave_household");

  return {
    error: toUserMessage(
      error,
      "Não foi possível sair da família. Tente de novo.",
    ),
  };
}

/** Lista os membros da família, com nome e e-mail de cada um. */
export async function listHouseholdMembers(
  householdId: string,
): Promise<{ members: HouseholdMember[]; error: string | null }> {
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("user_id, role")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      members: [],
      error: "Não foi possível carregar os membros da família.",
    };
  }

  const userIds = (memberships ?? []).map((membership) => membership.user_id);

  if (userIds.length === 0) {
    return { members: [], error: null };
  }

  // `household_members.user_id` aponta para `auth.users` (não para `profiles`),
  // então o PostgREST não consegue embutir o perfil: são duas consultas. A RLS
  // de `profiles` libera a leitura de quem divide a mesma família.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", userIds);

  if (profilesError) {
    return {
      members: [],
      error: "Não foi possível carregar os dados dos membros.",
    };
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return {
    members: (memberships ?? []).map((membership) => {
      const profile = profileById.get(membership.user_id);

      return {
        userId: membership.user_id,
        name: profile?.name ?? "Sem nome",
        email: profile?.email ?? "",
        role: parseHouseholdRole(membership.role),
      };
    }),
    error: null,
  };
}

/** Quantas vezes tentar de novo quando o código sorteado colide com um existente. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * Gera um convite novo.
 *
 * O código é gerado **no servidor** (o cliente não escolhe o próprio código) e
 * usa `crypto.randomInt` — aleatoriedade criptográfica, não `Math.random`.
 * O `CHECK` da tabela ainda garante o formato, e o `UNIQUE` cobre colisão.
 */
export async function createInvite(input: {
  householdId: string;
  createdBy: string;
}): Promise<{ code: string | null; error: string | null }> {
  const supabase = await createClient();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode((max) => randomInt(max));

    const { error } = await supabase.from("household_invites").insert({
      household_id: input.householdId,
      code,
      created_by: input.createdBy,
    });

    if (!error) {
      return { code, error: null };
    }

    // 23505 aqui significa colisão de código (a tabela tem UNIQUE em `code`):
    // vale tentar outro. Qualquer outro erro, não.
    if (error.code !== "23505") {
      return {
        code: null,
        error: toUserMessage(
          error,
          "Não foi possível gerar o convite. Tente de novo.",
        ),
      };
    }
  }

  return {
    code: null,
    error: "Não conseguimos gerar um código livre. Tente de novo.",
  };
}

/** Lista os convites válidos (não usados e dentro da validade). */
export async function listActiveInvites(
  householdId: string,
): Promise<{ invites: HouseholdInvite[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("household_invites")
    .select("id, code, expires_at")
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return { invites: [], error: "Não foi possível carregar os convites." };
  }

  return {
    invites: (data ?? []).map((invite) => ({
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expires_at,
    })),
    error: null,
  };
}

/** Cancela um convite (o membro da família pode apagar os convites dela). */
export async function revokeInvite(
  inviteId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("household_invites")
    .delete()
    .eq("id", inviteId);

  return {
    error: error ? "Não foi possível cancelar o convite." : null,
  };
}
