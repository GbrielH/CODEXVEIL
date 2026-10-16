import { listMyCampaigns } from '@codexveil/database';
import { listSystems } from '@codexveil/rpg-systems';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateCharacterForm } from './form';

export const metadata: Metadata = { title: 'Novo personagem' };

export default async function NewCharacterPage({ searchParams }: PageProps<'/personagens/novo'>) {
  const user = await requireSessionUser(routes.newCharacter);
  const supabase = await createSupabaseServerClient();
  const [campaigns, params] = await Promise.all([listMyCampaigns(supabase, user.id), searchParams]);
  const preselected = typeof params.campanha === 'string' ? params.campanha : '';

  const activeCampaigns = campaigns
    .filter((campaign) => campaign.status === 'active')
    .map((campaign) => ({ id: campaign.id, name: campaign.name, systemId: campaign.systemId }));
  const systems = listSystems().map((system) => ({ id: system.id, name: system.name }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Personagens"
        title="Novo personagem"
        description="Comece pelo essencial. Perícias, magias, inventário e história são preenchidos depois, na ficha."
      />
      <Card ornate className="max-w-3xl">
        <CreateCharacterForm
          campaigns={activeCampaigns}
          systems={systems}
          defaultCampaignId={activeCampaigns.some((campaign) => campaign.id === preselected) ? preselected : ''}
        />
      </Card>
    </div>
  );
}
