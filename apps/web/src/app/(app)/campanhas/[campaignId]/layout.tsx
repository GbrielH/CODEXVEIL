import { campaignRoleLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { Archive, Crown } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { SectionTabs, type SectionTab } from '@/components/layout/section-tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { routes } from '@/lib/routes';

export default async function CampaignLayout({ children, params }: LayoutProps<'/campanhas/[campaignId]'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const base = `/campanhas/${campaign.id}`;
  const isGm = campaign.role === 'gm';
  const system = findSystem(campaign.systemId);

  const tabs: SectionTab[] = [{ href: base as Route, label: 'Visão geral', exact: true }];
  if (!isGm) tabs.push({ href: `${base}/personagem` as Route, label: 'Meu personagem' });
  if (isGm) tabs.push({ href: `${base}/mesa` as Route, label: 'Mesa do mestre' });
  tabs.push(
    { href: `${base}/sessoes` as Route, label: 'Sessões' },
    { href: `${base}/dados` as Route, label: 'Dados' },
    { href: `${base}/biblioteca` as Route, label: 'Biblioteca' },
    { href: `${base}/livros` as Route, label: 'Livros' },
    { href: `${base}/anotacoes` as Route, label: 'Anotações' },
    { href: `${base}/links` as Route, label: 'Links' },
  );
  if (isGm) {
    tabs.push(
      { href: `${base}/convites` as Route, label: 'Convites' },
      { href: `${base}/configuracoes` as Route, label: 'Configurações' },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={routes.campaigns} className="text-sm text-fg-muted hover:text-fg">
          ← Campanhas
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={isGm ? 'brand' : 'neutral'} icon={isGm ? <Crown className="h-3 w-3" aria-hidden="true" /> : undefined}>
            {campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
          </Badge>
          <Badge tone="parchment">{system?.shortName ?? campaign.systemId}</Badge>
          {campaign.status === 'archived' ? (
            <Badge tone="warning" icon={<Archive className="h-3 w-3" aria-hidden="true" />}>
              Arquivada
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl leading-tight sm:text-3xl">{campaign.name}</h1>
      </div>

      {campaign.status === 'archived' ? (
        <Alert tone="warning" title="Campanha arquivada">
          Os dados estão preservados, mas nada pode ser alterado. O mestre responsável pode reabri-la nas
          configurações.
        </Alert>
      ) : null}

      <SectionTabs tabs={tabs} label="Seções da campanha" />
      {children}
    </div>
  );
}
