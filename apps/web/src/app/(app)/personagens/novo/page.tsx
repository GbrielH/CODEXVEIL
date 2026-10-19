import { listMyCampaigns } from '@codexveil/database';
import { parseDnd5eCampaignRules } from '@codexveil/rpg-systems/dnd5e';
import type { Metadata } from 'next';
import { Dnd5eCreationWizard } from '@/components/characters/dnd5e-wizard/wizard';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSessionUser } from '@/lib/auth';
import { campaignBookPacks, loadBookSources, ownReadyBookPacks } from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Novo personagem' };

export default async function NewCharacterPage({ searchParams }: PageProps<'/personagens/novo'>) {
  const user = await requireSessionUser(routes.newCharacter);
  const supabase = await createSupabaseServerClient();
  const [campaigns, params] = await Promise.all([listMyCampaigns(supabase, user.id), searchParams]);
  const preselected = typeof params.campanha === 'string' ? params.campanha : '';

  // Personagens de campanha são dos jogadores; o mestre cria NPCs e monstros na biblioteca.
  const playableCampaigns = campaigns.filter((campaign) => campaign.status === 'active' && campaign.role === 'player' && campaign.systemId === 'dnd5e');

  // Livros: os liberados em cada campanha (do mestre dela) e, nas fichas pessoais, os do próprio usuário.
  const [ownPacks, ...campaignPacks] = await Promise.all([
    ownReadyBookPacks(supabase, user.id),
    ...playableCampaigns.map((campaign) => campaignBookPacks(supabase, campaign)),
  ]);
  const allPacks = [...new Map([...ownPacks, ...campaignPacks.flat()].map((pack) => [pack.id, pack])).values()];
  const sources = await loadBookSources(supabase, allPacks);
  const books = Object.fromEntries(sources.map(({ packId, ...source }) => [packId, source]));

  const playable = playableCampaigns.map((campaign, index) => ({
    id: campaign.id,
    name: campaign.name,
    rules: parseDnd5eCampaignRules(campaign.characterRules),
    packIds: (campaignPacks[index] ?? []).map((pack) => pack.id),
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Personagens"
        title="Novo personagem"
        description="Um passo a passo com as regras de D&D 5e (SRD 5.2.1 e os livros liberados pelo mestre): cada escolha mostra só as opções válidas para o personagem."
      />
      <Card ornate>
        <Dnd5eCreationWizard
          campaigns={playable}
          books={books}
          personalPackIds={ownPacks.map((pack) => pack.id)}
          defaultCampaignId={playable.some((campaign) => campaign.id === preselected) ? preselected : ''}
          storageKey={`codexveil:criacao-dnd5e:${user.id}`}
        />
      </Card>
    </div>
  );
}
