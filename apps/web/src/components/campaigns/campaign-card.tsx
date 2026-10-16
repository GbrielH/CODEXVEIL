import type { CampaignSummary } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { Archive, Crown, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cx } from '@/lib/cx';
import { formatRelative, pluralize } from '@/lib/format';

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const system = findSystem(campaign.systemId);
  const archived = campaign.status === 'archived';
  return (
    <Link
      href={`/campanhas/${campaign.id}`}
      className={cx(
        'group ornate flex h-full flex-col rounded-lg border border-line bg-card p-5 shadow-card transition-colors',
        'hover:border-parchment-400/40 hover:bg-raised',
        archived && 'opacity-75',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={campaign.role === 'gm' ? 'brand' : 'neutral'} icon={campaign.role === 'gm' ? <Crown className="h-3 w-3" aria-hidden="true" /> : undefined}>
          {campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
        </Badge>
        {archived ? (
          <Badge tone="warning" icon={<Archive className="h-3 w-3" aria-hidden="true" />}>
            Arquivada
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg leading-snug group-hover:text-parchment-100">{campaign.name}</h3>
      {campaign.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{campaign.description}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-fg-muted">
        <span>{system?.shortName ?? campaign.systemId}</span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {pluralize(campaign.memberCount, 'participante', 'participantes')}
        </span>
        <span>Atualizada {formatRelative(campaign.updatedAt)}</span>
      </div>
    </Link>
  );
}
