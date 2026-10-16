/**
 * Registro dos sistemas de RPG disponíveis. Os identificadores precisam coincidir com a
 * tabela `rpg_systems` do banco (a chave estrangeira impede sistemas desconhecidos).
 */
import { dnd5eSystem } from './dnd5e';
import type { CharacterSummary, RpgSystem } from './types';

export const SYSTEM_IDS = ['dnd5e'] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];

export const DEFAULT_SYSTEM_ID: SystemId = 'dnd5e';

const systems: Record<SystemId, RpgSystem> = {
  dnd5e: dnd5eSystem,
};

export function isSystemId(value: string): value is SystemId {
  return (SYSTEM_IDS as readonly string[]).includes(value);
}

export function getSystem(id: SystemId): RpgSystem {
  return systems[id];
}

/** Busca por um identificador vindo do banco; `undefined` se o sistema não for suportado. */
export function findSystem(id: string): RpgSystem | undefined {
  return isSystemId(id) ? systems[id] : undefined;
}

export function listSystems(): RpgSystem[] {
  return SYSTEM_IDS.map((id) => systems[id]);
}

/** Nome legível de uma condição (personalizadas mantêm o texto informado). */
export function conditionLabel(systemId: string, key: string, level: number | null = null): string {
  const definition = findSystem(systemId)?.conditions.find((condition) => condition.key === key);
  const label = definition?.label ?? key;
  return level ? `${label} ${level}` : label;
}

/**
 * Resumo de uma ficha vinda do banco para listas e cartões. Nunca lança: fichas de
 * sistemas desconhecidos ou com dados inválidos recebem um aviso no lugar do resumo.
 */
export function summarizeSheet(systemId: string, sheet: unknown): CharacterSummary {
  const system = findSystem(systemId);
  if (!system) return { subtitle: 'Sistema não suportado', level: null };
  try {
    return system.summarize(system.parseSheet(sheet));
  } catch {
    return { subtitle: 'Ficha com dados inválidos', level: null };
  }
}
