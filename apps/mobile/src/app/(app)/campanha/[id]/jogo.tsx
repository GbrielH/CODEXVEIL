import { getCampaign, getSessionState, listCampaignCharacters } from '@codexveil/database';
import { characterSkillBonuses, conditionLabel, summarizeSheet } from '@codexveil/rpg-systems';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Dices, Map as MapIcon, UserRound } from 'lucide-react-native';
import { View } from 'react-native';
import { TurnStatus } from '@/components/campaign/turn-status';
import { DicePanel, DiceProvider } from '@/components/dice/dice';
import { RollFeed } from '@/components/dice/roll-feed';
import { Button } from '@/components/ui/button';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/** Central de jogo do app: somente a visão e as ações do jogador. */
export default function CampaignGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const client = getSupabase();
    const campaign = await getCampaign(client, id, userId);
    if (!campaign || campaign.role === 'gm') return null;
    const [party, session] = await Promise.all([
      listCampaignCharacters(client, campaign.id),
      getSessionState(client, campaign.id),
    ]);
    return { campaign, session, own: party.find((entry) => entry.ownerId === userId) ?? null };
  }, `${id}:${userId}`);
  useRealtimeRefresh(
    `jogo-app:${id}`,
    [
      { table: 'sessions', filter: `campaign_id=eq.${id}` },
      { table: 'character_resources' },
      { table: 'character_conditions' },
    ],
    reload,
  );

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data)
    return (
      <Screen>
        <EmptyState
          title="Jogo indisponível"
          description="Esta tela é exclusiva dos jogadores da campanha."
        />
      </Screen>
    );
  const { campaign, session, own } = data;

  return (
    <Screen eyebrow={campaign.name} title="Jogo" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Jogo' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          label="Mapa"
          compact
          icon={<MapIcon size={16} color={colors.fg} />}
          onPress={() => router.push({ pathname: '/campanha/[id]/mapa', params: { id } })}
        />
        {own ? (
          <Button
            label="Ficha"
            compact
            variant="secondary"
            icon={<UserRound size={16} color={colors.fg} />}
            onPress={() => router.push(`/personagem/${own.id}`)}
          />
        ) : null}
      </View>
      <TurnStatus
        campaignId={campaign.id}
        ownCharacterId={own?.id ?? null}
        systemId={campaign.systemId}
      />
      {own ? (
        <Card>
          <AppText variant="heading">{own.name}</AppText>
          <AppText variant="muted">{summarizeSheet(campaign.systemId, own.sheet).subtitle}</AppText>
          {own.resources.map((resource) => (
            <AppText key={resource.id}>
              {resource.label}: {resource.current}
              {resource.temp ? ` + ${resource.temp}` : ''}
              {resource.max === null ? '' : ` / ${resource.max}`}
            </AppText>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {own.conditions.map((condition) => (
              <Badge
                key={condition.id}
                label={conditionLabel(campaign.systemId, condition.key, condition.level)}
                tone="warning"
              />
            ))}
          </View>
        </Card>
      ) : null}
      <Card ornate>
        <AppText variant="heading">
          <Dices size={16} color={colors.fgAccent} /> Dados
        </AppText>
        {session.playing && !session.physicalDice ? (
          <DiceProvider campaignId={campaign.id} characterId={own?.id ?? null}>
            <DicePanel
              isGm={false}
              characterName={own?.name ?? null}
              skills={own ? characterSkillBonuses(campaign.systemId, own.sheet) : []}
            />
          </DiceProvider>
        ) : (
          <AppText variant="muted">
            {session.physicalDice
              ? 'Esta sessão usa dados presenciais.'
              : 'As rolagens abrem quando a sessão começar.'}
          </AppText>
        )}
      </Card>
      <Card>
        <AppText variant="heading">Mural de rolagens</AppText>
        <RollFeed campaignId={campaign.id} canClear={false} />
      </Card>
    </Screen>
  );
}
