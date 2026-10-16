import {
  adjustCharacterResource,
  getCharacterSheetState,
  listCharacterConditions,
  listCharacterResources,
  saveCharacterSheet,
  type AutosaveStatus,
  type CharacterAbility,
  type CharacterCondition,
  type CharacterDetail,
  type CharacterItem,
  type CharacterResource,
} from '@codexveil/database';
import { applyTrackOperation, type TrackOperation } from '@codexveil/domain';
import { computeDnd5eDerived, dnd5eSheetSchema, dnd5eSystem, parseDnd5eSheet, type Dnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { AppText, Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/errors';
import { useAutosave, useRealtimeRefresh } from '@/lib/hooks';
import { getSupabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { AttributesSection } from './attributes-section';
import { SheetContext, type MobileSheetContext } from './context';
import { FeaturesSection } from './features-section';
import { InventorySection } from './inventory-section';
import { PlaySection } from './play-section';
import { StorySection } from './story-section';

type Tab = 'jogo' | 'atributos' | 'inventario' | 'habilidades' | 'personagem';

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
}

export function SheetScreen(props: SheetScreenProps) {
  const { character } = props;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('jogo');
  const [resources, setResources] = useState(props.resources);
  const [conditions, setConditions] = useState(props.conditions);
  const [items, setItems] = useState(props.items);
  const inFlight = useRef(new Map<string, number>());

  const autosave = useAutosave<Dnd5eSheet>({
    initial: props.sheet,
    version: character.version,
    save: async (sheet, version) => (await saveCharacterSheet(getSupabase(), character.id, version, { sheet })).version,
    validate: (sheet) => {
      const parsed = dnd5eSheetSchema.safeParse(sheet);
      return parsed.success ? null : `Valor fora das regras: ${parsed.error.issues[0]?.message ?? ''}`;
    },
  });
  const sheet = autosave.value;
  const derived = computeDnd5eDerived(sheet);

  const reloadPlayState = async () => {
    try {
      const supabase = getSupabase();
      const [nextResources, nextConditions] = await Promise.all([listCharacterResources(supabase, character.id), listCharacterConditions(supabase, character.id)]);
      setResources((current) => nextResources.map((resource) => (inFlight.current.has(resource.id) ? (current.find((item) => item.id === resource.id) ?? resource) : resource)));
      setConditions(nextConditions);
    } catch (error) {
      console.error(error);
    }
  };

  const adjustResource = (resource: CharacterResource, operation: TrackOperation, amount: number) => {
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
        toast({ tone: 'danger', title: `${resource.label}: alteração NÃO salva`, description: failureMessage(error) });
        void reloadPlayState();
      });
  };

  const run = async <T,>(action: () => Promise<T>, failure: string) => {
    try {
      return await action();
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
      toast({ tone: 'danger', title: 'Não foi possível resolver o conflito', description: failureMessage(error) });
    }
  };

  const context: MobileSheetContext = {
    characterId: character.id,
    canEditSheet: props.canEditSheet,
    canEditPlay: props.canEditPlay,
    sheet,
    derived,
    updateSheet: autosave.update,
    resources,
    conditions,
    items,
    abilities: props.abilities,
    setResources,
    setItems,
    adjustResource,
    reloadPlayState,
    run,
  };

  const summary = dnd5eSystem.summarize(sheet);

  return (
    <SheetContext.Provider value={context}>
      <Screen eyebrow={character.campaign?.name ?? 'Sem campanha'} title={character.name} subtitle={`${summary.subtitle} · ${character.ownerName}`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Badge label={`Nível ${derived.level}`} tone="parchment" />
          <Badge label={`Proficiência +${derived.proficiencyBonus}`} tone="neutral" />
          {props.canEditSheet || props.canEditPlay ? <Badge label={statusLabels[autosave.state.status]} tone={autosave.state.status === 'error' ? 'danger' : autosave.state.status === 'saved' ? 'success' : 'warning'} /> : null}
          <AppText variant="small" style={{ color: live === 'live' ? colors.success : colors.fgMuted }}>
            {live === 'live' ? '● Ao vivo' : live === 'connecting' ? '○ Conectando…' : '○ Reconectando…'}
          </AppText>
        </View>

        {autosave.state.status === 'conflict' ? (
          <Notice
            tone="warning"
            title="Ficha alterada em outro lugar"
            message="Suas alterações ainda não foram gravadas. Escolha qual versão manter."
            action={
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button label="Usar a salva" compact variant="secondary" onPress={() => void resolveConflict(false)} />
                <Button label="Manter as minhas" compact onPress={() => void resolveConflict(true)} />
              </View>
            }
          />
        ) : null}
        {autosave.state.status === 'error' ? (
          <Notice tone="danger" title="Alterações não salvas" message={autosave.state.message ?? ''} action={<Button label="Tentar de novo" compact variant="secondary" onPress={() => void autosave.retry()} />} />
        ) : null}
        {autosave.state.status === 'invalid' ? <Notice tone="warning" message={autosave.state.message ?? ''} /> : null}
        {!props.canEditPlay ? (
          <Notice message={character.campaign?.status === 'archived' ? 'Campanha arquivada: ficha somente para consulta.' : 'Você está consultando a ficha de outro jogador.'} />
        ) : !props.canEditSheet ? (
          <Notice message="O mestre travou a construção das fichas. Vida, recursos e inventário seguem editáveis." />
        ) : null}

        <Segmented<Tab>
          accessibilityLabel="Seções da ficha"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'jogo', label: 'Jogo' },
            { value: 'atributos', label: 'Atributos' },
            { value: 'inventario', label: 'Inventário' },
            { value: 'habilidades', label: 'Habilidades' },
            { value: 'personagem', label: 'Personagem' },
          ]}
        />
        {tab === 'jogo' ? <PlaySection /> : null}
        {tab === 'atributos' ? <AttributesSection /> : null}
        {tab === 'inventario' ? <InventorySection /> : null}
        {tab === 'habilidades' ? <FeaturesSection /> : null}
        {tab === 'personagem' ? <StorySection /> : null}
      </Screen>
    </SheetContext.Provider>
  );
}
