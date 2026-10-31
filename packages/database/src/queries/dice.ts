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
import { diceLookSchema, preferencesSchema, type DiceLook } from '@codexveil/validation';
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
  /** Dado escolhido para cada personagem (quando o dono vinculou um dos dados salvos). */
  characterLooks: Record<string, DiceLook>;
  /** URL assinada da face do dado de cada personagem. */
  characterImageUrls: Record<string, string>;
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
    // Nome e dono de todos os personagens, mesmo com fichas ocultas.
    client.rpc('list_party_faces', { p_campaign_id: campaignId }),
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
        color: null,
      },
    ]),
  );
  const faces = (characters.data ?? []) as { id: string; owner_id: string; dice_id: string | null }[];
  const diceIds = [...new Set(faces.flatMap((face) => (face.dice_id ? [face.dice_id] : [])))];
  const saved = diceIds.length
    ? await client.from('user_dice').select(SAVED_DICE_COLUMNS).in('id', diceIds)
    : { data: [] };
  const savedById = new Map((saved.data ?? []).map((row) => [row.id, toSavedDice(row).look]));
  const characterLooks = Object.fromEntries(
    faces.flatMap((face) => {
      const look = face.dice_id ? savedById.get(face.dice_id) : undefined;
      return look ? [[face.id, look]] : [];
    }),
  );
  const signed = await signedMediaUrls(client, [
    ...Object.values(looks).map((look) => look.image),
    ...Object.values(characterLooks).map((look) => look.image),
  ]);
  const characterImageUrls = Object.fromEntries(
    Object.entries(characterLooks)
      .filter(([, look]) => look.image && signed[look.image])
      .map(([id, look]) => [id, signed[look.image!]!]),
  );
  const imageUrls = Object.fromEntries(
    Object.entries(looks)
      .filter(([, look]) => look.image && signed[look.image])
      .map(([id, look]) => [id, signed[look.image!]!]),
  );
  return {
    looks,
    imageUrls,
    characterLooks,
    characterImageUrls,
    members: (members.data ?? []).map((row) => ({
      userId: row.user_id,
      role: row.role === 'gm' ? 'gm' : 'player',
      color: row.dice_color,
    })),
    characterOwners: Object.fromEntries(faces.map((face) => [face.id, face.owner_id])),
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

/** Um dado salvo em "Meus dados" (a coleção do jogador). */
export interface SavedDice {
  id: string;
  ownerId: string;
  name: string;
  look: DiceLook;
}

const SAVED_DICE_COLUMNS = 'id, owner_id, name, image_path, number_color, font, color';

function toSavedDice(row: {
  id: string;
  owner_id: string;
  name: string;
  image_path: string | null;
  number_color: string | null;
  font: string | null;
  color: string | null;
}): SavedDice {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    look: diceLookSchema.parse({
      image: row.image_path,
      numberColor: row.number_color,
      font: row.font,
      color: row.color,
    }),
  };
}

export async function listMyDice(client: CodexveilClient, ownerId: string): Promise<SavedDice[]> {
  const { data, error } = await client
    .from('user_dice')
    .select(SAVED_DICE_COLUMNS)
    .eq('owner_id', ownerId)
    .order('created_at');
  if (error) throw toAppError(error);
  return data.map(toSavedDice);
}

/** Cria (sem `id`) ou altera um dado salvo; devolve o dado gravado. */
export async function saveDice(
  client: CodexveilClient,
  dice: { id?: string; name: string; look: DiceLook },
): Promise<SavedDice> {
  const values = {
    name: dice.name.trim().slice(0, 40) || 'Meu dado',
    image_path: dice.look.image,
    number_color: dice.look.numberColor,
    font: dice.look.font,
    color: dice.look.color,
  };
  const query = dice.id
    ? client.from('user_dice').update(values).eq('id', dice.id)
    : client.from('user_dice').insert(values);
  const { data, error } = await query.select(SAVED_DICE_COLUMNS).single();
  if (error) throw toAppError(error);
  return toSavedDice(data);
}

export async function deleteDice(client: CodexveilClient, id: string): Promise<void> {
  const { error } = await client.from('user_dice').delete().eq('id', id);
  if (error) throw toAppError(error);
}

/** Vincula um dado salvo ao personagem (ou volta ao padrão do dono com `null`). */
export async function setCharacterDice(
  client: CodexveilClient,
  characterId: string,
  diceId: string | null,
): Promise<void> {
  const { error } = await client.from('characters').update({ dice_id: diceId }).eq('id', characterId);
  if (error) throw toAppError(error);
}
