import {
  getCampaign,
  getOpenEncounter,
  listCampaignCharacters,
  listCreatureStats,
  listCreatures,
  listSceneEntities,
  listSessions,
  pickCurrentSession,
  sessionStatusLabels,
} from '@codexveil/database';
import { findSystem } from '@codexveil/rpg-systems';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Dices, Pencil, ScrollText } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { DicePanel, DiceProvider } from '@/components/dice/dice';
import { RollFeed } from '@/components/dice/roll-feed';
import { PartyPanel, ScenePanel, TurnPanel, type GmContext, type LibraryOption } from '@/components/gm/gm-panels';
import { Button } from '@/components/ui/button';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { formatSessionDate } from '@/lib/dates';
import { failureMessage } from '@/lib/errors';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

/** Mesa do mestre no app: turnos, grupo, cena e rolagens da sessão atual, ao vivo. */
export default function GmTableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [showDice, setShowDice] = useState(false);

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign || campaign.role !== 'gm') return { campaign, session: null } as const;
    const [sessions, party, creatures] = await Promise.all([listSessions(supabase, campaign.id), listCampaignCharacters(supabase, campaign.id), listCreatures(supabase, campaign.id)]);
    const session = pickCurrentSession(sessions);
    if (!session) return { campaign, session: null } as const;
    const [entities, encounter, stats] = await Promise.all([
      listSceneEntities(supabase, session.id),
      getOpenEncounter(supabase, session.id),
      listCreatureStats(supabase, creatures.map((creature) => creature.id)),
    ]);
    const system = findSystem(campaign.systemId);
    const library: LibraryOption[] = creatures.map((creature) => {
      let defaults = { hitPoints: null as number | null, armorClass: null as number | null, initiativeBonus: 0 };
      if (system) {
        try {
          defaults = system.combatDefaults(system.parseStatBlock(stats[creature.id] ?? {}));
        } catch {
          // Estatísticas fora do formato: a instância começa sem valores.
        }
      }
      return { id: creature.id, name: creature.name, kind: creature.kind, ...defaults };
    });
    return { campaign, session, party, entities, encounter, library } as const;
  }, `${id}:${userId}`);

  const sessionId = data?.session?.id ?? 'nenhuma';
  useRealtimeRefresh(
    `mesa-app:${sessionId}`,
    [
      { table: 'characters', filter: `campaign_id=eq.${id}` },
      { table: 'character_resources' },
      { table: 'character_conditions' },
      { table: 'session_entities', filter: `session_id=eq.${sessionId}` },
      { table: 'encounters', filter: `session_id=eq.${sessionId}` },
      { table: 'encounter_combatants', filter: `campaign_id=eq.${id}` },
    ],
    () => reload(),
  );

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.campaign || data.campaign.role !== 'gm') {
    return (
      <Screen>
        <EmptyState title="Sem acesso" description="A mesa do mestre é exclusiva dos mestres da campanha." />
      </Screen>
    );
  }
  const { campaign } = data;
  if (!data.session) {
    return (
      <Screen eyebrow={campaign.name} title="Mesa do mestre">
        <Stack.Screen options={{ title: 'Mesa do mestre' }} />
        <EmptyState title="Nenhuma sessão planejada" description="A mesa acompanha a sessão em andamento ou a próxima planejada." />
        {campaign.status === 'active' ? <Button label="Nova sessão" onPress={() => router.push({ pathname: '/campanha/[id]/nova-sessao', params: { id: campaign.id } })} /> : null}
      </Screen>
    );
  }
  const { session, party, entities, encounter, library } = data;

  const context: GmContext = {
    campaignId: campaign.id,
    systemId: campaign.systemId,
    session: { id: session.id, number: session.number },
    canManage: campaign.status === 'active',
    party,
    entities,
    encounter,
    turnSettings: campaign.turnSettings,
    run: async (title, action) => {
      try {
        await action();
      } catch (cause) {
        toast({ tone: 'danger', title, description: failureMessage(cause) });
      } finally {
        reload();
      }
    },
    notify: (title) => toast({ tone: 'info', title }),
  };

  return (
    <Screen eyebrow={campaign.name} title={`Sessão ${session.number}: ${session.title}`} subtitle={formatSessionDate(session.scheduledAt)} refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Mesa do mestre' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' }}>
        <Badge label={sessionStatusLabels[session.status]} tone={session.status === 'in_progress' ? 'brand' : 'parchment'} />
        <Button label="Roteiro" compact variant="secondary" icon={<ScrollText size={14} color={colors.fg} />} onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: session.id } })} />
        {campaign.status === 'active' ? (
          <Button label="Editar" compact variant="ghost" icon={<Pencil size={14} color={colors.fgSecondary} />} onPress={() => router.push({ pathname: '/sessao/[id]/editar', params: { id: session.id } })} />
        ) : null}
      </View>
      <TurnPanel context={context} />
      <PartyPanel context={context} />
      <ScenePanel context={context} library={library} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Dices size={18} color={colors.fgAccent} />
          <AppText variant="heading" style={{ flex: 1 }}>
            Mural de rolagens
          </AppText>
          {campaign.status === 'active' ? <Button label={showDice ? 'Fechar' : 'Rolar'} compact variant="ghost" onPress={() => setShowDice((value) => !value)} /> : null}
        </View>
        {showDice ? (
          <DiceProvider campaignId={campaign.id}>
            <DicePanel isGm />
          </DiceProvider>
        ) : null}
        <RollFeed campaignId={campaign.id} canClear={campaign.status === 'active'} limit={30} />
      </Card>
    </Screen>
  );
}
