import type { Metadata } from "next";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canManageHousehold } from "@/domain/household";
import { formatInviteCode } from "@/domain/invite-code";
import { listActiveInvites, listHouseholdMembers } from "@/server/households";
import { requireHousehold } from "@/server/session";

import { revokeInviteAction } from "../actions";
import { InviteCard } from "./_components/invite-card";

export const metadata: Metadata = {
  title: "Família",
};

/** Data curta para a validade do convite (`dd/mm`). */
function formatExpiry(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(isoDate));
}

/**
 * Tela da família: quem está nela e como convidar mais alguém.
 *
 * As duas consultas saem em paralelo e cada uma trata o próprio erro: uma falha
 * ao listar convites não deve esconder a lista de membros.
 *
 * O `<Suspense>` é obrigatório: as consultas ao banco são dado de requisição, e
 * sem o limite explícito o Next 16 acusa `blocking-prerender-dynamic`. Com ele,
 * o cabeçalho, a alternância de visão e a barra inferior aparecem na hora — só
 * o miolo espera.
 */
export default function FamilyPage() {
  return (
    <Suspense fallback={<FamilyPlaceholder />}>
      <FamilyContent />
    </Suspense>
  );
}

function FamilyPlaceholder() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}

async function FamilyContent() {
  const context = await requireHousehold();

  const [membersResult, invitesResult] = await Promise.all([
    listHouseholdMembers(context.household.id),
    listActiveInvites(context.household.id),
  ]);

  const { members, error: membersError } = membersResult;
  const { invites, error: invitesError } = invitesResult;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Quem está na família</h2>
          <span className="text-muted-foreground text-sm">
            {members.length === 1 ? "1 pessoa" : `${members.length} pessoas`}
          </span>
        </div>

        {membersError ? (
          <p className="text-destructive text-sm">{membersError}</p>
        ) : null}

        {members.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {member.userId === context.userId ? " (você)" : ""}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.email}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {canManageHousehold(member.role) ? "Dono" : "Membro"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <InviteCard />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Convites válidos</h2>

        {invitesError ? (
          <p className="text-destructive text-sm">{invitesError}</p>
        ) : null}

        {invites.length === 0 && !invitesError ? (
          <p className="text-muted-foreground text-sm">
            Nenhum convite em aberto. Gere um acima quando precisar.
          </p>
        ) : null}

        {invites.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <code className="font-mono text-sm tracking-widest">
                    {formatInviteCode(invite.code)}
                  </code>
                  <p className="text-muted-foreground text-xs">
                    válido até {formatExpiry(invite.expiresAt)}
                  </p>
                </div>

                <form action={revokeInviteAction}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Cancelar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
