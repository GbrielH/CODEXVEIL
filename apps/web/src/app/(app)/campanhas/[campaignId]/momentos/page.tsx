import { callsEnabled } from '@/lib/env';
import { notFound } from 'next/navigation';
import {
  listCampaignCharacters,
  listCampaignHighlights,
  signedMediaUrls,
} from '@codexveil/database';
import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { CampaignHighlights } from '@/components/call/session-highlights';
import { EmptyState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Melhores Momentos' };

/** Galeria da campanha: os melhores momentos de todas as sessões. */
export default async function CampaignMomentsPage({
  params,
}: PageProps<'/campanhas/[campaignId]/momentos'>) {
  if (!callsEnabled()) notFound();
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const [highlights, party] = await Promise.all([
    listCampaignHighlights(supabase, campaign.id).catch(() => []),
    listCampaignCharacters(supabase, campaign.id).catch(() => []),
  ]);
  const urls = await signedMediaUrls(supabase, [
    ...highlights.map((highlight) => highlight.imagePath),
    ...party.map((character) => character.portraitPath),
  ]);
  if (!highlights.length)
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" aria-hidden="true" />}
        title="Nenhum momento ainda"
        description="Depois de uma sessão transcrita na Call, o mestre gera os melhores momentos na página da sessão."
      />
    );
  return (
    <CampaignHighlights
      campaignId={campaign.id}
      highlights={highlights.map((highlight) => ({
        ...highlight,
        imageUrl: highlight.imagePath ? (urls[highlight.imagePath] ?? null) : null,
      }))}
      characters={party.map((character) => ({
        id: character.id,
        name: character.name,
        portraitUrl: character.portraitPath ? (urls[character.portraitPath] ?? null) : null,
      }))}
    />
  );
}
