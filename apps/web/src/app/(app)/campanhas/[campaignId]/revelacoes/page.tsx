import { listCampaignHandouts, listPartyFaces, signedMediaUrls } from '@codexveil/database';
import type { Metadata } from 'next';
import { HandoutsBoard } from '@/components/handouts/handouts-board';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Revelações' };

/** Revelações do mestre: informações e imagens entregues fora do roteiro da sessão. */
export default async function HandoutsPage({ params }: PageProps<'/campanhas/[campaignId]/revelacoes'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const isGm = campaign.role === 'gm';
  const [handouts, faces] = await Promise.all([listCampaignHandouts(supabase, campaign.id), isGm ? listPartyFaces(supabase, campaign.id) : Promise.resolve([])]);
  const images = await signedMediaUrls(
    supabase,
    handouts.map((handout) => handout.imagePath),
  );
  return (
    <HandoutsBoard
      campaignId={campaign.id}
      handouts={handouts}
      images={images}
      isGm={isGm}
      canWrite={campaign.status === 'active'}
      party={faces.map((face) => ({ id: face.id, name: face.name, ownerName: face.ownerName }))}
    />
  );
}
