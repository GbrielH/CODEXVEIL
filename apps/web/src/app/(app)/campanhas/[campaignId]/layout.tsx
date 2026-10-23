import { signedMediaUrls } from '@codexveil/database';
import { campaignRoleLabels } from '@codexveil/domain';
import { findSystem } from '@codexveil/rpg-systems';
import { Archive, ChevronLeft, Crown, Users } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { CampaignCover } from '@/components/campaigns/campaign-cover';
import { CampaignColorsProvider, DiceColorRequired } from '@/components/dice/campaign-colors';
import { SectionTabs, type SectionTab } from '@/components/layout/section-tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { pluralize } from '@/lib/format';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function CampaignLayout({
  children,
  params,
}: LayoutProps<'/campanhas/[campaignId]'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const base = `/campanhas/${campaign.id}`;
  const isGm = campaign.role === 'gm';
  const system = findSystem(campaign.systemId);
  const covers = campaign.coverPath ? await signedMediaUrls(await createSupabaseServerClient(), [campaign.coverPath]) : {};
  const coverUrl = campaign.coverPath ? (covers[campaign.coverPath] ?? null) : null;

  const tabs: SectionTab[] = [{ href: base as Route, label: 'Visão geral', exact: true }];
  if (!isGm) tabs.push({ href: `${base}/personagem` as Route, label: 'Meu personagem' });
  if (isGm) tabs.push({ href: `${base}/mesa` as Route, label: 'Mesa do mestre' });
  tabs.push(
    { href: `${base}/sessao` as Route, label: 'Sessão' },
    { href: `${base}/sessoes` as Route, label: isGm ? 'Sessões' : 'Roteiros' },
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
    <CampaignColorsProvider campaignId={campaign.id}>
      <div className="flex flex-col gap-6">
        {/* Banner da campanha: capa (ou a paisagem arcana dela) com o título por cima. */}
        <header className="relative isolate overflow-hidden rounded-xl border border-line shadow-[0_24px_60px_-34px_rgb(107_59_198/0.9)]">
          <CampaignCover url={coverUrl} name={campaign.name} className="absolute inset-0 -z-10 h-full w-full" />
          <span className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal-950 via-charcoal-950/70 to-charcoal-950/10" aria-hidden="true" />
          <div className="flex min-h-48 flex-col justify-between gap-6 p-5 sm:min-h-56 sm:p-7">
          <Link href={routes.campaigns} className="inline-flex w-fit items-center gap-1 rounded-full border border-line bg-charcoal-950/60 px-3 py-1 text-xs text-fg-secondary backdrop-blur hover:text-fg">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Campanhas
          </Link>
          <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={isGm ? 'brand' : 'neutral'}
              icon={isGm ? <Crown className="h-3 w-3" aria-hidden="true" /> : undefined}
            >
              {campaign.isOwner ? 'Mestre responsável' : campaignRoleLabels[campaign.role]}
            </Badge>
            <Badge tone="parchment">{system?.shortName ?? campaign.systemId}</Badge>
            {campaign.status === 'archived' ? (
              <Badge tone="warning" icon={<Archive className="h-3 w-3" aria-hidden="true" />}>
                Arquivada
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-2 text-3xl leading-tight [text-shadow:0_2px_18px_rgb(0_0_0/0.8)] sm:text-4xl">{campaign.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
            <span>{system?.name ?? campaign.systemId}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden="true" />
              {pluralize(campaign.memberCount, 'participante', 'participantes')}
            </span>
            <span>Mestre: {campaign.ownerName}</span>
          </p>
          </div>
          </div>
        </header>

        {campaign.status === 'archived' ? (
          <Alert tone="warning" title="Campanha arquivada">
            Os dados estão preservados, mas nada pode ser alterado. O mestre responsável pode
            reabri-la nas configurações.
          </Alert>
        ) : null}

        <SectionTabs tabs={tabs} label="Seções da campanha" />
        {campaign.status === 'active' ? <DiceColorRequired /> : null}
        {children}
      </div>
    </CampaignColorsProvider>
  );
}
