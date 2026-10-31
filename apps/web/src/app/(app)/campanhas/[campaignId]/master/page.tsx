import { getAssimilacaoMaster } from '@codexveil/database';
import { parseMasterConflicts, parseMasterRefuges } from '@codexveil/rpg-systems/assimilacao';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AssimilacaoMasterPanel } from '@/components/assimilacao/master-panel';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'MASTER' };

/** Aba MASTER (só Assimilação e só mestres): Partituras de Conflito e Refúgios do Assimilador. */
export default async function MasterPage({ params }: PageProps<'/campanhas/[campaignId]/master'>) {
  const { campaignId } = await params;
  const { campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.systemId !== 'assimilacao' || campaign.role !== 'gm') notFound();
  const data = await getAssimilacaoMaster(await createSupabaseServerClient(), campaign.id);
  return (
    <AssimilacaoMasterPanel
      campaignId={campaign.id}
      initialConflicts={parseMasterConflicts(data.conflicts)}
      initialRefuges={parseMasterRefuges(data.refuges)}
    />
  );
}
