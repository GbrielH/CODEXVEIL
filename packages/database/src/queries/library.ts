/**
 * Biblioteca de NPCs e monstros reutilizáveis da campanha.
 *
 * O perfil público (`creatures`) é visível aos jogadores somente quando o mestre o revela.
 * Estatísticas, observações e segredos ficam em `creature_gm_data`, que o RLS entrega
 * apenas a mestres — jogadores nunca recebem esses dados, nem por engano da interface.
 */
import { AppError, isTokenSize, type SharedVisibility, type TokenSize } from '@codexveil/domain';
import type { CreatureData, CreatureKind } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json, Tables } from '../types.gen';

export interface CreatureSummary {
  id: string;
  campaignId: string;
  kind: CreatureKind;
  name: string;
  subtitle: string;
  description: string;
  imagePath: string | null;
  visibility: SharedVisibility;
  /** Porte: tamanho do token na grade da sessão. */
  size: TokenSize;
  /** Partes da ficha (chaves do bloco de estatísticas) que o mestre liberou aos jogadores. */
  revealedStats: string[];
  updatedAt: string;
}

export interface CreatureGmData {
  /** Bloco de estatísticas no formato do sistema da campanha. */
  stats: Json;
  notes: string;
  secrets: string;
}

export interface CreatureDetail extends CreatureSummary {
  /** `null` para quem não é mestre (o banco não entrega esses dados). */
  gm: CreatureGmData | null;
}

const CREATURE_COLUMNS =
  'id, campaign_id, kind, name, subtitle, description, image_path, visibility, size, revealed_stats, updated_at' as const;

type CreatureRow = Pick<
  Tables<'creatures'>,
  | 'id'
  | 'campaign_id'
  | 'kind'
  | 'name'
  | 'subtitle'
  | 'description'
  | 'image_path'
  | 'visibility'
  | 'size'
  | 'revealed_stats'
  | 'updated_at'
>;

function toCreatureSummary(row: CreatureRow): CreatureSummary {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind,
    name: row.name,
    subtitle: row.subtitle,
    description: row.description,
    imagePath: row.image_path,
    visibility: row.visibility === 'members' ? 'members' : 'gm',
    size: isTokenSize(row.size) ? row.size : 'medium',
    revealedStats: row.revealed_stats,
    updatedAt: row.updated_at,
  };
}

export async function listCreatures(
  client: CodexveilClient,
  campaignId: string,
  kind?: CreatureKind,
): Promise<CreatureSummary[]> {
  let query = client.from('creatures').select(CREATURE_COLUMNS).eq('campaign_id', campaignId);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.order('name', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toCreatureSummary);
}

/** Registro com os dados do mestre quando `includeGmData` e o usuário for mestre. */
export async function getCreature(
  client: CodexveilClient,
  creatureId: string,
  includeGmData: boolean,
): Promise<CreatureDetail | null> {
  const { data, error } = await client
    .from('creatures')
    .select(CREATURE_COLUMNS)
    .eq('id', creatureId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;

  let gm: CreatureGmData | null = null;
  if (includeGmData) {
    const { data: gmRow, error: gmError } = await client
      .from('creature_gm_data')
      .select('stats, notes, secrets')
      .eq('creature_id', creatureId)
      .maybeSingle();
    if (gmError) throw toAppError(gmError);
    if (gmRow) gm = { stats: gmRow.stats, notes: gmRow.notes, secrets: gmRow.secrets };
  }
  return { ...toCreatureSummary(data), gm };
}

/** Blocos de estatísticas de vários registros (somente mestres recebem linhas). */
export async function listCreatureStats(
  client: CodexveilClient,
  creatureIds: readonly string[],
): Promise<Record<string, Json>> {
  if (creatureIds.length === 0) return {};
  const { data, error } = await client
    .from('creature_gm_data')
    .select('creature_id, stats')
    .in('creature_id', [...creatureIds]);
  if (error) throw toAppError(error);
  return Object.fromEntries(data.map((row) => [row.creature_id, row.stats]));
}

export async function createCreature(
  client: CodexveilClient,
  campaignId: string,
  input: CreatureData,
): Promise<string> {
  const { data, error } = await client
    .from('creatures')
    .insert({
      campaign_id: campaignId,
      kind: input.kind,
      name: input.name,
      subtitle: input.subtitle,
      description: input.description,
      visibility: input.visibility,
      size: input.size,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export async function updateCreature(
  client: CodexveilClient,
  creatureId: string,
  input: Omit<CreatureData, 'kind'>,
): Promise<void> {
  const { data, error } = await client
    .from('creatures')
    .update({
      name: input.name,
      subtitle: input.subtitle,
      description: input.description,
      visibility: input.visibility,
      size: input.size,
    })
    .eq('id', creatureId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function setCreatureVisibility(
  client: CodexveilClient,
  creatureId: string,
  visibility: SharedVisibility,
): Promise<void> {
  const { data, error } = await client
    .from('creatures')
    .update({ visibility })
    .eq('id', creatureId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function updateCreatureGmData(
  client: CodexveilClient,
  creatureId: string,
  input: CreatureGmData,
): Promise<void> {
  const { data, error } = await client
    .from('creature_gm_data')
    .update({ stats: input.stats, notes: input.notes, secrets: input.secrets })
    .eq('creature_id', creatureId)
    .select('creature_id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function setCreatureImage(
  client: CodexveilClient,
  creatureId: string,
  imagePath: string | null,
): Promise<void> {
  const { data, error } = await client
    .from('creatures')
    .update({ image_path: imagePath })
    .eq('id', creatureId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function deleteCreature(client: CodexveilClient, creatureId: string): Promise<void> {
  const { data, error } = await client.from('creatures').delete().eq('id', creatureId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Caminho de imagens de NPCs e monstros no bucket `campaign-media`. */
export function creatureImagePath(campaignId: string, fileName: string): string {
  return `campaigns/${campaignId}/creatures/${fileName}`;
}

/** O mestre escolhe quais partes da ficha da criatura os jogadores veem. */
export async function setCreatureRevealedStats(client: CodexveilClient, creatureId: string, keys: readonly string[]): Promise<void> {
  const { data, error } = await client
    .from('creatures')
    .update({ revealed_stats: [...new Set(keys)].slice(0, 40) })
    .eq('id', creatureId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Só as partes liberadas da ficha (para jogadores); vazio se nada foi liberado. */
export async function getCreatureRevealedStats(client: CodexveilClient, creatureId: string): Promise<Record<string, Json>> {
  const { data, error } = await client.rpc('creature_revealed_stats', { p_creature_id: creatureId });
  if (error) throw toAppError(error);
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, Json>) : {};
}
