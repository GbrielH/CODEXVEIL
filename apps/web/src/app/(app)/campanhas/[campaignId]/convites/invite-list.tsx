'use client';

import type { CampaignInvite } from '@codexveil/database';
import { formatInviteCode, inviteStatusLabels, type InviteStatus } from '@codexveil/domain';
import { useRouter } from 'next/navigation';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import { revokeInviteAction } from '../../actions';

const statusTones: Record<InviteStatus, BadgeTone> = {
  active: 'success',
  expired: 'neutral',
  revoked: 'danger',
  declined: 'warning',
  exhausted: 'neutral',
};

interface InviteListProps {
  campaignId: string;
  invites: CampaignInvite[];
  siteUrl: string;
  canManage: boolean;
}

export function InviteList({ campaignId, invites, siteUrl, canManage }: InviteListProps) {
  const router = useRouter();
  const { toast } = useToast();

  if (invites.length === 0) {
    return <p className="text-sm text-fg-muted">Nenhum convite criado ainda.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {invites.map((invite) => {
        const code = formatInviteCode(invite.code);
        const isActive = invite.status === 'active';
        return (
          <li key={invite.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg tracking-[0.18em] text-fg-accent tabular">{code}</span>
                <Badge tone={statusTones[invite.status]}>{inviteStatusLabels[invite.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                {invite.invitedEmail ? `Pessoal: ${invite.invitedEmail} · ` : ''}
                {invite.invitedFriendName ? `Para o amigo ${invite.invitedFriendName} · ` : ''}
                Usos: {invite.usesCount}
                {invite.maxUses === null ? ' (ilimitado)' : ` de ${invite.maxUses}`} · Expira em{' '}
                {formatDateTime(invite.expiresAt)}
              </p>
            </div>
            {isActive ? (
              <div className="flex flex-wrap gap-2">
                <CopyButton value={`${siteUrl}/convite/${code}`} label="Copiar link" />
                {canManage ? (
                  <ConfirmDialog
                    trigger={(open) => (
                      <Button size="sm" variant="danger" onClick={open}>
                        Revogar
                      </Button>
                    )}
                    title="Revogar este convite?"
                    description="O código deixa de funcionar imediatamente. Quem já entrou na campanha continua participando."
                    confirmLabel="Revogar convite"
                    onConfirm={async () => {
                      const result = await revokeInviteAction(campaignId, invite.id);
                      if (!result.ok) throw new Error(result.message);
                      toast({ tone: 'success', title: result.message ?? 'Convite revogado.' });
                      router.refresh();
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
