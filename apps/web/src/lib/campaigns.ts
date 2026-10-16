import { getCampaign, type CampaignDetail } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requireSessionUser, type SessionUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Carrega a campanha para a requisição atual (memorizado entre layout e páginas).
 * Campanha inexistente e campanha da qual o usuário não participa produzem o mesmo
 * "não encontrado" — sem revelar se o UUID existe.
 */
export const loadCampaignOrNotFound = cache(
  async (campaignId: string): Promise<{ user: SessionUser; campaign: CampaignDetail }> => {
    const user = await requireSessionUser(`/campanhas/${campaignId}`);
    if (!uuidSchema.safeParse(campaignId).success) notFound();
    const supabase = await createSupabaseServerClient();
    const campaign = await getCampaign(supabase, campaignId, user.id);
    if (!campaign) notFound();
    return { user, campaign };
  },
);
