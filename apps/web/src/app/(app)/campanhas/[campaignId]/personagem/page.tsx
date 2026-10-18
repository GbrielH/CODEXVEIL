import { listCampaignCharacters } from '@codexveil/database';
import { UserPlus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import { CharacterSheet } from '@/components/sheets/character-sheet';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ForbiddenState } from '@/components/ui/states';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Meu personagem' };

/** Ficha de mesa do jogador nesta campanha: turno, ações, atributos, habilidades e inventário. */
export default async function MyCharacterPage({ params }: PageProps<'/campanhas/[campaignId]/personagem'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  if (campaign.role === 'gm') {
    return <ForbiddenState description="Mestres conduzem a mesa pelos NPCs e monstros; a ficha de mesa é dos jogadores." />;
  }
  const supabase = await createSupabaseServerClient();
  const own = (await listCampaignCharacters(supabase, campaign.id)).find((character) => character.ownerId === user.id);
  if (!own) {
    return (
      <EmptyState
        icon={<UserPlus className="h-8 w-8" aria-hidden="true" />}
        title="Você ainda não tem personagem nesta campanha"
        description="Cada jogador joga com um personagem por campanha. Crie o seu seguindo as regras do mestre."
        action={
          campaign.status === 'active' ? (
            <ButtonLink href={`${routes.newCharacter}?campanha=${campaign.id}` as Route}>Criar personagem</ButtonLink>
          ) : undefined
        }
      />
    );
  }
  return <CharacterSheet characterId={own.id} variant="campaign" />;
}
