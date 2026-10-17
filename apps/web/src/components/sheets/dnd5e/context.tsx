'use client';

import type {
  CharacterAbility,
  CharacterCondition,
  CharacterItem,
  CharacterResource,
} from '@codexveil/database';
import type { CampaignStatus, TrackOperation } from '@codexveil/domain';
import type { Dnd5eConditionEffects, Dnd5eDerived, Dnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export interface SheetCharacter {
  id: string;
  name: string;
  ownerName: string;
  version: number;
  portraitPath: string | null;
  portraitUrl: string | null;
  campaign: { id: string; name: string; status: CampaignStatus } | null;
}

export interface SheetPermissions {
  /** Construção da ficha: atributos, perícias, identidade, habilidades. */
  canEditSheet: boolean;
  /** Estado de jogo: vida, recursos, condições, inventário. */
  canEditPlay: boolean;
  isOwner: boolean;
  isGm: boolean;
}

export interface SheetContextValue {
  character: SheetCharacter;
  permissions: SheetPermissions;
  name: string;
  sheet: Dnd5eSheet;
  derived: Dnd5eDerived;
  setName: (name: string) => void;
  updateSheet: (updater: (sheet: Dnd5eSheet) => Dnd5eSheet) => void;

  resources: CharacterResource[];
  conditions: CharacterCondition[];
  /** Efeitos combinados das condições ativas (vantagens, falhas automáticas, deslocamento…). */
  conditionEffects: Dnd5eConditionEffects;
  items: CharacterItem[];
  abilities: CharacterAbility[];
  setResources: Dispatch<SetStateAction<CharacterResource[]>>;
  setItems: Dispatch<SetStateAction<CharacterItem[]>>;
  setAbilities: Dispatch<SetStateAction<CharacterAbility[]>>;

  /** Ajuste atômico de trilha com retorno imediato e reversão em caso de falha. */
  adjustResource: (resource: CharacterResource, operation: TrackOperation, amount: number) => void;
  pendingResourceIds: ReadonlySet<string>;
  reloadResources: () => Promise<void>;
  reloadConditions: () => Promise<void>;

  /**
   * Executa uma operação no banco mostrando o resultado. Devolve `undefined` em caso de
   * falha (a mensagem já foi exibida) — nada é dado como salvo sem confirmação.
   */
  run: <T>(action: () => Promise<T>, messages: { success?: string; failure: string }) => Promise<T | undefined>;
  /** A gravação do retrato muda a versão da ficha sem conflitar com o rascunho local. */
  adoptVersion: (version: number) => void;
}

export const SheetContext = createContext<SheetContextValue | null>(null);

export function useSheet(): SheetContextValue {
  const context = useContext(SheetContext);
  if (!context) throw new Error('useSheet precisa estar dentro da ficha.');
  return context;
}
