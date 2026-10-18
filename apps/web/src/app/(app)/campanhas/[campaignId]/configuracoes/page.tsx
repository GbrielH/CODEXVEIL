import { signedMediaUrls } from '@codexveil/database';
import { Settings, ShieldAlert, Swords } from 'lucide-react';
import type { Metadata } from 'next';
import { CampaignCoverCard } from '@/components/campaigns/cover-card';
import { Card, CardHeader } from '@/components/ui/card';
import { ForbiddenState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DangerZone } from './danger-zone';
import { CampaignSettingsForm } from './settings-form';
import { TurnSettingsForm } from './turn-settings-form';

export const metadata: Metadata = { title: 'Configurações da campanha' };

export default async function CampaignSettingsPage({ params }: PageProps<'/campanhas/[campaignId]/configuracoes'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);

  if (campaign.role !== 'gm') {
    return <ForbiddenState description="Somente mestres alteram as configurações desta campanha." />;
  }

  const archived = campaign.status === 'archived';
  const covers = await signedMediaUrls(await createSupabaseServerClient(), [campaign.coverPath]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card ornate>
        <CardHeader
          icon={<Settings className="h-5 w-5" aria-hidden="true" />}
          title="Dados e regras da mesa"
          description={archived ? 'Reabra a campanha para editar.' : 'Visíveis para todos os participantes.'}
        />
        <CampaignSettingsForm
          campaignId={campaign.id}
          systemId={campaign.systemId}
          disabled={archived}
          initial={{
            name: campaign.name,
            description: campaign.description,
            partySheetsVisible: campaign.settings.partySheetsVisible,
            playersCanEditSheets: campaign.settings.playersCanEditSheets,
            characterRules: campaign.characterRules,
          }}
        />
      </Card>

      <CampaignCoverCard
        campaignId={campaign.id}
        name={campaign.name}
        coverPath={campaign.coverPath}
        coverUrl={campaign.coverPath ? (covers[campaign.coverPath] ?? null) : null}
        disabled={archived}
      />

      <Card>
        <CardHeader
          icon={<Swords className="h-5 w-5" aria-hidden="true" />}
          title="Turnos"
          description="Como a mesa do mestre começa os turnos (combate, exploração, investigação ou interação social)."
        />
        <TurnSettingsForm campaignId={campaign.id} initial={campaign.turnSettings} disabled={archived} />
      </Card>

      {campaign.isOwner ? (
        <Card className="border-ember-400/30">
          <CardHeader
            icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            title="Zona de perigo"
            description="Disponível apenas para o mestre responsável."
          />
          <DangerZone campaignId={campaign.id} campaignName={campaign.name} archived={archived} />
        </Card>
      ) : null}
    </div>
  );
}
