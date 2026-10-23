import type { CampaignSummary } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { Archive, Crown, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cx } from '@/lib/cx';
import { formatRelative, pluralize } from '@/lib/format';
import { CampaignCover } from './campaign-cover';

/**
 * Cartão da campanha no estilo "Grimório Arcano": a arte ocupa o cartão (capa ou a paisagem da
 * campanha) e o título fica sobre ela; papel e sistema em etiquetas no topo.
 */
export function CampaignCard({ campaign, coverUrl }: { campaign: CampaignSummary; coverUrl: string | null }) {
  const system = findSystem(campaign.systemId);
  const archived = campaign.status === 'archived';
  return (
    <Link
      href={`/campanhas/${campaign.id}`}
      className={cx(
        'group relative isolate flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl border border-line shadow-card transition-[transform,border-color,box-shadow] duration-300',
        'hover:-translate-y-1 hover:border-wine-400/50 hover:shadow-glow',
        archived && 'opacity-75 saturate-50',
      )}
    >
      <CampaignCover url={coverUrl} name={campaign.name} className="absolute inset-0 -z-10 h-full w-full transition-transform duration-500 group-hover:scale-[1.05]" />
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal-950 via-charcoal-950/55 to-transparent" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Badge
          tone={campaign.role === 'gm' ? 'brand' : 'neutral'}
          icon={campaign.role === 'gm' ? <Crown className="h-3 w-3" aria-hidden="true" /> : undefined}
          className="backdrop-blur"
        >
          {campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
        </Badge>
        <Badge tone="parchment" className="backdrop-blur">
          {system?.shortName ?? campaign.systemId}
        </Badge>
        {archived ? (
          <Badge tone="warning" icon={<Archive className="h-3 w-3" aria-hidden="true" />}>
            Arquivada
          </Badge>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="text-lg leading-snug [text-shadow:0_2px_12px_rgb(0_0_0/0.9)] group-hover:text-parchment-50">{campaign.name}</h3>
        {campaign.description ? <p className="mt-1 line-clamp-1 text-xs text-fg-secondary">{campaign.description}</p> : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {pluralize(campaign.memberCount, 'participante', 'participantes')}
          </span>
          <span>Atualizada {formatRelative(campaign.updatedAt)}</span>
        </p>
      </div>
    </Link>
  );
}
