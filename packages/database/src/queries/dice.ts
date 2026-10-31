/**
 * Rolagens de dados das campanhas. O sorteio acontece no banco (`roll_dice`); os clientes só
 * enviam a expressão e leem o resultado. Rolagens secretas (`gm`) só aparecem para quem rolou
 * e para os mestres (RLS), inclusive no Realtime.
 */
import {
  AppError,
  type DiceRollMode,
  type RolledDiceGroup,
  type SharedVisibility,
} from '@codexveil/domain';
import { preferencesSchema, type DiceLook } from '@codexveil/validation';
import { signedMediaUrls } from './storage';
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
    const numbers = (list: unknown) =>
      Array.isArray(list) ? list.filter((item): item is number => typeof item === 'number') : [];
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
export async function rollDice(
  client: CodexveilClient,
  request: DiceRollRequest,
): Promise<DiceRoll> {
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
export async function listDiceRolls(
  client: CodexveilClient,
  campaignId: string,
  limit = 50,
): Promise<DiceRoll[]> {
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

/** Cor dos dados 3D de cada participante da campanha (id do usuário → #rrggbb). */
export async function listCampaignDiceColors(
  client: CodexveilClient,
  campaignId: string,
): Promise<Record<string, string>> {
  const { data, error } = await client
    .from('campaign_members')
    .select('user_id, dice_color')
    .eq('campaign_id', campaignId);
  if (error) throw toAppError(error);
  return Object.fromEntries(
    (data ?? [])
      .filter((row) => row.dice_color)
      .map((row) => [row.user_id, row.dice_color as string]),
  );
}

export interface DicePalette {
  members: { userId: string; role: 'gm' | 'player'; color: string | null }[];
  /** Personagem da campanha → dono (para pintar o nome com a cor do dono). */
  characterOwners: Record<string, string>;
  /** Aparência dos dados 3D de cada participante ("Meus dados" do Perfil). */
  looks: Record<string, DiceLook>;
  /** URL assinada da face desenhada de cada participante (pela chave do usuário). */
  imageUrls: Record<string, string>;
}

/** Cores de todos os participantes e os donos dos personagens da campanha. */
export async function getCampaignDicePalette(
  client: CodexveilClient,
  campaignId: string,
): Promise<DicePalette> {
  const [members, characters] = await Promise.all([
    client
      .from('campaign_members')
      .select('user_id, role, dice_color')
      .eq('campaign_id', campaignId),
    client.from('characters').select('id, owner_id').eq('campaign_id', campaignId),
  ]);
  if (members.error) throw toAppError(members.error);
  if (characters.error) throw toAppError(characters.error);
  // Face desenhada, cor e fonte dos números de cada um (perfis dos colegas de campanha são legíveis).
  const ids = (members.data ?? []).map((row) => row.user_id);
  const profiles = ids.length
    ? await client.from('profiles').select('id, preferences').in('id', ids)
    : { data: [] };
  const looks = Object.fromEntries(
    (profiles.data ?? []).map((row) => [
      row.id,
      preferencesSchema.safeParse(row.preferences).data?.dice ?? {
        image: null,
        numberColor: null,
        font: null,
      },
    ]),
  );
  const signed = await signedMediaUrls(
    client,
    Object.values(looks).map((look) => look.image),
  );
  const imageUrls = Object.fromEntries(
    Object.entries(looks)
      .filter(([, look]) => look.image && signed[look.image])
      .map(([id, look]) => [id, signed[look.image!]!]),
  );
  return {
    looks,
    imageUrls,
    members: (members.data ?? []).map((row) => ({
      userId: row.user_id,
      role: row.role === 'gm' ? 'gm' : 'player',
      color: row.dice_color,
    })),
    characterOwners: Object.fromEntries(
      (characters.data ?? []).map((row) => [row.id, row.owner_id]),
    ),
  };
}

/** Escolhe a cor dos próprios dados nesta campanha. */
export async function setMyDiceColor(
  client: CodexveilClient,
  campaignId: string,
  color: string,
): Promise<void> {
  const { error } = await client.rpc('set_my_dice_color', {
    p_campaign_id: campaignId,
    p_color: color,
  });
  if (error) throw toAppError(error);
}
