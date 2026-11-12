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
import {
  buildDnd5eBookContent,
  parseDnd5eSheet,
  setActiveDnd5eBookContent,
} from '@codexveil/rpg-systems/dnd5e';
import { parseT20Sheet } from '@codexveil/rpg-systems/tormenta20';
import { parseAssimilacaoSheet } from '@codexveil/rpg-systems/assimilacao';
import { parseTriangleAgencySheet } from '@codexveil/rpg-systems/triangle-agency';
import { parseOrdem2Sheet } from '@codexveil/rpg-systems/ordem2';
import { AssimilacaoMobileSheet } from '@/components/assimilacao/sheet';
import { TriangleAgencyMobileSheet } from '@/components/triangle-agency/sheet';
import { Ordem2MobileSheet } from '@/components/ordem2/sheet';
import { ScrollView } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/sheet/sheet-screen';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { T20MobileSheet } from '@/components/t20/sheet';
import { sheetAssimilacaoSources, sheetBookSources, sheetT20Sources } from '@/lib/books';
import { useAsyncData } from '@/lib/hooks';
import { useUserId } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { GhostAura, isDown } from '@/components/ghost-aura';
import { CharacterExtras } from '@/components/characters/character-extras';

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
    // Livros para a subida de nível (subclasses, talentos e magias), como no site.
    const books =
      character.systemId === 'dnd5e' && canEditCharacterSheet(characterAccessInput(character))
        ? await sheetBookSources(supabase, userId, character)
        : [];
    // Tormenta20: também para quem só joga (os ataques usam as armas do livro).
    const t20Books =
      character.systemId === 'tormenta20' &&
      (canEditCharacterSheet(characterAccessInput(character)) ||
        canEditCharacterPlayState(characterAccessInput(character)))
        ? await sheetT20Sources(supabase, userId, character)
        : [];
    const assimBooks =
      character.systemId === 'assimilacao'
        ? await sheetAssimilacaoSources(supabase, userId, character)
        : [];
    return {
      assimBooks,
      character,
      resources,
      conditions,
      items,
      abilities,
      books,
      t20Books,
      portraitUrl: character.portraitPath ? (images[character.portraitPath] ?? null) : null,
    };
  }, `${id}:${userId}`);

  if (loading) return <LoadingState label="Abrindo a ficha…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return (
      <Screen>
        <EmptyState
          title="Ficha não encontrada"
          description="Ela não existe ou você não tem acesso a ela."
        />
      </Screen>
    );
  }
  if (data.character.systemId === 'assimilacao') {
    let assimSheet;
    try {
      assimSheet = parseAssimilacaoSheet(data.character.sheet);
    } catch {
      return (
        <ErrorState message="Os dados desta ficha não seguem o formato do Assimilação RPG. Nada foi alterado." />
      );
    }
    const access = characterAccessInput(data.character);
    return (
      <>
        <Stack.Screen options={{ title: data.character.name }} />
        <AssimilacaoMobileSheet
          key={data.character.id}
          character={{
            id: data.character.id,
            name: data.character.name,
            version: data.character.version,
          }}
          campaignId={data.character.campaign?.id ?? null}
          sheet={assimSheet}
          resources={data.resources}
          canEditSheet={canEditCharacterSheet(access)}
          canEditPlay={canEditCharacterPlayState(access)}
          sources={data.assimBooks}
          extras={
            <CharacterExtras
              characterId={data.character.id}
              campaignId={data.character.campaign?.id ?? null}
              isOwner={data.character.viewer.isOwner}
              imageInput={{
                system: 'Assimilação RPG (pós-apocalipse com mutações)',
                name: data.character.name,
                species: 'Humano Infectado',
                className: assimSheet.origins.occupation,
                age: assimSheet.identity.age,
                appearance: assimSheet.identity.appearance,
                personality: assimSheet.identity.personality,
                backstory: assimSheet.identity.backstory,
              }}
            />
          }
        />
        <GhostAura active={isDown(data.resources)} />
      </>
    );
  }
  if (data.character.systemId === 'ordem2') {
    let ordemSheet;
    try {
      ordemSheet = parseOrdem2Sheet(data.character.sheet);
    } catch {
      return (
        <ErrorState message="Os dados desta ficha não seguem o formato do Ordem Paranormal 2. Nada foi alterado." />
      );
    }
    const access = characterAccessInput(data.character);
    return (
      <>
        <Stack.Screen options={{ title: data.character.name }} />
        <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: spacing[4] }}>
          <Ordem2MobileSheet
            key={data.character.id}
            character={{ id: data.character.id, name: data.character.name, version: data.character.version }}
            campaignId={data.character.campaign?.id ?? null}
            sheet={ordemSheet}
            resources={data.resources}
            canEditSheet={canEditCharacterSheet(access)}
            canEditPlay={canEditCharacterPlayState(access)}
          />
        </ScrollView>
        <GhostAura active={isDown(data.resources)} />
      </>
    );
  }
  if (data.character.systemId === 'triangle-agency') {
    let triangleSheet;
    try {
      triangleSheet = parseTriangleAgencySheet(data.character.sheet);
    } catch {
      return (
        <ErrorState message="Os dados desta ficha não seguem o formato do Triangle Agency. Nada foi alterado." />
      );
    }
    const access = characterAccessInput(data.character);
    return (
      <>
        <Stack.Screen options={{ title: data.character.name }} />
        <TriangleAgencyMobileSheet
          character={{
            id: data.character.id,
            name: data.character.name,
            version: data.character.version,
          }}
          sheet={triangleSheet}
          canEditSheet={canEditCharacterSheet(access)}
          canEditPlay={canEditCharacterPlayState(access)}
        />
      </>
    );
  }
  if (data.character.systemId === 'tormenta20') {
    let t20Sheet;
    try {
      t20Sheet = parseT20Sheet(data.character.sheet);
    } catch {
      return (
        <ErrorState message="Os dados desta ficha não seguem o formato do Tormenta20. Nada foi alterado." />
      );
    }
    const t20Access = characterAccessInput(data.character);
    return (
      <>
        <Stack.Screen options={{ title: data.character.name }} />
        <T20MobileSheet
          key={data.character.id}
          character={{
            id: data.character.id,
            name: data.character.name,
            version: data.character.version,
          }}
          campaignId={data.character.campaign?.id ?? null}
          portraitPath={data.character.portraitPath}
          portraitUrl={data.portraitUrl}
          onReload={reload}
          gate={{
            inCampaign: Boolean(data.character.campaign),
            isGm: data.character.viewer.membership?.role === 'gm',
            isOwner: data.character.viewer.isOwner,
            grantedLevel: data.character.grantedLevel,
          }}
          sheet={t20Sheet}
          resources={data.resources}
          conditions={data.conditions}
          items={data.items}
          abilities={data.abilities}
          canEditSheet={canEditCharacterSheet(t20Access)}
          canEditPlay={canEditCharacterPlayState(t20Access)}
          sources={data.t20Books}
          extras={
            <CharacterExtras
              characterId={data.character.id}
              campaignId={data.character.campaign?.id ?? null}
              isOwner={data.character.viewer.isOwner}
              imageInput={{
                system: 'Tormenta20',
                name: data.character.name,
                species: t20Sheet.identity.race,
                className: t20Sheet.identity.classes.map((entry) => entry.name).join(' / '),
                age: t20Sheet.identity.age,
                appearance: t20Sheet.identity.appearance,
                personality: t20Sheet.identity.personality,
                backstory: t20Sheet.identity.history,
              }}
            />
          }
        />
        <GhostAura active={isDown(data.resources)} />
      </>
    );
  }
  if (data.character.systemId !== 'dnd5e') {
    return (
      <Screen>
        <EmptyState
          title="Sistema não suportado"
          description="Esta versão do app ainda não tem fichas para este sistema."
        />
      </Screen>
    );
  }

  let sheet;
  try {
    sheet = parseDnd5eSheet(data.character.sheet);
  } catch {
    return (
      <ErrorState message="Os dados desta ficha não seguem o formato esperado. Nada foi alterado." />
    );
  }

  // A ficha e a subida de nível consultam o SRD e os livros liberados.
  setActiveDnd5eBookContent(buildDnd5eBookContent(data.books));
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
        fullConditionList={
          data.character.viewer.membership?.role === 'gm' || data.character.campaign === null
        }
        portraitUrl={data.portraitUrl}
        onReload={reload}
        extras={
          <CharacterExtras
            characterId={data.character.id}
            campaignId={data.character.campaign?.id ?? null}
            isOwner={data.character.viewer.isOwner}
            imageInput={{
              system: 'D&D 5e',
              name: data.character.name,
              species: sheet.identity.species,
              className: sheet.identity.classes[0]?.name ?? '',
              background: sheet.identity.background,
              alignment: sheet.identity.alignment,
              age: sheet.details.age,
              appearance: sheet.details.appearance,
              personality: sheet.details.personality,
              backstory: sheet.details.backstory,
            }}
          />
        }
      />
      <GhostAura active={isDown(data.resources)} />
    </>
  );
}
