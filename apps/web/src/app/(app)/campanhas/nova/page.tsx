import { listSystems } from '@codexveil/rpg-systems';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { CreateCampaignForm } from './form';

export const metadata: Metadata = { title: 'Nova campanha' };

export default function NewCampaignPage() {
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
      <CreateCampaignForm systems={systems} />
    </div>
  );
}
