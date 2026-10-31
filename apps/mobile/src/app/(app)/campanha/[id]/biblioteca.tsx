import { getCampaign, listCampaignItems, listCreatures, signedMediaUrls } from '@codexveil/database';
import { itemCategoryLabels } from '@codexveil/domain';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { ListRow } from '@/components/ui/list-row';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, palette } from '@/lib/theme';

type Tab = 'npc' | 'monster' | 'items';

/** Biblioteca para consulta durante o jogo: o que o mestre revelou (o cadastro fica no site). */
export default function LibraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('npc');

  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const [creatures, items] = await Promise.all([
      listCreatures(supabase, campaign.id),
      listCampaignItems(supabase, campaign.id),
    ]);
    const images = await signedMediaUrls(
      supabase,
      creatures.map((creature) => creature.imagePath),
    );
    return { campaign, creatures, items, images };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState
          title="Campanha não encontrada"
          description="Ela não existe ou você não participa dela."
        />
      </Screen>
    );
  }
  const { campaign, creatures, items, images } = data;
  const shown = creatures.filter((creature) => creature.kind === tab);

  return (
    <Screen eyebrow={campaign.name} title="Biblioteca" refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: 'Biblioteca' }} />
      <Segmented
        value={tab}
        options={[
          { value: 'npc', label: 'NPCs' },
          { value: 'monster', label: 'Monstros' },
          { value: 'items', label: 'Itens' },
        ]}
        onChange={setTab}
        accessibilityLabel="Seções da biblioteca"
      />
      <AppText variant="muted">
        O que o mestre já revelou ao grupo. Cadastro e revelação ficam no site.
      </AppText>
      {tab === 'items' ? (
        items.length === 0 ? (
          <EmptyState
            title="Nada revelado ainda"
            description="Quando o mestre revelar itens, eles aparecerão aqui."
          />
        ) : (
          items.map((item) => (
            <ListRow
              key={item.id}
              title={item.name}
              subtitle={[
                itemCategoryLabels[item.category],
                item.rarity,
                item.requiresAttunement ? 'sintonia' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() =>
                router.push({
                  pathname: '/campanha/[id]/item/[itemId]',
                  params: { id: campaign.id, itemId: item.id },
                })
              }
            />
          ))
        )
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nada revelado ainda"
          description="Quando o mestre revelar NPCs ou criaturas, eles aparecerão aqui."
        />
      ) : (
        shown.map((creature) => (
          <ListRow
            key={creature.id}
            leading={
              creature.imagePath && images[creature.imagePath] ? (
                <Image
                  source={{ uri: images[creature.imagePath] }}
                  accessibilityIgnoresInvertColors
                  style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: palette.wine[900] }}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.wine[900],
                  }}
                >
                  <AppText style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.fgAccent }}>
                    {creature.name.trim().charAt(0).toUpperCase() || '?'}
                  </AppText>
                </View>
              )
            }
            title={creature.name}
            subtitle={creature.subtitle || undefined}
            onPress={() =>
              router.push({
                pathname: '/campanha/[id]/criatura/[creatureId]',
                params: { id: campaign.id, creatureId: creature.id },
              })
            }
          />
        ))
      )}
    </Screen>
  );
}
