import { getCampaign, listCampaignHandouts, signedMediaUrls } from '@codexveil/database';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollText } from 'lucide-react-native';
import { Image, View } from 'react-native';
import { AppText, Badge, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData, useRealtimeRefresh } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, radii } from '@/lib/theme';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

/** Revelações do mestre: cartas, pistas e imagens entregues fora do roteiro. Atualiza ao vivo. */
export default function HandoutsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    // O jogador só recebe o que já foi revelado para ele; o mestre vê também as preparadas.
    const handouts = (await listCampaignHandouts(supabase, campaign.id)).filter((handout) => handout.isRevealed);
    const images = await signedMediaUrls(
      supabase,
      handouts.map((handout) => handout.imagePath),
    );
    return { campaign, handouts, images };
  }, `${id}:${userId}`);

  useRealtimeRefresh(`revelacoes-app:${id}`, [{ table: 'campaign_handouts', filter: `campaign_id=eq.${id}` }], reload);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Campanha não encontrada" description="Ela não existe ou você não participa dela." />
      </Screen>
    );
  }
  const { campaign, handouts, images } = data;

  return (
    <Screen eyebrow={campaign.name} title="Revelações" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Revelações' }} />
      {handouts.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={28} color={colors.fgSecondary} />}
          title="Nada revelado ainda"
          description="Quando o mestre revelar uma carta, pista ou imagem, ela aparece aqui na hora."
        />
      ) : null}
      {handouts.map((handout) => {
        const imageUrl = handout.imagePath ? images[handout.imagePath] : undefined;
        return (
          <Card key={handout.id} ornate>
            <View style={{ gap: 4 }}>
              <AppText variant="heading">{handout.title}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {handout.audience === 'characters' ? <Badge label="Só para você" tone="brand" /> : null}
                {handout.revealedAt ? <AppText variant="small">{dateFormat.format(new Date(handout.revealedAt))}</AppText> : null}
              </View>
            </View>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                accessibilityLabel={handout.title}
                style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radii.lg, backgroundColor: colors.sunken }}
                resizeMode="contain"
              />
            ) : null}
            {handout.body ? <AppText variant="serif">{handout.body}</AppText> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
