/**
 * Rolagens de dados das campanhas. O sorteio acontece no banco (`roll_dice`); os clientes só
 * enviam a expressão e leem o resultado. Rolagens secretas (`gm`) só aparecem para quem rolou
 * e para os mestres (RLS), inclusive no Realtime.
 */
import { AppError, type DiceRollMode, type RolledDiceGroup, type SharedVisibility } from '@codexveil/domain';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Tables } from '../types.gen';

export interface DiceRoll {
  id: string;
  campaignId: string;
  userId: string;
  characterId: string | null;
  rollerName: string;
  label: string;
  expression: string;
  mode: DiceRollMode;
  dice: RolledDiceGroup[];
  modifier: number;
  total: number;
  visibility: SharedVisibility;
  createdAt: string;
}

export interface DiceRollRequest {
  campaignId: string;
  expression: string;
  label?: string;
  mode?: DiceRollMode;
  /** `gm` = rolagem secreta (só o mestre vê). */
  visibility?: SharedVisibility;
  characterId?: string | null;
}

const ROLL_COLUMNS =
  'id, campaign_id, user_id, character_id, roller_name, label, expression, mode, dice, modifier, total, visibility, created_at' as const;

type RollRow = Pick<
  Tables<'dice_rolls'>,
  | 'id'
  | 'campaign_id'
  | 'user_id'
  | 'character_id'
  | 'roller_name'
  | 'label'
  | 'expression'
  | 'mode'
  | 'dice'
  | 'modifier'
  | 'total'
  | 'visibility'
  | 'created_at'
>;

function parseGroups(value: unknown): RolledDiceGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RolledDiceGroup[] => {
    if (!entry || typeof entry !== 'object') return [];
    const group = entry as Record<string, unknown>;
    const numbers = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is number => typeof item === 'number') : []);
    return [
      {
        sign: group.sign === -1 ? -1 : 1,
        count: typeof group.count === 'number' ? group.count : 0,
        sides: typeof group.sides === 'number' ? group.sides : 0,
        values: numbers(group.values),
        kept: numbers(group.kept),
      },
    ];
  });
}

function toRoll(row: RollRow): DiceRoll {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    characterId: row.character_id,
    rollerName: row.roller_name,
    label: row.label,
    expression: row.expression,
    mode: row.mode === 'advantage' || row.mode === 'disadvantage' ? row.mode : 'normal',
    dice: parseGroups(row.dice),
    modifier: row.modifier,
    total: row.total,
    visibility: row.visibility === 'gm' ? 'gm' : 'members',
    createdAt: row.created_at,
  };
}

/** Rola no servidor e devolve o resultado gravado. */
export async function rollDice(client: CodexveilClient, request: DiceRollRequest): Promise<DiceRoll> {
  const { data, error } = await client.rpc('roll_dice', {
    p_campaign_id: request.campaignId,
    p_expression: request.expression,
    p_label: request.label ?? '',
    p_mode: request.mode ?? 'normal',
    p_visibility: request.visibility ?? 'members',
    ...(request.characterId ? { p_character_id: request.characterId } : {}),
  });
  if (error) throw toAppError(error);
  if (!data) throw new AppError('unknown');
  return toRoll(data);
}

/** Rolagens mais recentes da campanha que o usuário pode ver (as mais novas primeiro). */
export async function listDiceRolls(client: CodexveilClient, campaignId: string, limit = 50): Promise<DiceRoll[]> {
  const { data, error } = await client
    .from('dice_rolls')
    .select(ROLL_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return data.map(toRoll);
}

/** Apaga todas as rolagens da campanha (só mestres). */
export async function clearDiceRolls(client: CodexveilClient, campaignId: string): Promise<void> {
  const { error } = await client.from('dice_rolls').delete().eq('campaign_id', campaignId);
  if (error) throw toAppError(error);
}
