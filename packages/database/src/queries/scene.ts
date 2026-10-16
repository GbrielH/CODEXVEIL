/**
 * Cena da sessão e combate (exclusivos dos mestres pelo RLS).
 *
 * Instâncias da cena (`session_entities`) são cópias independentes do registro-base da
 * biblioteca: dano numa instância não altera o registro nem as outras instâncias.
 * O encontro guarda a ordem de iniciativa e o turno, com controle otimista de versão
 * para que dois mestres não avancem o turno ao mesmo tempo sem perceber.
 */
import { AppError } from '@codexveil/domain';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { CreatureKind, EncounterStatus } from '../types';
import type { Tables } from '../types.gen';

export interface SceneEntity {
  id: string;
  sessionId: string;
  creatureId: string | null;
  kind: CreatureKind;
  name: string;
  hpCurrent: number | null;
  hpMax: number | null;
  hpTemp: number;
  armorClass: number | null;
  initiativeBonus: number;
  conditions: string[];
  notes: string;
  sortOrder: number;
}

const ENTITY_COLUMNS =
  'id, session_id, creature_id, kind, name, hp_current, hp_max, hp_temp, armor_class, initiative_bonus, conditions, notes, sort_order' as const;

type EntityRow = Pick<
  Tables<'session_entities'>,
  | 'id'
  | 'session_id'
  | 'creature_id'
  | 'kind'
  | 'name'
  | 'hp_current'
  | 'hp_max'
  | 'hp_temp'
  | 'armor_class'
  | 'initiative_bonus'
  | 'conditions'
  | 'notes'
  | 'sort_order'
>;

function toSceneEntity(row: EntityRow): SceneEntity {
  return {
    id: row.id,
    sessionId: row.session_id,
    creatureId: row.creature_id,
    kind: row.kind,
    name: row.name,
    hpCurrent: row.hp_current,
    hpMax: row.hp_max,
    hpTemp: row.hp_temp,
    armorClass: row.armor_class,
    initiativeBonus: row.initiative_bonus,
    conditions: row.conditions,
    notes: row.notes,
    sortOrder: row.sort_order,
  };
}

export async function listSceneEntities(
  client: CodexveilClient,
  sessionId: string,
): Promise<SceneEntity[]> {
  const { data, error } = await client
    .from('session_entities')
    .select(ENTITY_COLUMNS)
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toSceneEntity);
}

export interface SceneEntityInput {
  sessionId: string;
  campaignId: string;
  creatureId: string | null;
  kind: CreatureKind;
  name: string;
  hpMax: number | null;
  armorClass: number | null;
  initiativeBonus: number;
  notes?: string;
  sortOrder?: number;
}

export async function addSceneEntity(
  client: CodexveilClient,
  input: SceneEntityInput,
): Promise<SceneEntity> {
  const { data, error } = await client
    .from('session_entities')
    .insert({
      session_id: input.sessionId,
      campaign_id: input.campaignId,
      creature_id: input.creatureId,
      kind: input.kind,
      name: input.name,
      hp_max: input.hpMax,
      hp_current: input.hpMax,
      armor_class: input.armorClass,
      initiative_bonus: input.initiativeBonus,
      notes: input.notes ?? '',
      sort_order: input.sortOrder ?? 0,
    })
    .select(ENTITY_COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toSceneEntity(data);
}

export interface SceneEntityPatch {
  name?: string;
  hpMax?: number | null;
  armorClass?: number | null;
  initiativeBonus?: number;
  conditions?: string[];
  notes?: string;
  sortOrder?: number;
}

export async function updateSceneEntity(
  client: CodexveilClient,
  entityId: string,
  patch: SceneEntityPatch,
): Promise<SceneEntity> {
  const { data, error } = await client
    .from('session_entities')
    .update({
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.hpMax === undefined ? {} : { hp_max: patch.hpMax }),
      ...(patch.armorClass === undefined ? {} : { armor_class: patch.armorClass }),
      ...(patch.initiativeBonus === undefined ? {} : { initiative_bonus: patch.initiativeBonus }),
      ...(patch.conditions === undefined ? {} : { conditions: patch.conditions }),
      ...(patch.notes === undefined ? {} : { notes: patch.notes }),
      ...(patch.sortOrder === undefined ? {} : { sort_order: patch.sortOrder }),
    })
    .eq('id', entityId)
    .select(ENTITY_COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toSceneEntity(row);
}

export const ENTITY_HP_OPERATIONS = ['damage', 'heal', 'set_current', 'set_temp'] as const;
export type EntityHpOperation = (typeof ENTITY_HP_OPERATIONS)[number];

export async function adjustSceneEntityHp(
  client: CodexveilClient,
  entityId: string,
  operation: EntityHpOperation,
  amount: number,
): Promise<SceneEntity> {
  const { data, error } = await client.rpc('adjust_session_entity_hp', {
    p_entity_id: entityId,
    p_operation: operation,
    p_amount: amount,
  });
  if (error) throw toAppError(error);
  return toSceneEntity(data);
}

export async function removeSceneEntity(client: CodexveilClient, entityId: string): Promise<void> {
  const { data, error } = await client
    .from('session_entities')
    .delete()
    .eq('id', entityId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

// ---------------------------------------------------------------------------
// Encontros e iniciativa
// ---------------------------------------------------------------------------

export interface EncounterCombatant {
  id: string;
  sessionEntityId: string | null;
  characterId: string | null;
  initiative: number | null;
  tiebreaker: number;
  isDefeated: boolean;
}

export interface Encounter {
  id: string;
  sessionId: string;
  campaignId: string;
  name: string;
  status: EncounterStatus;
  round: number;
  activeCombatantId: string | null;
  version: number;
  combatants: EncounterCombatant[];
}

export const encounterStatusLabels: Record<EncounterStatus, string> = {
  preparing: 'Preparando',
  active: 'Em combate',
  ended: 'Encerrado',
};

const ENCOUNTER_COLUMNS =
  'id, session_id, campaign_id, name, status, round, active_combatant_id, version' as const;
const COMBATANT_COLUMNS =
  'id, session_entity_id, character_id, initiative, tiebreaker, is_defeated' as const;

type CombatantRow = Pick<
  Tables<'encounter_combatants'>,
  'id' | 'session_entity_id' | 'character_id' | 'initiative' | 'tiebreaker' | 'is_defeated'
>;

function toCombatant(row: CombatantRow): EncounterCombatant {
  return {
    id: row.id,
    sessionEntityId: row.session_entity_id,
    characterId: row.character_id,
    initiative: row.initiative,
    tiebreaker: row.tiebreaker,
    isDefeated: row.is_defeated,
  };
}

/** Encontro mais recente ainda não encerrado da sessão (ou `null`). */
export async function getOpenEncounter(
  client: CodexveilClient,
  sessionId: string,
): Promise<Encounter | null> {
  const { data, error } = await client
    .from('encounters')
    .select(ENCOUNTER_COLUMNS)
    .eq('session_id', sessionId)
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;

  const { data: combatants, error: combatantsError } = await client
    .from('encounter_combatants')
    .select(COMBATANT_COLUMNS)
    .eq('encounter_id', data.id)
    .order('created_at', { ascending: true });
  if (combatantsError) throw toAppError(combatantsError);

  return {
    id: data.id,
    sessionId: data.session_id,
    campaignId: data.campaign_id,
    name: data.name,
    status: data.status,
    round: data.round,
    activeCombatantId: data.active_combatant_id,
    version: data.version,
    combatants: combatants.map(toCombatant),
  };
}

export async function createEncounter(
  client: CodexveilClient,
  params: { sessionId: string; campaignId: string; name: string },
): Promise<string> {
  const { data, error } = await client
    .from('encounters')
    .insert({ session_id: params.sessionId, campaign_id: params.campaignId, name: params.name })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export interface CombatantInput {
  sessionEntityId?: string;
  characterId?: string;
  initiative: number | null;
  tiebreaker: number;
}

export async function addCombatants(
  client: CodexveilClient,
  encounterId: string,
  campaignId: string,
  combatants: readonly CombatantInput[],
): Promise<void> {
  if (combatants.length === 0) return;
  const { error } = await client.from('encounter_combatants').insert(
    combatants.map((combatant) => ({
      encounter_id: encounterId,
      campaign_id: campaignId,
      session_entity_id: combatant.sessionEntityId ?? null,
      character_id: combatant.characterId ?? null,
      initiative: combatant.initiative,
      tiebreaker: combatant.tiebreaker,
    })),
  );
  if (error) throw toAppError(error);
}

export async function updateCombatant(
  client: CodexveilClient,
  combatantId: string,
  patch: { initiative?: number | null; tiebreaker?: number; isDefeated?: boolean },
): Promise<void> {
  const { data, error } = await client
    .from('encounter_combatants')
    .update({
      ...(patch.initiative === undefined ? {} : { initiative: patch.initiative }),
      ...(patch.tiebreaker === undefined ? {} : { tiebreaker: patch.tiebreaker }),
      ...(patch.isDefeated === undefined ? {} : { is_defeated: patch.isDefeated }),
    })
    .eq('id', combatantId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function removeCombatant(client: CodexveilClient, combatantId: string): Promise<void> {
  const { data, error } = await client
    .from('encounter_combatants')
    .delete()
    .eq('id', combatantId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/**
 * Grava estado e turno do encontro somente se ninguém o alterou desde a leitura
 * (`expectedVersion`). Devolve a nova versão; lança `conflict` se estiver desatualizado.
 */
export async function saveEncounterTurn(
  client: CodexveilClient,
  encounterId: string,
  expectedVersion: number,
  state: { status: EncounterStatus; round: number; activeCombatantId: string | null },
): Promise<number> {
  const { data, error } = await client
    .from('encounters')
    .update({
      status: state.status,
      round: state.round,
      active_combatant_id: state.activeCombatantId,
    })
    .eq('id', encounterId)
    .eq('version', expectedVersion)
    .select('version');
  if (error) throw toAppError(error);
  const row = data[0];
  if (row) return row.version;
  throw new AppError(
    'conflict',
    'O combate foi atualizado por outro mestre. Os dados foram recarregados; repita a ação.',
  );
}

export async function deleteEncounter(client: CodexveilClient, encounterId: string): Promise<void> {
  const { data, error } = await client.from('encounters').delete().eq('id', encounterId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}
