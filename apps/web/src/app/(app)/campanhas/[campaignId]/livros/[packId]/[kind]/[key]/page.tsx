import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookEntryScreen } from '@/components/books/book-reader';
import { loadBookReader } from '@/lib/books';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Livro da campanha' };

export default async function CampaignBookEntryPage({ params }: PageProps<'/campanhas/[campaignId]/livros/[packId]/[kind]/[key]'>) {
  const { campaignId, packId, kind, key } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const reader = await loadBookReader(await createSupabaseServerClient(), packId, { userId: user.id, campaign });
  if (!reader) notFound();
  return <BookEntryScreen reader={reader} kindSlug={kind} entryKey={key} />;
}
