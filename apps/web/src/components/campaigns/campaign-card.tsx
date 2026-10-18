import type { CampaignSummary } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { Archive, Crown, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cx } from '@/lib/cx';
import { formatRelative, pluralize } from '@/lib/format';
import { CampaignCover } from './campaign-cover';

/** Cartão da campanha com a capa (ou o fundo com as iniciais) no topo. */
export function CampaignCard({ campaign, coverUrl }: { campaign: CampaignSummary; coverUrl: string | null }) {
  const system = findSystem(campaign.systemId);
  const archived = campaign.status === 'archived';
  return (
    <Link
      href={`/campanhas/${campaign.id}`}
      className={cx(
        'group ornate flex h-full flex-col overflow-hidden rounded-lg border border-line bg-card shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:border-parchment-400/40 hover:bg-raised hover:shadow-glow',
        archived && 'opacity-75',
      )}
    >
      <div className="relative">
        <CampaignCover url={coverUrl} name={campaign.name} className="aspect-[16/9] w-full transition-transform duration-300 group-hover:scale-[1.02]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-card to-transparent" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col p-5 pt-3">
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
      </div>
    </Link>
  );
}
