import type { CampaignRole, CampaignSettings, CampaignStatus } from '@codexveil/domain';
import { AppError } from '@codexveil/domain';
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
}

export interface CampaignDetail extends CampaignSummary {
  ownerId: string;
  ownerName: string;
  settings: CampaignSettings;
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
      'id, name, description, system_id, status, cover_path, owner_id, party_sheets_visible, players_can_edit_sheets, character_rules, created_at, updated_at, archived_at, owner:profiles!campaigns_owner_id_fkey(display_name), members:campaign_members(count), membership:campaign_members!inner(role, user_id)',
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
