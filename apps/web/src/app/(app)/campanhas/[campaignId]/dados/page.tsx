import { isSessionInProgress, listCampaignCharacters, listDiceRolls } from '@codexveil/database';
import { Dices, ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import { DicePanel, DiceProvider } from '@/components/dice/dice-roller';
import { RollFeed } from '@/components/dice/roll-feed';
import { Alert } from '@/components/ui/alert';
import { Card, CardHeader } from '@/components/ui/card';
import { loadCampaignOrNotFound } from '@/lib/campaigns';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dados' };

/** Rolagens da campanha: o dado é rolado no servidor e aparece no mural de todos (e do mestre). */
export default async function DicePage({ params }: PageProps<'/campanhas/[campaignId]/dados'>) {
  const { campaignId } = await params;
  const { user, campaign } = await loadCampaignOrNotFound(campaignId);
  const supabase = await createSupabaseServerClient();
  const [rolls, party, playing] = await Promise.all([
    listDiceRolls(supabase, campaign.id),
    listCampaignCharacters(supabase, campaign.id),
    isSessionInProgress(supabase, campaign.id),
  ]);
  const isGm = campaign.role === 'gm';
  const ownCharacter = isGm ? null : (party.find((character) => character.ownerId === user.id) ?? null);
  const canRoll = campaign.status === 'active';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      {canRoll ? (
        <Card ornate>
          <CardHeader
            icon={<Dices className="h-5 w-5" aria-hidden="true" />}
            title="Rolar dados"
            description={
              isGm
                ? 'Os jogadores veem as rolagens abertas; as secretas ficam só com os mestres.'
                : 'O resultado aparece no mural da mesa. Marque “Só para o mestre” para uma rolagem escondida.'
            }
          />
          {isGm || playing ? (
            <DiceProvider campaignId={campaign.id} characterId={ownCharacter?.id ?? null}>
              <DicePanel isGm={isGm} characterName={ownCharacter?.name ?? null} />
            </DiceProvider>
          ) : (
            <Alert tone="warning" title="A sessão ainda não começou">
              As rolagens da mesa ficam liberadas quando o mestre iniciar a sessão. Para testar, role na ficha do personagem: lá os
              dados são locais e não vão para o mural. Atualize a página quando a sessão começar.
            </Alert>
          )}
        </Card>
      ) : null}
      <Card>
        <CardHeader
          icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
          title="Mural de rolagens"
          description={isGm ? 'Todas as rolagens da campanha, inclusive as secretas.' : 'Rolagens abertas da mesa e as suas.'}
        />
        <RollFeed campaignId={campaign.id} initialRolls={rolls} canClear={isGm && campaign.status === 'active'} />
      </Card>
    </div>
  );
}
