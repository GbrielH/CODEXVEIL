/**
 * Resumo do turno visível aos jogadores (`campaign_turns`), mantido por gatilhos a partir do
 * encontro aberto. Os encontros continuam exclusivos do mestre; aqui só chegam o modo, a
 * rodada, de quem é a vez e a ordem (sem os participantes ocultos).
 */
import { TURN_MODES, type TurnMode } from '@codexveil/domain';
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
