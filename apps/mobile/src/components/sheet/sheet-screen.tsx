import {
  adjustCharacterResource,
  getCharacterSheetState,
  listCharacterConditions,
  listCharacterResources,
  characterPortraitPath,
  saveCharacterSheet,
  setCharacterPortrait,
  type AutosaveStatus,
  type CharacterAbility,
  type CharacterCondition,
  type CharacterDetail,
  type CharacterItem,
  type CharacterResource,
} from '@codexveil/database';
import { applyTrackOperation, type TrackOperation } from '@codexveil/domain';
import {
  computeDnd5eDerived,
  speciesSpeedFeet,
  dnd5eConditionEffects,
  dnd5eSheetSchema,
  dnd5eSystem,
  parseDnd5eSheet,
  type Dnd5eSheet,
} from '@codexveil/rpg-systems/dnd5e';
import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { ImageUploadButtons } from '@/components/ui/image-upload';
import { AppText, Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAutosave, useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { DiceProvider } from '@/components/dice/dice';
import { AttributesSection } from './attributes-section';
import { SheetContext, type MobileSheetContext } from './context';
import { DeleteCharacterCard } from './delete-character';
import { EvolutionSection } from './evolution-section';
import { FeaturesSection } from './features-section';
import { InventorySection } from './inventory-section';
import { PlaySection } from './play-section';
import { StorySection } from './story-section';
import { TurnPlay } from './turn-play';

type Tab = 'jogo' | 'atributos' | 'inventario' | 'habilidades' | 'personagem' | 'evolucao';

const statusLabels: Record<AutosaveStatus, string> = {
  saved: 'Salvo',
  pending: 'Alterações pendentes',
  saving: 'Salvando…',
  error: 'Não salvo',
  conflict: 'Conflito de edição',
  invalid: 'Corrija para salvar',
};

interface SheetScreenProps {
  character: CharacterDetail;
  sheet: Dnd5eSheet;
  resources: CharacterResource[];
  conditions: CharacterCondition[];
  items: CharacterItem[];
  abilities: CharacterAbility[];
  canEditSheet: boolean;
  canEditPlay: boolean;
  fullConditionList: boolean;
  /** Retrato assinado (URL temporária) e recarga após trocá-lo. */
  portraitUrl: string | null;
  onReload: () => void;
}

export function SheetScreen(props: SheetScreenProps) {
  const { character } = props;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('jogo');
  const [resources, setResources] = useState(props.resources);
  const [conditions, setConditions] = useState(props.conditions);
  const [items, setItems] = useState(props.items);
  const [abilities, setAbilities] = useState(props.abilities);
  const inFlight = useRef(new Map<string, number>());

  const autosave = useAutosave<Dnd5eSheet>({
    initial: props.sheet,
    version: character.version,
    save: async (sheet, version) =>
      (await saveCharacterSheet(getSupabase(), character.id, version, { sheet })).version,
    validate: (sheet) => {
      const parsed = dnd5eSheetSchema.safeParse(sheet);
      return parsed.success
        ? null
        : `Valor fora das regras: ${parsed.error.issues[0]?.message ?? ''}`;
    },
  });
  const sheet = autosave.value;
  // CA, deslocamento e atributos vêm do que está equipado e das características (automático).
  const derived = computeDnd5eDerived(sheet, {
    items,
    features: abilities.filter((entry) => entry.kind !== 'attack' && entry.kind !== 'spell').map((entry) => entry.name),
  });
  // Grava na ficha a CA e o deslocamento calculados (o mestre, o grupo e o mapa leem a ficha).
  const knownSpecies = speciesSpeedFeet(sheet.identity.species) !== null;
  const updateSheet = autosave.update;
  useEffect(() => {
    if (!props.canEditSheet) return;
    const acChanged = derived.armorClass !== sheet.combat.armorClass;
    const speedChanged = knownSpecies && derived.speed !== sheet.combat.speed;
    if (!acChanged && !speedChanged) return;
    updateSheet((current) => ({ ...current, combat: { ...current.combat, armorClass: derived.armorClass, ...(speedChanged ? { speed: derived.speed } : {}) } }));
  }, [derived.armorClass, derived.speed, knownSpecies, props.canEditSheet, sheet.combat.armorClass, sheet.combat.speed, updateSheet]);
  const conditionEffects = dnd5eConditionEffects(conditions);

  const reloadPlayState = async () => {
    try {
      const supabase = getSupabase();
      const [nextResources, nextConditions] = await Promise.all([
        listCharacterResources(supabase, character.id),
        listCharacterConditions(supabase, character.id),
      ]);
      setResources((current) =>
        nextResources.map((resource) =>
          inFlight.current.has(resource.id)
            ? (current.find((item) => item.id === resource.id) ?? resource)
            : resource,
        ),
      );
      setConditions(nextConditions);
    } catch (error) {
      console.error(error);
    }
  };

  const adjustResource = (
    resource: CharacterResource,
    operation: TrackOperation,
    amount: number,
  ) => {
    let optimistic: CharacterResource;
    try {
      optimistic = { ...resource, ...applyTrackOperation(resource, operation, amount) };
    } catch {
      toast({ tone: 'warning', title: 'Valor inválido' });
      return;
    }
    setResources((current) => current.map((item) => (item.id === resource.id ? optimistic : item)));
    inFlight.current.set(resource.id, (inFlight.current.get(resource.id) ?? 0) + 1);
    adjustCharacterResource(getSupabase(), resource.id, operation, amount)
      .then((saved) => {
        const remaining = (inFlight.current.get(resource.id) ?? 1) - 1;
        if (remaining > 0) {
          inFlight.current.set(resource.id, remaining);
          return;
        }
        inFlight.current.delete(resource.id);
        setResources((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      })
      .catch((error: unknown) => {
        inFlight.current.delete(resource.id);
        toast({
          tone: 'danger',
          title: `${resource.label}: alteração NÃO salva`,
          description: failureMessage(error),
        });
        void reloadPlayState();
      });
  };

  const run = async <T,>(action: () => Promise<T>, failure: string) => {
    try {
      const result = await action();
      // Ações sem retorno (excluir, equipar…) também precisam sinalizar sucesso: `undefined` é falha.
      return result === undefined ? (true as T) : result;
    } catch (error) {
      toast({ tone: 'danger', title: failure, description: failureMessage(error) });
      return undefined;
    }
  };

  const live = useRealtimeRefresh(
    `ficha-mobile:${character.id}`,
    [
      { table: 'characters', filter: `id=eq.${character.id}` },
      { table: 'character_resources', filter: `character_id=eq.${character.id}` },
      { table: 'character_conditions', filter: `character_id=eq.${character.id}` },
    ],
    () => {
      void reloadPlayState();
      void getCharacterSheetState(getSupabase(), character.id)
        .then((state) => {
          if (state && state.version > autosave.state.version && !autosave.hasUnsavedChanges()) {
            autosave.reset(parseDnd5eSheet(state.sheet), state.version);
          }
        })
        .catch((error: unknown) => console.error(error));
    },
  );

  const resolveConflict = async (keepMine: boolean) => {
    try {
      const state = await getCharacterSheetState(getSupabase(), character.id);
      if (!state) return;
      if (keepMine) await autosave.overwrite(state.version);
      else autosave.reset(parseDnd5eSheet(state.sheet), state.version);
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Não foi possível resolver o conflito',
        description: failureMessage(error),
      });
    }
  };

  const context: MobileSheetContext = {
    characterId: character.id,
    canEditSheet: props.canEditSheet,
    canEditPlay: props.canEditPlay,
    fullConditionList: props.fullConditionList,
    sheet,
    derived,
    updateSheet: autosave.update,
    resources,
    conditions,
    conditionEffects,
    items,
    abilities,
    setResources,
    setItems,
    setAbilities,
    adjustResource,
    reloadPlayState,
    run,
  };

  const summary = dnd5eSystem.summarize(sheet);

  const inCampaign = Boolean(character.campaign);

  return (
    <SheetContext.Provider value={context}>
      {/* Rolagens da ficha são testes do jogador: ficam no aparelho e não vão para o mural. */}
      <DiceProvider campaignId={null} characterId={character.id} enabled={props.canEditPlay}>
        <Screen
          eyebrow={character.campaign?.name ?? 'Sem campanha'}
          title={character.name}
          subtitle={`${summary.subtitle} · ${character.ownerName}`}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Badge label={`Nível ${derived.level}`} tone="parchment" />
            <Badge label={`Proficiência +${derived.proficiencyBonus}`} tone="neutral" />
            {props.canEditSheet || props.canEditPlay ? (
              <Badge
                label={statusLabels[autosave.state.status]}
                tone={
                  autosave.state.status === 'error'
                    ? 'danger'
                    : autosave.state.status === 'saved'
                      ? 'success'
                      : 'warning'
                }
              />
            ) : null}
            <AppText
              variant="small"
              style={{ color: live === 'live' ? colors.success : colors.fgMuted }}
            >
              {live === 'live'
                ? '● Ao vivo'
                : live === 'connecting'
                  ? '○ Conectando…'
                  : '○ Reconectando…'}
            </AppText>
          </View>

          {autosave.state.status === 'conflict' ? (
            <Notice
              tone="warning"
              title="Ficha alterada em outro lugar"
              message="Suas alterações ainda não foram gravadas. Escolha qual versão manter."
              action={
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button
                    label="Usar a salva"
                    compact
                    variant="secondary"
                    onPress={() => void resolveConflict(false)}
                  />
                  <Button
                    label="Manter as minhas"
                    compact
                    onPress={() => void resolveConflict(true)}
                  />
                </View>
              }
            />
          ) : null}
          {autosave.state.status === 'error' ? (
            <Notice
              tone="danger"
              title="Alterações não salvas"
              message={autosave.state.message ?? ''}
              action={
                <Button
                  label="Tentar de novo"
                  compact
                  variant="secondary"
                  onPress={() => void autosave.retry()}
                />
              }
            />
          ) : null}
          {autosave.state.status === 'invalid' ? (
            <Notice tone="warning" message={autosave.state.message ?? ''} />
          ) : null}
          {!props.canEditPlay ? (
            <Notice
              message={
                character.campaign?.status === 'archived'
                  ? 'Campanha arquivada: ficha somente para consulta.'
                  : 'Você está consultando a ficha de outro jogador.'
              }
            />
          ) : !props.canEditSheet ? (
            <Notice message="O mestre travou a construção das fichas. Vida, recursos e inventário seguem editáveis." />
          ) : null}

          {props.portraitUrl || props.canEditSheet ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {props.portraitUrl ? (
                <Image
                  source={{ uri: props.portraitUrl }}
                  accessibilityLabel={`Retrato de ${character.name}`}
                  style={{ width: 72, height: 72, borderRadius: 36 }}
                />
              ) : null}
              {props.canEditSheet ? (
                <View style={{ flex: 1 }}>
                  <ImageUploadButtons
                    preset="portrait"
                    label="Enviar retrato"
                    currentPath={character.portraitPath}
                    pathFor={(fileName) => characterPortraitPath(character.id, fileName)}
                    apply={async (path) =>
                      autosave.adoptVersion(
                        await setCharacterPortrait(getSupabase(), character.id, path),
                      )
                    }
                    onDone={() => {
                      toast({ tone: 'success', title: 'Retrato atualizado.' });
                      props.onReload();
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {character.campaign && character.campaign.status === 'active' && tab === 'jogo' ? (
            <TurnPlay campaignId={character.campaign.id} />
          ) : null}

          <Segmented<Tab>
            accessibilityLabel="Seções da ficha"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'jogo', label: 'Jogo' },
              { value: 'atributos', label: 'Atributos' },
              { value: 'inventario', label: 'Inventário' },
              // Na campanha, as habilidades ficam divididas entre Jogo (usáveis) e Atributos (passivas).
              ...(inCampaign ? [] : [{ value: 'habilidades' as const, label: 'Habilidades' }]),
              { value: 'personagem', label: 'Personagem' },
              { value: 'evolucao', label: 'Evolução' },
            ]}
          />
          {tab === 'jogo' ? <PlaySection /> : null}
          {tab === 'jogo' && inCampaign ? <FeaturesSection show="usable" /> : null}
          {tab === 'atributos' ? <AttributesSection /> : null}
          {tab === 'atributos' && inCampaign ? <FeaturesSection show="passive" /> : null}
          {tab === 'inventario' ? <InventorySection /> : null}
          {tab === 'habilidades' && !inCampaign ? <FeaturesSection /> : null}
          {tab === 'personagem' ? <StorySection /> : null}
          {tab === 'evolucao' ? (
            <EvolutionSection
              characterName={character.name}
              gate={{
                inCampaign: Boolean(character.campaign),
                isGm: character.viewer.membership?.role === 'gm',
                isOwner: character.viewer.isOwner,
                grantedLevel: character.grantedLevel,
              }}
            />
          ) : null}
          {tab === 'personagem' && character.viewer.isOwner ? (
            <DeleteCharacterCard
              characterId={character.id}
              name={character.name}
              portraitPath={character.portraitPath}
            />
          ) : null}
        </Screen>
      </DiceProvider>
    </SheetContext.Provider>
  );
}
