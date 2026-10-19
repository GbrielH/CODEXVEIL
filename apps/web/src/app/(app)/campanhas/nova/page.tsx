import { listSystems } from '@codexveil/rpg-systems';
import { requireSessionUser } from '@/lib/auth';
import { ownReadyBookPacks } from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { CreateCampaignForm } from './form';

export const metadata: Metadata = { title: 'Nova campanha' };

export default async function NewCampaignPage() {
  const user = await requireSessionUser(routes.newCampaign);
  const packs = await ownReadyBookPacks(await createSupabaseServerClient(), user.id);
  const books = packs.map((pack) => ({ bookKey: pack.bookKey, name: pack.name, category: pack.category, edition: pack.edition, entryCounts: pack.entryCounts }));
  const systems = listSystems().map((system) => ({
    id: system.id,
    name: system.name,
    reference: system.rulesReference,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Campanhas"
        title="Nova campanha"
        description="Você será o mestre responsável. Depois de criar, convide os jogadores."
      />
      <CreateCampaignForm systems={systems} books={books} />
    </div>
  );
}
