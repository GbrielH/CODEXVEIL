import {
  characterAccessInput,
  getCharacter,
  listCharacterAbilities,
  listCharacterConditions,
  listCharacterItems,
  listCharacterResources,
  signedMediaUrls,
} from '@codexveil/database';
import { canEditCharacterPlayState, canEditCharacterSheet } from '@codexveil/domain';
import { parseDnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/sheet/sheet-screen';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { data, error, loading, reload } = useAsyncData(async () => {
    const supabase = getSupabase();
    const character = await getCharacter(supabase, id, userId);
    if (!character) return null;
    const [resources, conditions, items, abilities] = await Promise.all([
      listCharacterResources(supabase, character.id),
      listCharacterConditions(supabase, character.id),
      listCharacterItems(supabase, character.id),
      listCharacterAbilities(supabase, character.id),
    ]);
    const images = await signedMediaUrls(supabase, [character.portraitPath]);
    return { character, resources, conditions, items, abilities, portraitUrl: character.portraitPath ? (images[character.portraitPath] ?? null) : null };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState label="Abrindo a ficha…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Ficha não encontrada" description="Ela não existe ou você não tem acesso a ela." />
      </Screen>
    );
  }
  if (data.character.systemId !== 'dnd5e') {
    return (
      <Screen>
        <EmptyState title="Sistema não suportado" description="Esta versão do app ainda não tem fichas para este sistema." />
      </Screen>
    );
  }

  let sheet;
  try {
    sheet = parseDnd5eSheet(data.character.sheet);
  } catch {
    return <ErrorState message="Os dados desta ficha não seguem o formato esperado. Nada foi alterado." />;
  }

  const access = characterAccessInput(data.character);
  return (
    <>
      <Stack.Screen options={{ title: data.character.name }} />
      <SheetScreen
        key={data.character.id}
        character={data.character}
        sheet={sheet}
        resources={data.resources}
        conditions={data.conditions}
        items={data.items}
        abilities={data.abilities}
        canEditSheet={canEditCharacterSheet(access)}
        canEditPlay={canEditCharacterPlayState(access)}
        fullConditionList={data.character.viewer.membership?.role === 'gm' || data.character.campaign === null}
        portraitUrl={data.portraitUrl}
        onReload={reload}
      />
    </>
  );
}
