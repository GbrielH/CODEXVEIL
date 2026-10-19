import { creatureImagePath, getCampaign, getCreature, setCreatureImage, signedMediaUrls } from '@codexveil/database';
import { parseDnd5eStatBlock, type Dnd5eStatBlock } from '@codexveil/rpg-systems/dnd5e';
import { creatureKindLabels } from '@codexveil/validation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'react-native';
import { StatBlockView } from '@/components/library/stat-block';
import { ImageUploadButtons } from '@/components/ui/image-upload';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { radii } from '@/lib/theme';

/** NPC ou monstro revelado, para consulta durante o jogo; o mestre também troca a imagem aqui. */
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
      {/* Só o mestre envia a imagem (o Storage e o RLS conferem); jogadores a veem quando o registro é revelado. */}
      {campaign.role === 'gm' && campaign.status === 'active' ? (
        <Card>
          <AppText variant="eyebrow">Imagem</AppText>
          <AppText variant="small">Os jogadores veem a imagem quando o registro é revelado.</AppText>
          <ImageUploadButtons
            preset="creature"
            label={creature.imagePath ? 'Trocar imagem' : 'Enviar imagem'}
            currentPath={creature.imagePath}
            pathFor={(fileName) => creatureImagePath(campaign.id, fileName)}
            apply={(path) => setCreatureImage(getSupabase(), creature.id, path)}
            onDone={() => void reload()}
          />
        </Card>
      ) : null}
      {creature.description ? <AppText variant="serif">{creature.description}</AppText> : null}
      {statBlock ? <StatBlockView name={creature.name} statBlock={statBlock} /> : null}
    </Screen>
  );
}
