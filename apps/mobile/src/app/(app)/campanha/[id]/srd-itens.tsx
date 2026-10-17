import { describeSrdMagicItem, loadSrdMagicItems, srdMagicItemCategories, srdSlug, type SrdMagicItem } from '@codexveil/rpg-systems/dnd5e';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { ListRow } from '@/components/ui/list-row';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

const PAGE = 40;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Itens mágicos do SRD 5.2.1 para o mestre copiar aos itens da campanha. */
export default function SrdItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [shown, setShown] = useState(PAGE);
  const { data, error, loading, reload } = useAsyncData(() => loadSrdMagicItems(), 'srd-items');

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return (data ?? []).filter(
      (item: SrdMagicItem) => (!term || normalize(`${item.name} ${describeSrdMagicItem(item)}`).includes(term)) && (!category || item.category === category),
    );
  }, [data, query, category]);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen eyebrow="SRD 5.2.1" title="Itens mágicos">
      <Stack.Screen options={{ title: 'Itens mágicos SRD' }} />
      <View style={styles.search}>
        <Search size={16} color={colors.fgSubtle} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setShown(PAGE);
          }}
          placeholder="Nome (em inglês) ou raridade"
          placeholderTextColor={colors.fgSubtle}
          selectionColor={palette.wine[400]}
          accessibilityLabel="Buscar item"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label="Todas" selected={category === ''} onPress={() => setCategory('')} />
        {srdMagicItemCategories.map((entry) => (
          <Chip key={entry.value} label={entry.label} selected={category === entry.value} onPress={() => setCategory(entry.value)} />
        ))}
      </ScrollView>
      <AppText variant="small" accessibilityLiveRegion="polite">
        {filtered.length} de {data?.length ?? 0} itens
      </AppText>
      {filtered.slice(0, shown).map((item) => (
        <ListRow
          key={item.name}
          title={item.name}
          subtitle={describeSrdMagicItem(item)}
          onPress={() => router.push({ pathname: '/campanha/[id]/srd-item/[slug]', params: { id, slug: srdSlug(item.name) } })}
        />
      ))}
      {filtered.length > shown ? <Button label={`Mostrar mais (${filtered.length - shown})`} variant="secondary" onPress={() => setShown((current) => current + PAGE)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.sunken,
  },
  input: { flex: 1, height: 44, color: colors.fg, fontFamily: fonts.sans, fontSize: 16 },
});
