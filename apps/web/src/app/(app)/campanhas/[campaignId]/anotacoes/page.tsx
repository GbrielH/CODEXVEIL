import { listCampaignNotes, signedMediaUrls } from '@codexveil/database';
import type { Metadata } from 'next';
import { NotesBoard } from '@/components/notes/notes-board';
import { LoadMoreLink, pageWindow, takePage } from '@/components/ui/load-more';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Anotações' };

const PAGE_SIZE = 60;

export default async function NotesPage({
  params,
  searchParams,
}: PageProps<'/campanhas/[campaignId]/anotacoes'>) {
  const { campaignId } = await params;
  const paging = pageWindow((await searchParams).pagina, PAGE_SIZE);
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const { items: notes, hasMore } = takePage(await listCampaignNotes(supabase, campaign.id, { limit: paging.limit }), paging.size);
  const images = await signedMediaUrls(
    supabase,
    notes.map((note) => note.imagePath),
  );

  return (
    <>
    <NotesBoard
      campaignId={campaign.id}
      notes={notes}
      images={images}
      currentUserId={user.id}
      isGm={campaign.role === 'gm'}
      canWrite={campaign.status === 'active'}
    />
    {hasMore ? <LoadMoreLink href={`/campanhas/${campaign.id}/anotacoes`} page={paging.page} label="Carregar mais anotações" /> : null}
    </>
  );
}
