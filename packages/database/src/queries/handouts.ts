/**
 * Revelações do mestre: informações e imagens entregues aos jogadores fora do roteiro da
 * sessão. O RLS decide quem lê (mestres sempre; jogadores só o que foi revelado para eles).
 */
import type { CodexveilClient } from '../client';
import { AppError } from '@codexveil/domain';
import { toAppError } from '../errors';
import type { Tables } from '../types.gen';

export type HandoutAudience = 'all' | 'characters';

export interface CampaignHandout {
  id: string;
  campaignId: string;
  title: string;
  body: string;
  imagePath: string | null;
  audience: HandoutAudience;
  characterIds: string[];
  isRevealed: boolean;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HandoutFields {
  title: string;
  body: string;
  audience: HandoutAudience;
  characterIds: string[];
  isRevealed: boolean;
}

const COLUMNS = 'id, campaign_id, title, body, image_path, audience, character_ids, is_revealed, revealed_at, created_at, updated_at' as const;

type Row = Pick<
  Tables<'campaign_handouts'>,
  'id' | 'campaign_id' | 'title' | 'body' | 'image_path' | 'audience' | 'character_ids' | 'is_revealed' | 'revealed_at' | 'created_at' | 'updated_at'
>;

function toHandout(row: Row): CampaignHandout {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    body: row.body,
    imagePath: row.image_path,
    audience: row.audience === 'characters' ? 'characters' : 'all',
    characterIds: row.character_ids,
    isRevealed: row.is_revealed,
    revealedAt: row.revealed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Revelações visíveis ao usuário: as mais recentes primeiro (as preparadas no fim, para o mestre). */
export async function listCampaignHandouts(client: CodexveilClient, campaignId: string): Promise<CampaignHandout[]> {
  const { data, error } = await client
    .from('campaign_handouts')
    .select(COLUMNS)
    .eq('campaign_id', campaignId)
    .order('revealed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return data.map(toHandout);
}

function payload(fields: HandoutFields) {
  return {
    title: fields.title.trim(),
    body: fields.body,
    audience: fields.audience,
    character_ids: fields.audience === 'characters' ? fields.characterIds : [],
    is_revealed: fields.isRevealed,
  };
}

export async function createCampaignHandout(client: CodexveilClient, campaignId: string, fields: HandoutFields): Promise<CampaignHandout> {
  const { data, error } = await client
    .from('campaign_handouts')
    .insert({ campaign_id: campaignId, ...payload(fields) })
    .select(COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toHandout(data);
}

export async function updateCampaignHandout(client: CodexveilClient, handoutId: string, fields: HandoutFields): Promise<CampaignHandout> {
  const { data, error } = await client.from('campaign_handouts').update(payload(fields)).eq('id', handoutId).select(COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toHandout(row);
}

/** Revela agora (ou volta a esconder) sem mexer no resto. */
export async function setCampaignHandoutRevealed(client: CodexveilClient, handoutId: string, revealed: boolean): Promise<CampaignHandout> {
  const { data, error } = await client.from('campaign_handouts').update({ is_revealed: revealed }).eq('id', handoutId).select(COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toHandout(row);
}

export async function deleteCampaignHandout(client: CodexveilClient, handoutId: string): Promise<void> {
  const { data, error } = await client.from('campaign_handouts').delete().eq('id', handoutId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Caminho da imagem no bucket `campaign-media` (formato exigido pelas policies). */
export function handoutImagePath(campaignId: string, handoutId: string, fileName: string): string {
  return `campaigns/${campaignId}/handouts/${handoutId}/${fileName}`;
}

export async function setCampaignHandoutImage(client: CodexveilClient, handoutId: string, imagePath: string | null): Promise<void> {
  const { data, error } = await client.from('campaign_handouts').update({ image_path: imagePath }).eq('id', handoutId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}
