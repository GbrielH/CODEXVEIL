'use client';

import {
  getCharacterSheetState,
  listCharacterConditions,
  listCharacterResources,
  saveCharacterSheet,
  adjustCharacterResource,
  type CharacterAbility,
  type CharacterCondition,
  type CharacterItem,
  type CharacterResource,
} from '@codexveil/database';
import { applyTrackOperation, type TrackOperation } from '@codexveil/domain';
import {
  computeDnd5eDerived,
  dnd5eConditionEffects,
  dnd5eSheetSchema,
  parseDnd5eSheet,
  type Dnd5eSheet,
} from '@codexveil/rpg-systems/dnd5e';
import { BookOpen, Backpack, Feather, Hourglass, Settings, Sparkles, Swords } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { failureMessage } from '@/lib/client-errors';
import { DiceProvider } from '@/components/dice/dice-roller';
import { useAutosave } from '@/lib/use-autosave';
import { useRealtimeRefresh } from '@/lib/use-realtime';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { SheetContext, type SheetCharacter, type SheetContextValue, type SheetPermissions } from './context';
import { AttributesTab } from './attributes-tab';
import { FeaturesTab } from './features-tab';
import { InventoryTab } from './inventory-tab';
import { PlayTab } from './play-tab';
import { ProgressTab } from './progress-tab';
import { SettingsTab } from './settings-tab';
import { SheetHeader } from './sheet-header';
import { StoryTab } from './story-tab';

interface Dnd5eSheetScreenProps {
  character: SheetCharacter;
  sheet: Dnd5eSheet;
  resources: CharacterResource[];
  conditions: CharacterCondition[];
  items: CharacterItem[];
  abilities: CharacterAbility[];
  permissions: SheetPermissions;
  /** Campanhas ativas do dono com o mesmo sistema (para vincular o personagem). */
  campaigns: { id: string; name: string }[];
}

interface Draft {
  name: string;
  sheet: Dnd5eSheet;
}

function validateDraft(draft: Draft): string | null {
  const name = draft.name.trim();
  if (name.length === 0) return 'Informe o nome do personagem.';
  if (name.length > 80) return 'O nome pode ter no máximo 80 caracteres.';
  const parsed = dnd5eSheetSchema.safeParse(draft.sheet);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return `Há um valor fora das regras${issue ? ` (${issue.path.join(' › ')}: ${issue.message})` : ''}.`;
  }
  return null;
}

export function Dnd5eSheetScreen(props: Dnd5eSheetScreenProps) {
  const { character, permissions } = props;
  const { toast } = useToast();
  const [tab, setTab] = useState('jogo');
  const [resources, setResources] = useState(props.resources);
  const [conditions, setConditions] = useState(props.conditions);
  const [items, setItems] = useState(props.items);
  const [abilities, setAbilities] = useState(props.abilities);
  const [pendingResourceIds, setPendingResourceIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Map<string, number>());

  const autosave = useAutosave<Draft>({
    initial: { name: character.name, sheet: props.sheet },
    version: character.version,
    save: async (draft, expectedVersion) => {
      const result = await saveCharacterSheet(getSupabaseBrowserClient(), character.id, expectedVersion, {
        name: draft.name.trim(),
        sheet: draft.sheet,
      });
      return result.version;
    },
    validate: validateDraft,
  });
  const { value: draft, update, reset, state: saveState } = autosave;

  const derived = useMemo(() => computeDnd5eDerived(draft.sheet), [draft.sheet]);
  const conditionEffects = useMemo(() => dnd5eConditionEffects(conditions), [conditions]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, messages: { success?: string; failure: string }) => {
      try {
        const result = await action();
        if (messages.success) toast({ tone: 'success', title: messages.success });
        return result;
      } catch (error) {
        toast({ tone: 'danger', title: messages.failure, description: failureMessage(error, 'Tente novamente.') });
        return undefined;
      }
    },
    [toast],
  );

  const reloadResources = useCallback(async () => {
    try {
      const fresh = await listCharacterResources(getSupabaseBrowserClient(), character.id);
      // Trilhas com alteração em andamento mantêm o valor otimista até a confirmação.
      setResources((current) =>
        fresh.map((resource) =>
          inFlight.current.has(resource.id)
            ? (current.find((existing) => existing.id === resource.id) ?? resource)
            : resource,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  }, [character.id]);

  const reloadConditions = useCallback(async () => {
    try {
      setConditions(await listCharacterConditions(getSupabaseBrowserClient(), character.id));
    } catch (error) {
      console.error(error);
    }
  }, [character.id]);

  const adjustResource = useCallback(
    (resource: CharacterResource, operation: TrackOperation, amount: number) => {
      let optimistic: CharacterResource;
      try {
        optimistic = { ...resource, ...applyTrackOperation(resource, operation, amount) };
      } catch {
        toast({ tone: 'warning', title: 'Valor inválido', description: 'Use um número inteiro maior ou igual a zero.' });
        return;
      }
      setResources((current) => current.map((item) => (item.id === resource.id ? optimistic : item)));
      const count = (inFlight.current.get(resource.id) ?? 0) + 1;
      inFlight.current.set(resource.id, count);
      setPendingResourceIds(new Set(inFlight.current.keys()));

      adjustCharacterResource(getSupabaseBrowserClient(), resource.id, operation, amount)
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
            description: failureMessage(error, 'O valor foi restaurado. Tente novamente.'),
          });
          void reloadResources();
        })
        .finally(() => setPendingResourceIds(new Set(inFlight.current.keys())));
    },
    [reloadResources, toast],
  );

  // Atualizações feitas por outra pessoa (ex.: o mestre aplicando dano) chegam em tempo real.
  const liveStatus = useRealtimeRefresh(
    `ficha:${character.id}`,
    [
      { table: 'characters', filter: `id=eq.${character.id}` },
      { table: 'character_resources', filter: `character_id=eq.${character.id}` },
      { table: 'character_conditions', filter: `character_id=eq.${character.id}` },
    ],
    () => {
      void reloadResources();
      void reloadConditions();
      void (async () => {
        try {
          const state = await getCharacterSheetState(getSupabaseBrowserClient(), character.id);
          if (state && state.version > autosave.state.version && !autosave.hasUnsavedChanges()) {
            reset({ name: state.name, sheet: parseDnd5eSheet(state.sheet) }, state.version);
          }
        } catch (error) {
          console.error(error);
        }
      })();
    },
  );

  const resolveConflict = async (keepMine: boolean) => {
    try {
      const state = await getCharacterSheetState(getSupabaseBrowserClient(), character.id);
      if (!state) throw new Error('Personagem não encontrado.');
      if (keepMine) {
        await autosave.overwrite(state.version);
      } else {
        reset({ name: state.name, sheet: parseDnd5eSheet(state.sheet) }, state.version);
        toast({ tone: 'info', title: 'Ficha recarregada com a versão mais recente.' });
      }
    } catch (error) {
      toast({ tone: 'danger', title: 'Não foi possível resolver o conflito', description: failureMessage(error, 'Tente novamente.') });
    }
  };

  const context: SheetContextValue = {
    character,
    permissions,
    name: draft.name,
    sheet: draft.sheet,
    derived,
    setName: (name) => update((current) => ({ ...current, name })),
    updateSheet: (updater) => update((current) => ({ ...current, sheet: updater(current.sheet) })),
    resources,
    conditions,
    conditionEffects,
    items,
    abilities,
    setResources,
    setItems,
    setAbilities,
    adjustResource,
    pendingResourceIds,
    reloadResources,
    reloadConditions,
    run,
    adoptVersion: autosave.adoptVersion,
  };

  const readOnlyReason = !permissions.canEditPlay
    ? character.campaign?.status === 'archived'
      ? 'A campanha está arquivada: a ficha está disponível apenas para consulta.'
      : 'Você está consultando a ficha de outro jogador (somente leitura).'
    : !permissions.canEditSheet
      ? 'O mestre travou a construção das fichas. Vida, recursos, condições e inventário continuam editáveis.'
      : null;

  return (
    <SheetContext.Provider value={context}>
      <DiceProvider campaignId={character.campaign?.id ?? null} characterId={character.id} enabled={permissions.canEditPlay}>
        <div className="flex flex-col gap-5">
          <SheetHeader saveStatus={saveState.status} liveStatus={liveStatus} />

          {saveState.status === 'conflict' ? (
            <Alert
              tone="warning"
              title="Esta ficha foi alterada em outro lugar"
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button size="sm" variant="secondary" onClick={() => void resolveConflict(false)}>
                    Usar a versão salva
                  </Button>
                  <Button size="sm" onClick={() => void resolveConflict(true)}>
                    Manter as minhas
                  </Button>
                </div>
              }
            >
              Suas últimas alterações ainda não foram gravadas. Escolha qual versão manter.
            </Alert>
          ) : null}
          {saveState.status === 'error' ? (
            <Alert
              tone="danger"
              title="Alterações não salvas"
              action={
                <Button size="sm" variant="secondary" onClick={() => void autosave.retry()}>
                  Tentar de novo
                </Button>
              }
            >
              {saveState.message} Suas alterações continuam nesta tela.
            </Alert>
          ) : null}
          {saveState.status === 'invalid' ? <Alert tone="warning">{saveState.message}</Alert> : null}
          {readOnlyReason ? <Alert tone="info">{readOnlyReason}</Alert> : null}

          <Tabs
            label="Seções da ficha"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'jogo', label: 'Jogo', icon: <Swords className="h-4 w-4" aria-hidden="true" />, content: <PlayTab /> },
              { value: 'atributos', label: 'Atributos', icon: <BookOpen className="h-4 w-4" aria-hidden="true" />, content: <AttributesTab /> },
              { value: 'inventario', label: 'Inventário', icon: <Backpack className="h-4 w-4" aria-hidden="true" />, content: <InventoryTab /> },
              { value: 'habilidades', label: 'Habilidades e magias', icon: <Sparkles className="h-4 w-4" aria-hidden="true" />, content: <FeaturesTab /> },
              { value: 'historia', label: 'Personagem', icon: <Feather className="h-4 w-4" aria-hidden="true" />, content: <StoryTab /> },
              { value: 'evolucao', label: 'Evolução', icon: <Hourglass className="h-4 w-4" aria-hidden="true" />, content: <ProgressTab /> },
              ...(permissions.isOwner || permissions.canEditSheet
                ? [{ value: 'ajustes', label: 'Ajustes', icon: <Settings className="h-4 w-4" aria-hidden="true" />, content: <SettingsTab campaigns={props.campaigns} /> }]
                : []),
            ]}
          />
        </div>
      </DiceProvider>
    </SheetContext.Provider>
  );
}
