import { getCampaign, listCampaignCharacters } from '@codexveil/database';
import { Stack, useLocalSearchParams } from 'expo-router';
import { DicePanel, DiceProvider } from '@/components/dice/dice';
import { RollFeed } from '@/components/dice/roll-feed';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

/** Rolagens da campanha: rola no servidor e mostra o mural da mesa, ao vivo. */
export default function CampaignDiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { data, error, loading, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const party = await listCampaignCharacters(supabase, campaign.id);
    return { campaign, own: party.find((character) => character.ownerId === userId) ?? null };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Campanha não encontrada" description="Ela não existe ou você não participa dela." />
      </Screen>
    );
  }
  const { campaign, own } = data;
  const isGm = campaign.role === 'gm';
  const ownCharacter = isGm ? null : own;

  return (
    <Screen eyebrow={campaign.name} title="Dados">
      <Stack.Screen options={{ title: 'Dados' }} />
      {campaign.status === 'active' ? (
        <Card ornate>
          <AppText variant="muted">
            {isGm ? 'Os jogadores veem as rolagens abertas; as secretas ficam só com os mestres.' : 'O resultado aparece no mural da mesa.'}
          </AppText>
          <DiceProvider campaignId={campaign.id} characterId={ownCharacter?.id ?? null}>
            <DicePanel isGm={isGm} characterName={ownCharacter?.name ?? null} />
          </DiceProvider>
        </Card>
      ) : null}
      <Card>
        <AppText variant="heading">Mural de rolagens</AppText>
        <RollFeed campaignId={campaign.id} canClear={isGm && campaign.status === 'active'} />
      </Card>
    </Screen>
  );
}
