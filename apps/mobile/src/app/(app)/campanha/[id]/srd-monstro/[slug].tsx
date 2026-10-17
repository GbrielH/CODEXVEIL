import { createCreature, getCampaign, updateCreatureGmData } from '@codexveil/database';
import { describeSrdMonster, loadSrdMonsters, srdMonsterDefaultKind, srdMonsterToStatBlock, srdSlug } from '@codexveil/rpg-systems/dnd5e';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { StatBlockView } from '@/components/library/stat-block';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/controls';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/** Monstro do SRD com a opção de copiar para a biblioteca da campanha. */
export default function SrdMonsterScreen() {
  const { id, slug } = useLocalSearchParams<{ id: string; slug: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<'npc' | 'monster' | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsyncData(async () => {
    const [campaign, monsters] = await Promise.all([getCampaign(getSupabase(), id, userId), loadSrdMonsters()]);
    const monster = monsters.find((entry) => srdSlug(entry.name) === slug) ?? null;
    return campaign && monster ? { campaign, monster } : null;
  }, `${id}:${slug}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Criatura não encontrada" description="Volte ao bestiário e escolha outra." />
      </Screen>
    );
  }
  const { campaign, monster } = data;
  const statBlock = srdMonsterToStatBlock(monster);
  const chosenKind = kind ?? srdMonsterDefaultKind(monster);
  const canManage = campaign.role === 'gm' && campaign.status === 'active';

  const copy = async () => {
    setBusy(true);
    try {
      const supabase = getSupabase();
      const creatureId = await createCreature(supabase, campaign.id, { kind: chosenKind, name: monster.name.slice(0, 80), subtitle: 'SRD 5.2.1', description: '', visibility: 'gm' });
      await updateCreatureGmData(supabase, creatureId, {
        stats: statBlock,
        notes: 'Copiado do SRD 5.2.1 (CC-BY-4.0). Ações e traços com o texto original, em inglês.',
        secrets: '',
      });
      toast({ tone: 'success', title: `${monster.name} está na biblioteca (oculto dos jogadores).` });
      router.replace({ pathname: '/campanha/[id]/criatura/[creatureId]', params: { id: campaign.id, creatureId } });
    } catch (cause) {
      toast({ tone: 'danger', title: 'A criatura não foi copiada', description: failureMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen eyebrow={`SRD 5.2.1${monster.animal ? ' · Animal' : ''}`} title={monster.name} subtitle={describeSrdMonster(monster)}>
      <Stack.Screen options={{ title: monster.name }} />
      {canManage ? (
        <Card ornate>
          <AppText variant="heading">Copiar para a biblioteca</AppText>
          <ChipRow>
            <Chip label="Monstro" selected={chosenKind === 'monster'} onPress={() => setKind('monster')} />
            <Chip label="NPC" selected={chosenKind === 'npc'} onPress={() => setKind('npc')} />
          </ChipRow>
          <Button label="Copiar" loading={busy} icon={<Copy size={16} color={colors.primaryFg} />} onPress={() => void copy()} />
        </Card>
      ) : null}
      <StatBlockView name={monster.name} statBlock={statBlock} />
      <AppText variant="small">
        Iniciativa {monster.initiative}
        {monster.gear ? ` · Equipamento: ${monster.gear}` : ''}
      </AppText>
      <AppText variant="small" style={{ color: colors.fgMuted }}>
        System Reference Document 5.2.1 (Wizards of the Coast, CC-BY-4.0). Campos técnicos traduzidos e distâncias em metros pelo Codexveil; ações e traços
        no original, em inglês.
      </AppText>
    </Screen>
  );
}
