/**
 * Itens da biblioteca do mestre: criados por ele (fora do livro) ou copiados do SRD.
 *
 * Jogadores só leem os itens revelados (RLS). Entregar um item copia os dados para o
 * inventário do personagem (`character_items`), onde ele segue as regras da ficha.
 */
import { AppError, type ItemCategory, type SharedVisibility } from '@codexveil/domain';
import type { CampaignItemData } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json, Tables } from '../types.gen';

export interface CampaignItem {
  id: string;
  campaignId: string;
  name: string;
  category: ItemCategory;
  rarity: string;
  requiresAttunement: boolean;
  weight: number | null;
  value: string;
  description: string;
  /** Nome original no SRD quando o item veio do livro; `null` quando o mestre o criou. */
  srdName: string | null;
  visibility: SharedVisibility;
  updatedAt: string;
}

const ITEM_COLUMNS =
  'id, campaign_id, name, category, rarity, requires_attunement, weight, value, description, srd_name, visibility, updated_at' as const;

type ItemRow = Pick<
  Tables<'campaign_items'>,
  | 'id'
  | 'campaign_id'
  | 'name'
  | 'category'
  | 'rarity'
  | 'requires_attunement'
  | 'weight'
  | 'value'
  | 'description'
  | 'srd_name'
  | 'visibility'
  | 'updated_at'
>;

function toItem(row: ItemRow): CampaignItem {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    category: row.category,
    rarity: row.rarity,
    requiresAttunement: row.requires_attunement,
    weight: row.weight,
    value: row.value,
    description: row.description,
    srdName: row.srd_name,
    visibility: row.visibility === 'members' ? 'members' : 'gm',
    updatedAt: row.updated_at,
  };
}

export async function listCampaignItems(client: CodexveilClient, campaignId: string): Promise<CampaignItem[]> {
  const { data, error } = await client
    .from('campaign_items')
    .select(ITEM_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('name', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toItem);
}

export async function getCampaignItem(client: CodexveilClient, itemId: string): Promise<CampaignItem | null> {
  const { data, error } = await client.from('campaign_items').select(ITEM_COLUMNS).eq('id', itemId).maybeSingle();
  if (error) throw toAppError(error);
  return data ? toItem(data) : null;
}

export async function createCampaignItem(
  client: CodexveilClient,
  campaignId: string,
  input: CampaignItemData,
  options: { srdName?: string | null; data?: Json } = {},
): Promise<string> {
  const { data, error } = await client
    .from('campaign_items')
    .insert({
      campaign_id: campaignId,
      name: input.name,
      category: input.category,
      rarity: input.rarity,
      requires_attunement: input.requiresAttunement,
      weight: input.weight,
      value: input.value,
      description: input.description,
      visibility: input.visibility,
      srd_name: options.srdName ?? null,
      data: options.data ?? {},
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export async function updateCampaignItem(client: CodexveilClient, itemId: string, input: CampaignItemData): Promise<void> {
  const { data, error } = await client
    .from('campaign_items')
    .update({
      name: input.name,
      category: input.category,
      rarity: input.rarity,
      requires_attunement: input.requiresAttunement,
      weight: input.weight,
      value: input.value,
      description: input.description,
      visibility: input.visibility,
    })
    .eq('id', itemId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function setCampaignItemVisibility(
  client: CodexveilClient,
  itemId: string,
  visibility: SharedVisibility,
): Promise<void> {
  const { data, error } = await client.from('campaign_items').update({ visibility }).eq('id', itemId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function deleteCampaignItem(client: CodexveilClient, itemId: string): Promise<void> {
  const { data, error } = await client.from('campaign_items').delete().eq('id', itemId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Texto de observação gravado no inventário: raridade, sintonia e valor do item. */
export function campaignItemNotes(item: Pick<CampaignItem, 'rarity' | 'requiresAttunement' | 'value' | 'srdName'>): string {
  return [
    item.rarity,
    item.requiresAttunement ? 'Exige sintonia' : '',
    item.value ? `Valor: ${item.value}` : '',
    item.srdName ? 'SRD 5.2.1' : 'Item do mestre',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Entrega o item ao personagem: uma cópia vai para o inventário (o mestre pode alterar o
 * inventário dos personagens da própria campanha). A descrição é cortada no limite do
 * inventário (4.000 caracteres).
 */
export async function giveCampaignItem(
  client: CodexveilClient,
  item: CampaignItem,
  characterId: string,
  quantity = 1,
): Promise<void> {
  const description = item.description.length > 4000 ? `${item.description.slice(0, 3990).trimEnd()}…` : item.description;
  const { error } = await client.from('character_items').insert({
    character_id: characterId,
    name: item.name,
    category: item.category,
    quantity,
    weight: item.weight,
    description,
    notes: campaignItemNotes(item).slice(0, 2000),
    data: { campaignItemId: item.id, ...(item.srdName ? { srdName: item.srdName } : {}) },
  });
  if (error) throw toAppError(error);
}
