import { getSession, type CampaignDetail, type SessionDetail } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { SessionUser } from '@/lib/auth';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Sessão da campanha. Sessões não publicadas são invisíveis para jogadores no banco,
 * então o resultado para eles é o mesmo "não encontrado" de uma sessão inexistente.
 */
export const loadSessionOrNotFound = cache(
  async (
    campaignId: string,
    sessionId: string,
  ): Promise<{ user: SessionUser; campaign: CampaignDetail; session: SessionDetail }> => {
    const { user, campaign } = await loadCampaignOrNotFound(campaignId);
    if (!uuidSchema.safeParse(sessionId).success) notFound();
    const supabase = await createSupabaseServerClient();
    const session = await getSession(supabase, sessionId);
    if (!session || session.campaignId !== campaign.id) notFound();
    return { user, campaign, session };
  },
);
