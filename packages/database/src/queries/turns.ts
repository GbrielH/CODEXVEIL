/**
 * Resumo do turno visível aos jogadores (`campaign_turns`), mantido por gatilhos a partir do
 * encontro aberto. Os encontros continuam exclusivos do mestre; aqui só chegam o modo, a
 * rodada, de quem é a vez e a ordem (sem os participantes ocultos).
 */
import { TURN_ACTION_KINDS, TURN_MODES, type DiceRollMode, type TurnActionKind, type TurnMode } from '@codexveil/domain';
import type { Tables } from '../types.gen';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { EncounterStatus } from '../types';

export interface TurnOrderEntry {
  id: string;
  name: string;
  kind: 'character' | 'npc' | 'monster';
  characterId: string | null;
  defeated: boolean;
  current: boolean;
}

export interface CampaignTurn {
  campaignId: string;
  encounterId: string;
  sessionId: string;
  name: string;
  mode: TurnMode;
  status: EncounterStatus;
  round: number;
  /** `null` quando ninguém está na vez ou quando é a vez de alguém oculto. */
  activeName: string | null;
  activeCharacterId: string | null;
  order: TurnOrderEntry[];
  updatedAt: string;
}

function parseOrder(value: unknown): TurnOrderEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): TurnOrderEntry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string') return [];
    const kind = row.kind === 'character' || row.kind === 'npc' ? row.kind : 'monster';
    return [
      {
        id: row.id,
        name: row.name,
        kind,
        characterId: typeof row.characterId === 'string' ? row.characterId : null,
        defeated: row.defeated === true,
        current: row.current === true,
      },
    ];
  });
}

/** Turno do encontro aberto da campanha, ou `null` quando não há encontro. */
/** A campanha tem sessão em andamento? (Jogadores só rolam e agem nela.) */
export async function isSessionInProgress(client: CodexveilClient, campaignId: string): Promise<boolean> {
  const { data, error } = await client.rpc('campaign_session_in_progress', { p_campaign_id: campaignId });
  if (error) throw toAppError(error);
  return data;
}

export async function getCampaignTurn(client: CodexveilClient, campaignId: string): Promise<CampaignTurn | null> {
  const { data, error } = await client
    .from('campaign_turns')
    .select('campaign_id, encounter_id, session_id, name, mode, status, round, active_name, active_character_id, turn_order, updated_at')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    campaignId: data.campaign_id,
    encounterId: data.encounter_id,
    sessionId: data.session_id,
    name: data.name,
    mode: (TURN_MODES as readonly string[]).includes(data.mode) ? (data.mode as TurnMode) : 'combat',
    status: data.status,
    round: data.round,
    activeName: data.active_name,
    activeCharacterId: data.active_character_id,
    order: parseOrder(data.turn_order),
    updatedAt: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Ações do turno (registradas no banco, em ordem)
// ---------------------------------------------------------------------------

export interface TurnAction {
  id: string;
  encounterId: string;
  combatantId: string;
  round: number;
  kind: TurnActionKind;
  label: string;
  grantsAction: boolean;
  actorName: string;
  targetCombatantId: string | null;
  targetName: string | null;
  targetCharacterId: string | null;
  rollTotal: number | null;
  rollId: string | null;
  createdAt: string;
}

const ACTION_COLUMNS =
  'id, encounter_id, combatant_id, round, kind, label, grants_action, actor_name, target_combatant_id, target_name, target_character_id, roll_id, roll_total, created_at' as const;

type ActionRow = Pick<
  Tables<'turn_actions'>,
  | 'id'
  | 'encounter_id'
  | 'combatant_id'
  | 'round'
  | 'kind'
  | 'label'
  | 'grants_action'
  | 'actor_name'
  | 'target_combatant_id'
  | 'target_name'
  | 'target_character_id'
  | 'roll_id'
  | 'roll_total'
  | 'created_at'
>;

function toAction(row: ActionRow): TurnAction {
  return {
    id: row.id,
    encounterId: row.encounter_id,
    combatantId: row.combatant_id,
    round: row.round,
    kind: (TURN_ACTION_KINDS as readonly string[]).includes(row.kind) ? (row.kind as TurnActionKind) : 'free',
    label: row.label,
    grantsAction: row.grants_action,
    actorName: row.actor_name,
    targetCombatantId: row.target_combatant_id,
    targetName: row.target_name,
    targetCharacterId: row.target_character_id,
    rollTotal: row.roll_total,
    rollId: row.roll_id,
    createdAt: row.created_at,
  };
}

/** Ações recentes da campanha (as mais novas primeiro). */
export async function listTurnActions(client: CodexveilClient, campaignId: string, limit = 50): Promise<TurnAction[]> {
  const { data, error } = await client
    .from('turn_actions')
    .select(ACTION_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return data.map(toAction);
}

export interface TurnActionRequest {
  combatantId: string;
  kind: TurnActionKind;
  label: string;
  targetCombatantId?: string | null;
  grantsAction?: boolean;
  /** Rolagem feita junto (ex.: ataque "1d20+5"), registrada no mural. */
  rollExpression?: string | null;
  rollMode?: DiceRollMode;
}

export async function performTurnAction(client: CodexveilClient, request: TurnActionRequest): Promise<TurnAction> {
  const { data, error } = await client.rpc('perform_turn_action', {
    p_combatant_id: request.combatantId,
    p_kind: request.kind,
    p_label: request.label,
    ...(request.targetCombatantId ? { p_target_combatant_id: request.targetCombatantId } : {}),
    p_grants_action: request.grantsAction ?? false,
    ...(request.rollExpression ? { p_roll_expression: request.rollExpression } : {}),
    p_roll_mode: request.rollMode ?? 'normal',
  });
  if (error) throw toAppError(error);
  return toAction(data);
}

/** Encerra o turno da vez (jogador dono ou mestre); devolve quem terminou e quem começa. */
export async function endTurn(
  client: CodexveilClient,
  encounterId: string,
): Promise<{ round: number; nextCombatantId: string | null; endedCombatantId: string | null }> {
  const { data, error } = await client.rpc('end_turn', { p_encounter_id: encounterId });
  if (error) throw toAppError(error);
  // O gerador de tipos não descreve funções RETURNS TABLE: a linha é conferida aqui.
  const row = (Array.isArray(data) ? data[0] : null) as { new_round?: number; next_combatant_id?: string | null; ended_combatant_id?: string | null } | null;
  return { round: row?.new_round ?? 0, nextCombatantId: row?.next_combatant_id ?? null, endedCombatantId: row?.ended_combatant_id ?? null };
}
