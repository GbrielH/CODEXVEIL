/**
 * Grade da sessão (docs/GRID.md): mapas, tokens, névoa e paredes. O mestre monta tudo; os
 * jogadores recebem do banco só o mapa ativo e os tokens visíveis, e movem o próprio token por
 * `move_my_token`.
 */
import { AppError, isMapArea, isMapDrawing, isTokenSize, isWallStyle, type MapArea, type MapDrawing, type TokenSize, type WallStyle } from '@codexveil/domain';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json, Tables } from '../types.gen';

/** Retângulo revelado da névoa: [x, y, largura, altura] em quadrados. */
export type FogRect = [number, number, number, number];
/** Parede: [x1, y1, x2, y2] em quadrados e o estilo (pedra, tijolo, ruína…). */
export type Wall = [number, number, number, number, WallStyle];

/** Uma imagem (camada) do mapa: posição e largura em quadrados; a altura segue a proporção. */
export interface MapImage {
  path: string;
  x: number;
  y: number;
  width: number;
}

export interface SessionMap {
  id: string;
  campaignId: string;
  sessionId: string;
  name: string;
  imagePath: string | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  cols: number;
  rows: number;
  showGrid: boolean;
  fogEnabled: boolean;
  fogRevealed: FogRect[];
  lineOfSight: boolean;
  walls: Wall[];
  isActive: boolean;
  /** A névoa se abre sozinha onde os tokens dos jogadores enxergam (calculado na tela do mestre). */
  fogAutoReveal: boolean;
  /** Áreas de magia colocadas pelo mestre (todos veem). */
  areas: MapArea[];
  /** Desenhos e anotações visíveis a todos. */
  drawings: MapDrawing[];
  /** Imagens do mapa, da de baixo para a de cima. */
  images: MapImage[];
}

export type MapTokenKind = 'character' | 'creature' | 'marker';

export interface MapToken {
  id: string;
  mapId: string;
  campaignId: string;
  kind: MapTokenKind;
  characterId: string | null;
  creatureId: string | null;
  label: string;
  x: number;
  y: number;
  size: TokenSize;
  isHidden: boolean;
  visionRadius: number;
  /** Imagem enviada pelo mestre para o token (tem prioridade sobre foto/imagem da criatura). */
  imagePath: string | null;
}

const MAP_COLUMNS =
  'id, campaign_id, session_id, name, image_path, image_scale, image_offset_x, image_offset_y, cols, rows, show_grid, fog_enabled, fog_revealed, line_of_sight, walls, is_active, fog_auto_reveal, areas, drawings, images' as const;
const TOKEN_COLUMNS = 'id, map_id, campaign_id, kind, character_id, creature_id, label, x, y, size, is_hidden, vision_radius, image_path' as const;

type MapRow = Pick<Tables<'session_maps'>, 'id' | 'campaign_id' | 'session_id' | 'name' | 'image_path' | 'image_scale' | 'image_offset_x' | 'image_offset_y' | 'cols' | 'rows' | 'show_grid' | 'fog_enabled' | 'fog_revealed' | 'line_of_sight' | 'walls' | 'is_active' | 'fog_auto_reveal' | 'areas' | 'drawings' | 'images'>;
type TokenRow = Pick<Tables<'map_tokens'>, 'id' | 'map_id' | 'campaign_id' | 'kind' | 'character_id' | 'creature_id' | 'label' | 'x' | 'y' | 'size' | 'is_hidden' | 'vision_radius' | 'image_path'>;

function quads(value: Json): [number, number, number, number][] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    Array.isArray(entry) && entry.length === 4 && entry.every((n) => typeof n === 'number') ? [entry as [number, number, number, number]] : [],
  );
}

/** Paredes antigas (sem estilo) viram pedra. */
function walls(value: Json): Wall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Wall[] => {
    if (!Array.isArray(entry) || entry.length < 4) return [];
    const [x1, y1, x2, y2, style] = entry;
    if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number') return [];
    return [[x1, y1, x2, y2, isWallStyle(style) ? style : 'stone']];
  });
}

function mapImages(value: Json): MapImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): MapImage[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { path, x, y, width } = entry as Record<string, unknown>;
    return typeof path === 'string' && typeof x === 'number' && typeof y === 'number' && typeof width === 'number' ? [{ path, x, y, width }] : [];
  });
}

function toMap(row: MapRow): SessionMap {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    name: row.name,
    imagePath: row.image_path,
    imageScale: row.image_scale,
    imageOffsetX: row.image_offset_x,
    imageOffsetY: row.image_offset_y,
    cols: row.cols,
    rows: row.rows,
    showGrid: row.show_grid,
    fogEnabled: row.fog_enabled,
    fogRevealed: quads(row.fog_revealed),
    lineOfSight: row.line_of_sight,
    walls: walls(row.walls),
    isActive: row.is_active,
    fogAutoReveal: row.fog_auto_reveal,
    areas: Array.isArray(row.areas) ? row.areas.filter(isMapArea) : [],
    drawings: Array.isArray(row.drawings) ? row.drawings.filter(isMapDrawing) : [],
    images: mapImages(row.images),
  };
}

function toToken(row: TokenRow): MapToken {
  return {
    id: row.id,
    mapId: row.map_id,
    campaignId: row.campaign_id,
    kind: row.kind === 'character' || row.kind === 'creature' ? row.kind : 'marker',
    characterId: row.character_id,
    creatureId: row.creature_id,
    label: row.label,
    x: row.x,
    y: row.y,
    size: isTokenSize(row.size) ? row.size : 'medium',
    isHidden: row.is_hidden,
    visionRadius: row.vision_radius,
    imagePath: row.image_path,
  };
}

/** Caminho da imagem de um mapa no bucket `campaign-media`. */
export function campaignMapPath(campaignId: string, fileName: string): string {
  return `campaigns/${campaignId}/maps/${fileName}`;
}

/** Todos os mapas da campanha (mestre), por sessão e data de criação. */
export async function listCampaignMaps(client: CodexveilClient, campaignId: string): Promise<SessionMap[]> {
  const { data, error } = await client.from('session_maps').select(MAP_COLUMNS).eq('campaign_id', campaignId).order('created_at');
  if (error) throw toAppError(error);
  return (data ?? []).map(toMap);
}

/** Mapas de uma sessão (mestre). */
export async function listSessionMaps(client: CodexveilClient, sessionId: string): Promise<SessionMap[]> {
  const { data, error } = await client.from('session_maps').select(MAP_COLUMNS).eq('session_id', sessionId).order('created_at');
  if (error) throw toAppError(error);
  return (data ?? []).map(toMap);
}

/** Mapa ativo da campanha (o que os jogadores veem), ou null. */
export async function getActiveMap(client: CodexveilClient, campaignId: string): Promise<SessionMap | null> {
  const { data, error } = await client.from('session_maps').select(MAP_COLUMNS).eq('campaign_id', campaignId).eq('is_active', true).maybeSingle();
  if (error) throw toAppError(error);
  return data ? toMap(data) : null;
}

export async function getSessionMap(client: CodexveilClient, mapId: string): Promise<SessionMap | null> {
  const { data, error } = await client.from('session_maps').select(MAP_COLUMNS).eq('id', mapId).maybeSingle();
  if (error) throw toAppError(error);
  return data ? toMap(data) : null;
}

export async function createSessionMap(client: CodexveilClient, input: { campaignId: string; sessionId: string; name: string; cols?: number; rows?: number }): Promise<string> {
  const { data, error } = await client
    .from('session_maps')
    .insert({ campaign_id: input.campaignId, session_id: input.sessionId, name: input.name, cols: input.cols ?? 30, rows: input.rows ?? 20 })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export type SessionMapPatch = Partial<Pick<SessionMap, 'name' | 'imagePath' | 'imageScale' | 'imageOffsetX' | 'imageOffsetY' | 'cols' | 'rows' | 'showGrid' | 'fogEnabled' | 'fogRevealed' | 'lineOfSight' | 'walls' | 'fogAutoReveal' | 'areas' | 'drawings' | 'images'>>;

export async function updateSessionMap(client: CodexveilClient, mapId: string, patch: SessionMapPatch): Promise<void> {
  const update: Partial<Tables<'session_maps'>> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.imagePath !== undefined) update.image_path = patch.imagePath;
  if (patch.imageScale !== undefined) update.image_scale = patch.imageScale;
  if (patch.imageOffsetX !== undefined) update.image_offset_x = patch.imageOffsetX;
  if (patch.imageOffsetY !== undefined) update.image_offset_y = patch.imageOffsetY;
  if (patch.cols !== undefined) update.cols = patch.cols;
  if (patch.rows !== undefined) update.rows = patch.rows;
  if (patch.showGrid !== undefined) update.show_grid = patch.showGrid;
  if (patch.fogEnabled !== undefined) update.fog_enabled = patch.fogEnabled;
  if (patch.fogRevealed !== undefined) update.fog_revealed = patch.fogRevealed;
  if (patch.lineOfSight !== undefined) update.line_of_sight = patch.lineOfSight;
  if (patch.walls !== undefined) update.walls = patch.walls;
  if (patch.fogAutoReveal !== undefined) update.fog_auto_reveal = patch.fogAutoReveal;
  if (patch.areas !== undefined) update.areas = patch.areas;
  if (patch.images !== undefined) update.images = patch.images as unknown as Json;
  if (patch.drawings !== undefined) update.drawings = patch.drawings;
  const { data, error } = await client.from('session_maps').update(update).eq('id', mapId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Ativa um mapa (desativa o que estava ativo na campanha) ou desativa todos (`mapId` null). */
export async function setActiveMap(client: CodexveilClient, campaignId: string, mapId: string | null): Promise<void> {
  const off = await client.from('session_maps').update({ is_active: false }).eq('campaign_id', campaignId).eq('is_active', true);
  if (off.error) throw toAppError(off.error);
  if (!mapId) return;
  const { data, error } = await client.from('session_maps').update({ is_active: true }).eq('id', mapId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function deleteSessionMap(client: CodexveilClient, mapId: string): Promise<void> {
  const { error } = await client.from('session_maps').delete().eq('id', mapId);
  if (error) throw toAppError(error);
}

export async function listMapTokens(client: CodexveilClient, mapId: string): Promise<MapToken[]> {
  const { data, error } = await client.from('map_tokens').select(TOKEN_COLUMNS).eq('map_id', mapId).order('created_at');
  if (error) throw toAppError(error);
  return (data ?? []).map(toToken);
}

export async function addMapToken(
  client: CodexveilClient,
  input: { mapId: string; campaignId: string; kind: MapTokenKind; characterId?: string | null; creatureId?: string | null; label: string; x: number; y: number; size: TokenSize; isHidden?: boolean },
): Promise<string> {
  const { data, error } = await client
    .from('map_tokens')
    .insert({
      map_id: input.mapId,
      campaign_id: input.campaignId,
      kind: input.kind,
      character_id: input.characterId ?? null,
      creature_id: input.creatureId ?? null,
      label: input.label,
      x: input.x,
      y: input.y,
      size: input.size,
      is_hidden: input.isHidden ?? false,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

export async function updateMapToken(client: CodexveilClient, tokenId: string, patch: Partial<Pick<MapToken, 'label' | 'x' | 'y' | 'size' | 'isHidden' | 'visionRadius' | 'imagePath'>>): Promise<void> {
  const update: Partial<Tables<'map_tokens'>> = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.x !== undefined) update.x = patch.x;
  if (patch.y !== undefined) update.y = patch.y;
  if (patch.size !== undefined) update.size = patch.size;
  if (patch.isHidden !== undefined) update.is_hidden = patch.isHidden;
  if (patch.visionRadius !== undefined) update.vision_radius = patch.visionRadius;
  if (patch.imagePath !== undefined) update.image_path = patch.imagePath;
  const { data, error } = await client.from('map_tokens').update(update).eq('id', tokenId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function deleteMapToken(client: CodexveilClient, tokenId: string): Promise<void> {
  const { error } = await client.from('map_tokens').delete().eq('id', tokenId);
  if (error) throw toAppError(error);
}

/**
 * Caminho da imagem de cada token: a enviada pelo mestre, a foto do personagem ou a imagem da
 * criatura (para jogadores, só de criaturas reveladas: o RLS não entrega as outras).
 */
export async function tokenImagePaths(client: CodexveilClient, tokens: readonly MapToken[]): Promise<Record<string, string>> {
  const characterIds = [...new Set(tokens.filter((token) => !token.imagePath && token.characterId).map((token) => token.characterId!))];
  const creatureIds = [...new Set(tokens.filter((token) => !token.imagePath && token.creatureId).map((token) => token.creatureId!))];
  const [characters, creatures] = await Promise.all([
    characterIds.length ? client.from('characters').select('id, portrait_path, token_path').in('id', characterIds) : Promise.resolve({ data: [] as { id: string; portrait_path: string | null; token_path: string | null }[], error: null }),
    creatureIds.length ? client.from('creatures').select('id, image_path').in('id', creatureIds) : Promise.resolve({ data: [] as { id: string; image_path: string | null }[], error: null }),
  ]);
  if (characters.error) throw toAppError(characters.error);
  if (creatures.error) throw toAppError(creatures.error);
  // Imagem de token do personagem; sem ela, o retrato.
  const portraits = new Map((characters.data ?? []).map((row) => [row.id, row.token_path ?? row.portrait_path]));
  const images = new Map((creatures.data ?? []).map((row) => [row.id, row.image_path]));
  const result: Record<string, string> = {};
  for (const token of tokens) {
    const path = token.imagePath ?? (token.characterId ? portraits.get(token.characterId) : null) ?? (token.creatureId ? images.get(token.creatureId) : null) ?? null;
    if (path) result[token.id] = path;
  }
  return result;
}

/** Desenhos e anotações só do mestre (o banco não entrega aos jogadores). */
export async function getMapSecrets(client: CodexveilClient, mapId: string): Promise<MapDrawing[]> {
  const { data, error } = await client.from('session_map_secrets').select('drawings').eq('map_id', mapId).maybeSingle();
  if (error) throw toAppError(error);
  return data && Array.isArray(data.drawings) ? data.drawings.filter(isMapDrawing) : [];
}

export async function saveMapSecrets(client: CodexveilClient, mapId: string, campaignId: string, drawings: MapDrawing[]): Promise<void> {
  const { error } = await client
    .from('session_map_secrets')
    .upsert({ map_id: mapId, campaign_id: campaignId, drawings: drawings as unknown as Json }, { onConflict: 'map_id' });
  if (error) throw toAppError(error);
}

/** Jogador move o token do próprio personagem (validado no banco). */
export async function moveMyToken(client: CodexveilClient, tokenId: string, x: number, y: number): Promise<void> {
  const { error } = await client.rpc('move_my_token', { p_token_id: tokenId, p_x: x, p_y: y });
  if (error) throw toAppError(error);
}

/** Em combate, o mapa mostrado acompanha de quem é a vez? (opção da campanha) */
export async function getMapFollowsTurn(client: CodexveilClient, campaignId: string): Promise<boolean> {
  const { data, error } = await client.from('campaigns').select('map_follows_turn').eq('id', campaignId).maybeSingle();
  if (error) throw toAppError(error);
  return data?.map_follows_turn ?? true;
}

export async function setMapFollowsTurn(client: CodexveilClient, campaignId: string, value: boolean): Promise<void> {
  const { data, error } = await client.from('campaigns').update({ map_follows_turn: value }).eq('id', campaignId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Mapas (da campanha) em que o personagem tem token: para seguir o turno no combate. */
export async function mapsWithCharacter(client: CodexveilClient, campaignId: string, characterId: string): Promise<string[]> {
  const { data, error } = await client.from('map_tokens').select('map_id').eq('campaign_id', campaignId).eq('character_id', characterId);
  if (error) throw toAppError(error);
  return [...new Set((data ?? []).map((row) => row.map_id))];
}
