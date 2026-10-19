import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookIndexScreen } from '@/components/books/book-reader';
import { loadBookReader } from '@/lib/books';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Livro da campanha' };

export default async function CampaignBookPage({ params, searchParams }: PageProps<'/campanhas/[campaignId]/livros/[packId]'>) {
  const [{ campaignId, packId }, query] = await Promise.all([params, searchParams]);
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const reader = await loadBookReader(await createSupabaseServerClient(), packId, { userId: user.id, campaign });
  if (!reader) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Link href={campaignPath(campaign.id, '/livros') as Route} className="text-sm text-fg-muted hover:text-fg">
        ← Livros da campanha
      </Link>
      <BookIndexScreen reader={reader} kindSlug={typeof query.tipo === 'string' ? query.tipo : ''} term={typeof query.q === 'string' ? query.q : ''} />
    </div>
  );
}
