import { CHALLENGE_RATINGS, describeSrdMonster, loadSrdMonsters, srdCreatureTypes, srdSlug, type SrdMonster } from '@codexveil/rpg-systems/dnd5e';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/controls';
import { ListRow } from '@/components/ui/list-row';
import { PickerField } from '@/components/ui/picker';
import { AppText } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { colors, fonts, palette, radii, spacing } from '@/lib/theme';

const PAGE = 40;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Bestiário do SRD 5.2.1: o mestre escolhe um monstro para copiar à biblioteca. */
export default function SrdBestiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [challenge, setChallenge] = useState('');
  const [shown, setShown] = useState(PAGE);
  const { data, error, loading, reload } = useAsyncData(() => loadSrdMonsters(), 'srd-monsters');

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return (data ?? []).filter(
      (monster: SrdMonster) =>
        (!term || normalize(`${monster.name} ${describeSrdMonster(monster)}`).includes(term)) && (!type || monster.type === type) && (!challenge || monster.cr === challenge),
    );
  }, [data, query, type, challenge]);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen eyebrow="SRD 5.2.1" title="Bestiário">
      <Stack.Screen options={{ title: 'Bestiário SRD' }} />
      <View style={styles.search}>
        <Search size={16} color={colors.fgSubtle} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setShown(PAGE);
          }}
          placeholder="Nome (em inglês) ou tipo"
          placeholderTextColor={colors.fgSubtle}
          selectionColor={palette.wine[400]}
          accessibilityLabel="Buscar criatura"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label="Todos" selected={type === ''} onPress={() => setType('')} />
        {srdCreatureTypes.map((entry) => (
          <Chip key={entry.value} label={entry.label} selected={type === entry.value} onPress={() => setType(entry.value)} />
        ))}
      </ScrollView>
      <PickerField
        label="Nível de desafio"
        value={challenge}
        options={[{ value: '', label: 'Todos' }, ...CHALLENGE_RATINGS.map((rating) => ({ value: rating, label: `ND ${rating}` }))]}
        onChange={(next) => {
          setChallenge(next);
          setShown(PAGE);
        }}
      />
      <AppText variant="small" accessibilityLiveRegion="polite">
        {filtered.length} de {data?.length ?? 0} criaturas
      </AppText>
      {filtered.slice(0, shown).map((monster) => (
        <ListRow
          key={monster.name}
          title={monster.name}
          subtitle={describeSrdMonster(monster)}
          meta={`CA ${monster.ac} · PV ${monster.hp}${monster.animal ? ' · Animal' : ''}`}
          onPress={() => router.push({ pathname: '/campanha/[id]/srd-monstro/[slug]', params: { id, slug: srdSlug(monster.name) } })}
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
