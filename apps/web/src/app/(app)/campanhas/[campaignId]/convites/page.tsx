import { listCampaignInvites } from '@codexveil/database';
import { History, UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { LoadMoreLink, pageWindow, takePage } from '@/components/ui/load-more';
import { ForbiddenState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { siteUrl } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { InviteForm } from './invite-form';
import { InviteList } from './invite-list';

export const metadata: Metadata = { title: 'Convites' };

const PAGE_SIZE = 25;

export default async function CampaignInvitesPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/convites'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);

  if (campaign.role !== 'gm') {
    return <ForbiddenState description="Somente mestres gerenciam convites desta campanha." />;
  }

  const supabase = await createSupabaseServerClient();
  const paging = pageWindow((await searchParams).pagina, PAGE_SIZE);
  const { items: invites, hasMore } = takePage(await listCampaignInvites(supabase, campaign.id, { limit: paging.limit }), paging.size);
  const isActive = campaign.status === 'active';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <Card ornate>
        <CardHeader
          icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
          title="Novo convite"
          description="Cada jogador entra com a própria conta usando o código ou o link."
        />
        {isActive ? (
          <InviteForm campaignId={campaign.id} />
        ) : (
          <Alert tone="warning">Campanhas arquivadas não aceitam novos participantes.</Alert>
        )}
      </Card>
      <Card>
        <CardHeader
          icon={<History className="h-5 w-5" aria-hidden="true" />}
          title="Convites recentes"
          description="Códigos expirados, esgotados ou revogados não funcionam mais."
        />
        <InviteList campaignId={campaign.id} invites={invites} siteUrl={siteUrl()} canManage={isActive} />
        {hasMore ? <LoadMoreLink href={`/campanhas/${campaign.id}/convites`} page={paging.page} label="Carregar convites mais antigos" /> : null}
      </Card>
    </div>
  );
}
