'use client';

import type { CampaignMember } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  leaveCampaignAction,
  removeMemberAction,
  setMemberRoleAction,
  transferOwnershipAction,
} from '@/app/(app)/campanhas/actions';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/actions';

interface MemberListProps {
  campaignId: string;
  campaignName: string;
  members: CampaignMember[];
  currentUserId: string;
  viewerIsOwner: boolean;
  viewerIsGm: boolean;
  isActive: boolean;
}

export function MemberList({
  campaignId,
  campaignName,
  members,
  currentUserId,
  viewerIsOwner,
  viewerIsGm,
  isActive,
}: MemberListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingRole, startRoleTransition] = useTransition();
  const [busyMember, setBusyMember] = useState<string | null>(null);

  /** Executa a ação; erros mantêm o diálogo aberto com a mensagem. */
  const run = async (action: () => Promise<ActionResult | undefined>) => {
    const result = await action();
    if (result && !result.ok) throw new Error(result.message);
    if (result?.message) toast({ tone: 'success', title: result.message });
    router.refresh();
  };

  const changeRole = (member: CampaignMember) => {
    const nextRole = member.role === 'gm' ? 'player' : 'gm';
    setBusyMember(member.userId);
    startRoleTransition(async () => {
      const result = await setMemberRoleAction(campaignId, member.userId, nextRole);
      setBusyMember(null);
      if (!result.ok) {
        toast({
          tone: 'danger',
          title: 'Não foi possível alterar o papel',
          description: result.message,
        });
        return;
      }
      toast({
        tone: 'success',
        title: `${member.displayName}: ${result.message ?? 'papel alterado'}`,
      });
      router.refresh();
    });
  };

  return (
    <ul className="divide-y divide-line">
      {members.map((member) => {
        const isSelf = member.userId === currentUserId;
        const canRemove =
          isActive &&
          !isSelf &&
          !member.isOwner &&
          (viewerIsOwner || (viewerIsGm && member.role === 'player'));
        const canChangeRole = isActive && viewerIsOwner && !member.isOwner;
        const canTransfer = isActive && viewerIsOwner && !member.isOwner && member.role === 'gm';
        const canLeave = isSelf && !member.isOwner;

        return (
          <li
            key={member.userId}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={member.displayName} />
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">
                  {member.displayName}
                  {isSelf ? (
                    <span className="ml-1 text-sm font-normal text-fg-muted">(você)</span>
                  ) : null}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  <Badge
                    tone={member.role === 'gm' ? 'brand' : 'neutral'}
                    icon={
                      member.isOwner ? <Crown className="h-3 w-3" aria-hidden="true" /> : undefined
                    }
                  >
                    {member.isOwner ? 'Mestre responsável' : campaignRoleLabels[member.role]}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {canChangeRole ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pendingRole && busyMember === member.userId}
                  onClick={() => changeRole(member)}
                >
                  {member.role === 'gm' ? 'Tornar jogador' : 'Tornar mestre'}
                </Button>
              ) : null}
              {canTransfer ? (
                <ConfirmDialog
                  trigger={(open) => (
                    <Button size="sm" variant="secondary" onClick={open}>
                      Transferir campanha
                    </Button>
                  )}
                  title="Transferir a campanha?"
                  description={
                    <>
                      <strong className="text-fg">{member.displayName}</strong> passará a ser o
                      mestre responsável por “{campaignName}”. Você continuará como mestre, mas não
                      poderá mais arquivar, excluir ou alterar papéis.
                    </>
                  }
                  confirmLabel="Transferir"
                  tone="primary"
                  onConfirm={() => run(() => transferOwnershipAction(campaignId, member.userId))}
                />
              ) : null}
              {canRemove ? (
                <ConfirmDialog
                  trigger={(open) => (
                    <Button size="sm" variant="danger" onClick={open}>
                      Remover
                    </Button>
                  )}
                  title={`Remover ${member.displayName}?`}
                  description="A pessoa perde o acesso à campanha. Os personagens dela são desvinculados, mas continuam na conta dela."
                  confirmLabel="Remover participante"
                  onConfirm={() => run(() => removeMemberAction(campaignId, member.userId))}
                />
              ) : null}
              {canLeave ? (
                <ConfirmDialog
                  trigger={(open) => (
                    <Button size="sm" variant="danger" onClick={open}>
                      Sair da campanha
                    </Button>
                  )}
                  title="Sair da campanha?"
                  description="Você perderá o acesso ao conteúdo da campanha. Seus personagens continuam na sua conta. Para voltar, será preciso um novo convite."
                  confirmLabel="Sair"
                  onConfirm={() => run(() => leaveCampaignAction(campaignId))}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
