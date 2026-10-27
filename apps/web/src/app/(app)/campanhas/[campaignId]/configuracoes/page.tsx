import { signedMediaUrls } from '@codexveil/database';
import { Settings, ShieldAlert, Swords } from 'lucide-react';
import type { Metadata } from 'next';
import { CampaignCoverCard } from '@/components/campaigns/cover-card';
import { Card, CardHeader } from '@/components/ui/card';
import { ForbiddenState } from '@/components/ui/states';
import { campaignBookPacks, ownReadyBookPacks } from '@/lib/books';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DangerZone } from './danger-zone';
import { CampaignSettingsForm } from './settings-form';
import { CustomActionsForm } from './custom-actions-form';
import { TurnSettingsForm } from './turn-settings-form';

export const metadata: Metadata = { title: 'Configurações da campanha' };

export default async function CampaignSettingsPage({ params }: PageProps<'/campanhas/[campaignId]/configuracoes'>) {
  const { campaignId } = await params;
  const { campaign, user } = await loadCampaignOrNotFound(campaignId);

  if (campaign.role !== 'gm') {
    return <ForbiddenState description="Somente mestres alteram as configurações desta campanha." />;
  }

  const archived = campaign.status === 'archived';
  const supabase = await createSupabaseServerClient();
  const covers = await signedMediaUrls(supabase, [campaign.coverPath]);
  const packs = campaign.isOwner ? await ownReadyBookPacks(supabase, user.id) : await campaignBookPacks(supabase, campaign);
  const books = packs.map((pack) => ({ systemId: pack.systemId, bookKey: pack.bookKey, name: pack.name, category: pack.category, edition: pack.edition, entryCounts: pack.entryCounts }));

  return (
    // Telas largas: regras da mesa à esquerda (formulário longo) e o resto numa coluna ao lado.
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
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
          books={books}
          initial={{
            name: campaign.name,
            description: campaign.description,
            partySheetsVisible: campaign.settings.partySheetsVisible,
            playersCanEditSheets: campaign.settings.playersCanEditSheets,
            characterRules: campaign.characterRules,
            creationQuestions: campaign.creationQuestions,
          }}
        />
      </Card>

      <div className="flex flex-col gap-6">
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

      <Card>
        <CardHeader
          title="Ações de combate personalizadas"
          description="Crie ações próprias da sua mesa (nome, tipo, descrição e dado opcional). Elas aparecem para os jogadores na hora do turno."
        />
        <CustomActionsForm campaignId={campaign.id} initial={campaign.customActions} disabled={archived} />
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
    </div>
  );
}
