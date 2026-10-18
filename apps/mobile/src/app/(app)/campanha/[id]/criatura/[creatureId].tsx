import { getCampaign, getCreature, signedMediaUrls } from '@codexveil/database';
import { parseDnd5eStatBlock, type Dnd5eStatBlock } from '@codexveil/rpg-systems/dnd5e';
import { creatureKindLabels } from '@codexveil/validation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'react-native';
import { StatBlockView } from '@/components/library/stat-block';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { radii } from '@/lib/theme';

/** NPC ou monstro revelado, para consulta durante o jogo. */
export default function CreatureScreen() {
  const { id, creatureId } = useLocalSearchParams<{ id: string; creatureId: string }>();
  const userId = useUserId();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const creature = await getCreature(supabase, creatureId, campaign.role === 'gm');
    if (!creature || creature.campaignId !== campaign.id) return null;
    const images = await signedMediaUrls(supabase, [creature.imagePath]);
    return { campaign, creature, imageUrl: creature.imagePath ? (images[creature.imagePath] ?? null) : null };
  }, `${id}:${creatureId}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Registro não encontrado" description="Ele não existe ou ainda não foi revelado." />
      </Screen>
    );
  }
  const { campaign, creature, imageUrl } = data;
  let statBlock: Dnd5eStatBlock | null = null;
  if (creature.gm && campaign.systemId === 'dnd5e') {
    try {
      statBlock = parseDnd5eStatBlock(creature.gm.stats);
    } catch {
      statBlock = null;
    }
  }

  return (
    <Screen eyebrow={creatureKindLabels[creature.kind]} title={creature.name} subtitle={creature.subtitle || undefined} refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: creature.name }} />
      {imageUrl ? <Image source={{ uri: imageUrl }} accessibilityLabel={`Imagem de ${creature.name}`} style={{ width: '100%', aspectRatio: 1, borderRadius: radii.lg }} resizeMode="cover" /> : null}
      {creature.description ? <AppText variant="serif">{creature.description}</AppText> : null}
      {statBlock ? <StatBlockView name={creature.name} statBlock={statBlock} /> : null}
    </Screen>
  );
}
