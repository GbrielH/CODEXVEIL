import { createCampaignItem, getCampaign } from '@codexveil/database';
import { describeSrdMagicItem, loadSrdMagicItems, srdMagicItemToCampaignItem, srdSlug } from '@codexveil/rpg-systems/dnd5e';
import { campaignItemSchema } from '@codexveil/validation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, radii, spacing } from '@/lib/theme';

/** Item mágico do SRD com a opção de copiar para os itens da campanha. */
export default function SrdItemScreen() {
  const { id, slug } = useLocalSearchParams<{ id: string; slug: string }>();
  const userId = useUserId();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsyncData(async () => {
    const [campaign, items] = await Promise.all([getCampaign(getSupabase(), id, userId), loadSrdMagicItems()]);
    const item = items.find((entry) => srdSlug(entry.name) === slug) ?? null;
    return campaign && item ? { campaign, item } : null;
  }, `${id}:${slug}:${userId}`);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Item não encontrado" description="Volte à lista e escolha outro." />
      </Screen>
    );
  }
  const { campaign, item } = data;
  const canManage = campaign.role === 'gm' && campaign.status === 'active';

  const copy = async () => {
    setBusy(true);
    try {
      const itemId = await createCampaignItem(getSupabase(), campaign.id, campaignItemSchema.parse(srdMagicItemToCampaignItem(item)), { srdName: item.name });
      toast({ tone: 'success', title: `${item.name} está nos itens da campanha (oculto dos jogadores).` });
      router.replace({ pathname: '/campanha/[id]/item/[itemId]', params: { id: campaign.id, itemId } });
    } catch (cause) {
      toast({ tone: 'danger', title: 'O item não foi copiado', description: failureMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen eyebrow="SRD 5.2.1" title={item.name} subtitle={describeSrdMagicItem(item)}>
      <Stack.Screen options={{ title: item.name }} />
      {canManage ? (
        <Card ornate>
          <AppText variant="muted">Copia o item para a biblioteca de itens, oculto dos jogadores. Depois é só entregá-lo.</AppText>
          <Button label="Copiar para os itens da campanha" loading={busy} icon={<Copy size={16} color={colors.primaryFg} />} onPress={() => void copy()} />
        </Card>
      ) : null}
      <View style={styles.parchment}>
        {item.description.map((paragraph) => (
          <AppText key={paragraph} style={styles.ink}>
            {paragraph}
          </AppText>
        ))}
      </View>
      <AppText variant="small" style={{ color: colors.fgMuted }}>
        System Reference Document 5.2.1 (Wizards of the Coast, CC-BY-4.0), texto original em inglês.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  parchment: { gap: spacing[2], padding: spacing[4], borderRadius: radii.lg, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.parchmentEdge },
  ink: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17, lineHeight: 25 },
});

