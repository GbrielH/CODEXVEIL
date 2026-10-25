import { listCampaignNotes, signedMediaUrls } from '@codexveil/database';
import type { Metadata } from 'next';
import { NotesBoard } from '@/components/notes/notes-board';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Anotações' };

export default async function NotesPage({
  params,
}: PageProps<'/campanhas/[campaignId]/anotacoes'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const notes = await listCampaignNotes(supabase, campaign.id);
  const images = await signedMediaUrls(
    supabase,
    notes.map((note) => note.imagePath),
  );

  return (
    <NotesBoard
      campaignId={campaign.id}
      notes={notes}
      images={images}
      currentUserId={user.id}
      isGm={campaign.role === 'gm'}
      canWrite={campaign.status === 'active'}
    />
  );
}
