import { getCampaign, getCampaignItem } from '@codexveil/database';
import { itemCategoryLabels } from '@codexveil/domain';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AppText, Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

/** Item revelado pelo mestre, para consulta. */
export default function ItemScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const userId = useUserId();
  const { data, error, loading, refreshing, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const campaign = await getCampaign(supabase, id, userId);
    if (!campaign) return null;
    const item = await getCampaignItem(supabase, itemId);
    return item && item.campaignId === campaign.id ? item : null;
  }, `${id}:${itemId}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState
          title="Item não encontrado"
          description="Ele não existe ou ainda não foi revelado."
        />
      </Screen>
    );
  }
  const item = data;
  return (
    <Screen
      eyebrow={itemCategoryLabels[item.category]}
      title={item.name}
      subtitle={
        [item.rarity, item.value ? `Valor: ${item.value}` : null].filter(Boolean).join(' · ') ||
        undefined
      }
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Stack.Screen options={{ title: item.name }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {item.requiresAttunement ? <Badge label="Exige sintonia" tone="brand" /> : null}
        {item.srdName ? <Badge label="SRD 5.2.1" tone="parchment" /> : null}
      </View>
      {item.description ? (
        <AppText variant="serif">{item.description}</AppText>
      ) : (
        <AppText variant="muted">Sem descrição.</AppText>
      )}
    </Screen>
  );
}
