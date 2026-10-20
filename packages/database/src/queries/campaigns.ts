import type { CampaignRole, CampaignSettings, CampaignStatus, TurnMode, TurnOrderMode } from '@codexveil/domain';
import { AppError, TURN_MODES } from '@codexveil/domain';
import type { CampaignCreate, CampaignUpdate } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json } from '../types.gen';

export interface CampaignSummary {
  id: string;
  name: string;
  description: string;
  systemId: string;
  status: CampaignStatus;
  coverPath: string | null;
  role: CampaignRole;
  isOwner: boolean;
  memberCount: number;
  updatedAt: string;
  archivedAt: string | null;
  /** Regras de criação de personagens (JSON do módulo do sistema; leia com `parseCampaignRules`). */
  characterRules: unknown;
  /** Dono (mestre principal); os livros liberados na campanha são os dele. */
  ownerId: string;
}

/** Como os encontros novos da campanha começam (modo e ordem) e o que os jogadores veem. */
export interface CampaignTurnSettings {
  defaultMode: TurnMode;
  defaultOrder: TurnOrderMode;
  /** Jogadores veem a ordem completa dos turnos (senão, só de quem é a vez). */
  playersSeeOrder: boolean;
}

export interface CampaignDetail extends CampaignSummary {
  ownerId: string;
  ownerName: string;
  settings: CampaignSettings;
  turnSettings: CampaignTurnSettings;
  /** Ações de combate criadas pelo mestre. */
  customActions: CustomAction[];
  createdAt: string;
}

export interface CampaignMember {
  userId: string;
  role: CampaignRole;
  isOwner: boolean;
  joinedAt: string;
  displayName: string;
}

/** Campanhas das quais o usuário participa (ativas primeiro, mais recentes antes). */
export async function listMyCampaigns(client: CodexveilClient, userId: string): Promise<CampaignSummary[]> {
  const { data, error } = await client
    .from('campaigns')
    .select(
      'id, name, description, system_id, status, cover_path, owner_id, updated_at, archived_at, character_rules, members:campaign_members(count), membership:campaign_members!inner(role, user_id)',
    )
    .eq('membership.user_id', userId)
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw toAppError(error);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    systemId: row.system_id,
    status: row.status,
    coverPath: row.cover_path,
    role: row.membership[0]?.role ?? 'player',
    isOwner: row.owner_id === userId,
    memberCount: row.members[0]?.count ?? 0,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    characterRules: row.character_rules,
    ownerId: row.owner_id,
  }));
}

/** Detalhes da campanha; `null` quando não existe ou o usuário não participa (mesmo resultado). */
export async function getCampaign(
  client: CodexveilClient,
  campaignId: string,
  userId: string,
): Promise<CampaignDetail | null> {
  const { data, error } = await client
    .from('campaigns')
    .select(
      'id, name, description, system_id, status, cover_path, owner_id, party_sheets_visible, players_can_edit_sheets, default_turn_mode, default_turn_order, players_see_turn_order, custom_actions, character_rules, created_at, updated_at, archived_at, owner:profiles!campaigns_owner_id_fkey(display_name), members:campaign_members(count), membership:campaign_members!inner(role, user_id)',
    )
    .eq('id', campaignId)
    .eq('membership.user_id', userId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    systemId: data.system_id,
    status: data.status,
    coverPath: data.cover_path,
    role: data.membership[0]?.role ?? 'player',
    isOwner: data.owner_id === userId,
    memberCount: data.members[0]?.count ?? 0,
    updatedAt: data.updated_at,
    archivedAt: data.archived_at,
    characterRules: data.character_rules,
    ownerId: data.owner_id,
    ownerName: data.owner?.display_name ?? 'Mestre',
    settings: {
      partySheetsVisible: data.party_sheets_visible,
      playersCanEditSheets: data.players_can_edit_sheets,
    },
    customActions: parseCustomActions(data.custom_actions),
    turnSettings: {
      defaultMode: (TURN_MODES as readonly string[]).includes(data.default_turn_mode) ? (data.default_turn_mode as TurnMode) : 'combat',
      defaultOrder: data.default_turn_order === 'manual' ? 'manual' : 'initiative',
      playersSeeOrder: data.players_see_turn_order,
    },
    createdAt: data.created_at,
  };
}

export async function listCampaignMembers(
  client: CodexveilClient,
  campaignId: string,
  ownerId: string,
): Promise<CampaignMember[]> {
  const { data, error } = await client
    .from('campaign_members')
    .select('user_id, role, joined_at, profile:profiles(display_name)')
    .eq('campaign_id', campaignId)
    .order('joined_at', { ascending: true });
  if (error) throw toAppError(error);

  return data
    .map((row) => ({
      userId: row.user_id,
      role: row.role,
      isOwner: row.user_id === ownerId,
      joinedAt: row.joined_at,
      displayName: row.profile?.display_name ?? 'Participante',
    }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || (a.role === b.role ? 0 : a.role === 'gm' ? -1 : 1));
}

export async function createCampaign(client: CodexveilClient, input: CampaignCreate): Promise<string> {
  const { data, error } = await client
    .from('campaigns')
    .insert({
      name: input.name,
      description: input.description,
      system_id: input.systemId,
      character_rules: input.characterRules as Json,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export async function updateCampaign(
  client: CodexveilClient,
  campaignId: string,
  input: CampaignUpdate,
): Promise<void> {
  const { data, error } = await client
    .from('campaigns')
    .update({
      name: input.name,
      description: input.description,
      party_sheets_visible: input.partySheetsVisible,
      players_can_edit_sheets: input.playersCanEditSheets,
      ...(input.characterRules ? { character_rules: input.characterRules as Json } : {}),
    })
    .eq('id', campaignId)
    .select('id');
  if (error) throw toAppError(error);
  // O RLS filtra silenciosamente: nenhuma linha alterada = sem permissão (ou arquivada).
  if (data.length === 0) throw new AppError('forbidden');
}

/** Modo e ordem padrão dos encontros e se os jogadores veem a ordem completa dos turnos. */
export async function updateCampaignTurnSettings(
  client: CodexveilClient,
  campaignId: string,
  settings: CampaignTurnSettings,
): Promise<void> {
  const { data, error } = await client
    .from('campaigns')
    .update({
      default_turn_mode: settings.defaultMode,
      default_turn_order: settings.defaultOrder,
      players_see_turn_order: settings.playersSeeOrder,
    })
    .eq('id', campaignId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Caminho da capa da campanha no bucket `campaign-media` (só o mestre envia; os participantes leem). */
export function campaignCoverPath(campaignId: string, fileName: string): string {
  return `campaigns/${campaignId}/cover/${fileName}`;
}

export async function setCampaignCover(
  client: CodexveilClient,
  campaignId: string,
  coverPath: string | null,
): Promise<void> {
  const { data, error } = await client
    .from('campaigns')
    .update({ cover_path: coverPath })
    .eq('id', campaignId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

async function rpcVoid(promise: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await promise;
  if (error) throw toAppError(error);
}

export function archiveCampaign(client: CodexveilClient, campaignId: string): Promise<void> {
  return rpcVoid(client.rpc('archive_campaign', { p_campaign_id: campaignId }));
}

export function unarchiveCampaign(client: CodexveilClient, campaignId: string): Promise<void> {
  return rpcVoid(client.rpc('unarchive_campaign', { p_campaign_id: campaignId }));
}

export async function deleteCampaign(client: CodexveilClient, campaignId: string): Promise<void> {
  const { data, error } = await client.from('campaigns').delete().eq('id', campaignId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export function removeCampaignMember(
  client: CodexveilClient,
  campaignId: string,
  userId: string,
): Promise<void> {
  return rpcVoid(
    client.rpc('remove_campaign_member', { p_campaign_id: campaignId, p_user_id: userId }),
  );
}

export function leaveCampaign(client: CodexveilClient, campaignId: string): Promise<void> {
  return rpcVoid(client.rpc('leave_campaign', { p_campaign_id: campaignId }));
}

export function setCampaignMemberRole(
  client: CodexveilClient,
  campaignId: string,
  userId: string,
  role: CampaignRole,
): Promise<void> {
  return rpcVoid(
    client.rpc('set_campaign_member_role', {
      p_campaign_id: campaignId,
      p_user_id: userId,
      p_role: role,
    }),
  );
}

export function transferCampaignOwnership(
  client: CodexveilClient,
  campaignId: string,
  newOwnerId: string,
): Promise<void> {
  return rpcVoid(
    client.rpc('transfer_campaign_ownership', {
      p_campaign_id: campaignId,
      p_new_owner_id: newOwnerId,
    }),
  );
}

/** Ação de combate personalizada do mestre (aparece para os jogadores no turno). */
export interface CustomAction {
  id: string;
  name: string;
  kind: 'action' | 'bonus_action' | 'reaction' | 'movement' | 'free';
  description: string;
  /** Dado rolado ao usar (ex.: "1d20+3"); vazio = sem rolagem. */
  roll: string;
}

const CUSTOM_ACTION_KINDS = ['action', 'bonus_action', 'reaction', 'movement', 'free'] as const;

export function parseCustomActions(raw: unknown): CustomAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      id: (typeof entry.id === 'string' ? entry.id : ''),
      name: (typeof entry.name === 'string' ? entry.name : '').slice(0, 80),
      kind: (CUSTOM_ACTION_KINDS as readonly string[]).includes(String(entry.kind)) ? (entry.kind as CustomAction['kind']) : 'action',
      description: (typeof entry.description === 'string' ? entry.description : '').slice(0, 1000),
      roll: (typeof entry.roll === 'string' ? entry.roll : '').slice(0, 40),
    }))
    .filter((entry) => entry.id && entry.name);
}

/** Mestre: grava as ações de combate personalizadas da campanha. */
export async function updateCampaignCustomActions(client: CodexveilClient, campaignId: string, actions: readonly CustomAction[]): Promise<void> {
  const { data, error } = await client
    .from('campaigns')
    .update({ custom_actions: actions.slice(0, 40) as unknown as Json })
    .eq('id', campaignId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Ações de combate personalizadas da campanha (para o turno dos jogadores). */
export async function getCampaignCustomActions(client: CodexveilClient, campaignId: string): Promise<CustomAction[]> {
  const { data, error } = await client.from('campaigns').select('custom_actions').eq('id', campaignId).maybeSingle();
  if (error) throw toAppError(error);
  return parseCustomActions(data?.custom_actions);
}
