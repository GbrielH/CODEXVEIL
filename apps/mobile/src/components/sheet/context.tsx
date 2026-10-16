import type {
  CharacterAbility,
  CharacterCondition,
  CharacterItem,
  CharacterResource,
} from '@codexveil/database';
import type { TrackOperation } from '@codexveil/domain';
import type { Dnd5eDerived, Dnd5eSheet } from '@codexveil/rpg-systems/dnd5e';
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export interface MobileSheetContext {
  characterId: string;
  canEditSheet: boolean;
  canEditPlay: boolean;
  sheet: Dnd5eSheet;
  derived: Dnd5eDerived;
  updateSheet: (updater: (sheet: Dnd5eSheet) => Dnd5eSheet) => void;
  resources: CharacterResource[];
  conditions: CharacterCondition[];
  items: CharacterItem[];
  abilities: CharacterAbility[];
  setResources: Dispatch<SetStateAction<CharacterResource[]>>;
  setItems: Dispatch<SetStateAction<CharacterItem[]>>;
  adjustResource: (resource: CharacterResource, operation: TrackOperation, amount: number) => void;
  reloadPlayState: () => Promise<void>;
  /** Executa uma alteração e mostra a falha (nada é dado como salvo sem confirmação). */
  run: <T>(action: () => Promise<T>, failure: string) => Promise<T | undefined>;
}

export const SheetContext = createContext<MobileSheetContext | null>(null);

export function useSheet(): MobileSheetContext {
  const context = useContext(SheetContext);
  if (!context) throw new Error('useSheet precisa estar dentro da ficha.');
  return context;
}
