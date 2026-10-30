import { listSessions } from '@codexveil/database';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { campaignPath, sessionPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * A antiga aba Quadros: os quadros agora ficam dentro de cada sessão (editor da sessão, aba
 * Quadro). Links antigos levam ao quadro da sessão em andamento ou da mais recente.
 */
export default async function BoardsRedirect({ params, searchParams }: PageProps<'/campanhas/[campaignId]/quadros'>) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role !== 'gm') notFound();
  const sessions = await listSessions(await createSupabaseServerClient(), campaign.id);
  const target = sessions.find((entry) => entry.status === 'in_progress') ?? [...sessions].sort((a, b) => b.number - a.number)[0];
  if (!target) redirect(campaignPath(campaign.id, '/sessoes') as Route);
  const board = typeof query.quadro === 'string' ? `&quadro=${query.quadro}` : '';
  redirect(`${sessionPath(campaign.id, target.id)}/editar?aba=quadro${board}` as Route);
}
