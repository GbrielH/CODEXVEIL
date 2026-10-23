/**
 * Acesso a dados de personagens e fichas.
 *
 * As regras de permissão são aplicadas pelo banco (RLS); estas funções apenas traduzem
 * linhas em objetos da aplicação e convertem "nenhuma linha afetada" no erro correto
 * (conflito de versão, sem permissão ou não encontrado).
 */
import {
  AppError,
  type CampaignMembership,
  type CampaignSettings,
  type CampaignStatus,
  type CharacterAccessInput,
  type ItemCategory,
  type ResourceRecovery,
  type RestKind,
  type TrackOperation,
} from '@codexveil/domain';
import type { AbilityEntryKind, InventoryItemData } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json, Tables } from '../types.gen';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CharacterCampaignRef {
  id: string;
  name: string;
  status: CampaignStatus;
  ownerId: string;
  settings: CampaignSettings;
}

export interface CharacterDetail {
  id: string;
  ownerId: string;
  ownerName: string;
  systemId: string;
  name: string;
  portraitPath: string | null;
  /** Imagem do token no mapa (sem ela, o mapa usa o retrato). */
  tokenPath: string | null;
  /** Ficha bruta; valide com o módulo do sistema (`findSystem(systemId).parseSheet`). */
  sheet: unknown;
  version: number;
  updatedAt: string;
  liveUpdatedAt: string;
  /** Nível liberado pelo mestre (campanha); 0 = nenhum. */
  grantedLevel: number;
  campaign: CharacterCampaignRef | null;
  /** Relação de quem está consultando com o personagem. */
  viewer: { isOwner: boolean; membership: CampaignMembership | null };
}

export type ResourceDisplay = 'health' | 'pool' | 'checkboxes';

export interface CharacterResource {
  id: string;
  key: string;
  label: string;
  current: number;
  max: number | null;
  temp: number;
  recovery: ResourceRecovery;
  display: ResourceDisplay;
  sortOrder: number;
}

export interface CharacterCondition {
  id: string;
  key: string;
  level: number | null;
  note: string;
  /** Rodadas restantes; `null` = dura até ser removida. */
  roundsRemaining: number | null;
}

export interface CharacterItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  weight: number | null;
  description: string;
  notes: string;
  isEquipped: boolean;
  sortOrder: number;
}

export interface CharacterAbility {
  id: string;
  kind: AbilityEntryKind;
  name: string;
  source: string;
  description: string;
  /** Dados específicos do sistema (ex.: círculo da magia, bônus do ataque). */
  data: Json;
  resourceId: string | null;
  sortOrder: number;
}

export const CHARACTER_EVENT_KINDS = [
  'level_up',
  'experience',
  'ability_change',
  'milestone',
  'note',
] as const;
export type CharacterEventKind = (typeof CHARACTER_EVENT_KINDS)[number];

export const characterEventKindLabels: Record<CharacterEventKind, string> = {
  level_up: 'Subiu de nível',
  experience: 'Experiência',
  ability_change: 'Mudança de atributos',
  milestone: 'Marco',
  note: 'Registro',
};

export interface CharacterEvent {
  id: string;
  kind: CharacterEventKind;
  summary: string;
  occurredAt: string;
  actorName: string | null;
}

export interface CharacterSnapshot {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  sheet: Json;
}

/** Linha resumida usada em listas (grupo da campanha, painel do mestre). */
export interface PartyCharacter {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  systemId: string;
  portraitPath: string | null;
  sheet: unknown;
  liveUpdatedAt: string;
  resources: CharacterResource[];
  conditions: CharacterCondition[];
}

// ---------------------------------------------------------------------------
// Mapeamentos
// ---------------------------------------------------------------------------

type ResourceRow = Pick<
  Tables<'character_resources'>,
  'id' | 'key' | 'label' | 'current' | 'max' | 'temp' | 'recovery' | 'display' | 'sort_order'
>;

const RESOURCE_COLUMNS = 'id, key, label, current, max, temp, recovery, display, sort_order' as const;

function isResourceDisplay(value: string): value is ResourceDisplay {
  return value === 'health' || value === 'pool' || value === 'checkboxes';
}

export function toCharacterResource(row: ResourceRow): CharacterResource {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    current: row.current,
    max: row.max,
    temp: row.temp,
    recovery: row.recovery,
    display: isResourceDisplay(row.display) ? row.display : 'pool',
    sortOrder: row.sort_order,
  };
}

function byResourceOrder(a: CharacterResource, b: CharacterResource): number {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'pt-BR');
}

const CONDITION_COLUMNS = 'id, key, level, note, rounds_remaining' as const;

type ConditionRow = Pick<
  Tables<'character_conditions'>,
  'id' | 'key' | 'level' | 'note' | 'rounds_remaining'
>;

function toCharacterCondition(row: ConditionRow): CharacterCondition {
  return {
    id: row.id,
    key: row.key,
    level: row.level,
    note: row.note,
    roundsRemaining: row.rounds_remaining,
  };
}

const ITEM_COLUMNS =
  'id, name, category, quantity, weight, description, notes, is_equipped, sort_order' as const;

type ItemRow = Pick<
  Tables<'character_items'>,
  | 'id'
  | 'name'
  | 'category'
  | 'quantity'
  | 'weight'
  | 'description'
  | 'notes'
  | 'is_equipped'
  | 'sort_order'
>;

function toCharacterItem(row: ItemRow): CharacterItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    // PostgREST pode devolver `numeric` como texto dependendo da configuração.
    weight: row.weight === null ? null : Number(row.weight),
    description: row.description,
    notes: row.notes,
    isEquipped: row.is_equipped,
    sortOrder: row.sort_order,
  };
}

const ABILITY_COLUMNS = 'id, kind, name, source, description, data, resource_id, sort_order' as const;

type AbilityRow = Pick<
  Tables<'character_abilities'>,
  'id' | 'kind' | 'name' | 'source' | 'description' | 'data' | 'resource_id' | 'sort_order'
>;

function toCharacterAbility(row: AbilityRow): CharacterAbility {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    source: row.source,
    description: row.description,
    data: row.data,
    resourceId: row.resource_id,
    sortOrder: row.sort_order,
  };
}

function isEventKind(value: string): value is CharacterEventKind {
  return (CHARACTER_EVENT_KINDS as readonly string[]).includes(value);
}

/** Converte o resultado em `CharacterAccessInput` para as regras de @codexveil/domain. */
export function characterAccessInput(character: CharacterDetail): CharacterAccessInput {
  return {
    isCharacterOwner: character.viewer.isOwner,
    membership: character.viewer.membership,
    campaignStatus: character.campaign?.status ?? null,
    settings: character.campaign?.settings ?? {
      partySheetsVisible: false,
      playersCanEditSheets: true,
    },
  };
}

/** Lança `forbidden` quando o RLS filtrou silenciosamente a alteração. */
function assertChanged(rows: unknown[]): void {
  if (rows.length === 0) throw new AppError('forbidden');
}

// ---------------------------------------------------------------------------
// Personagens
// ---------------------------------------------------------------------------

export interface CharacterCreateParams {
  name: string;
  systemId: string;
  campaignId: string | null;
  /** Ficha já validada pelo módulo do sistema (objeto serializável em JSON). */
  sheet: unknown;
  resources: readonly {
    key: string;
    label: string;
    current: number;
    max: number | null;
    recovery: ResourceRecovery;
    display: ResourceDisplay;
    sortOrder: number;
  }[];
  /** Inventário inicial (peso unitário na unidade da ficha). */
  items?: readonly {
    name: string;
    category: ItemCategory;
    quantity: number;
    weight: number | null;
    description: string;
    notes: string;
    isEquipped: boolean;
    sortOrder: number;
  }[];
  /** Habilidades, magias e ataques iniciais; `resourceKey` liga a entrada a uma trilha criada junto. */
  abilities?: readonly {
    kind: AbilityEntryKind;
    name: string;
    source: string;
    description: string;
    data: Record<string, unknown>;
    resourceKey?: string;
    sortOrder: number;
  }[];
}

/**
 * Cria o personagem com trilhas, inventário e habilidades iniciais numa única transação
 * (função do banco).
 */
export async function createCharacter(
  client: CodexveilClient,
  params: CharacterCreateParams,
): Promise<string> {
  const { data, error } = await client.rpc('create_character', {
    p_name: params.name,
    p_system_id: params.systemId,
    ...(params.campaignId ? { p_campaign_id: params.campaignId } : {}),
    p_sheet: params.sheet as Json,
    p_resources: params.resources as unknown as Json,
    ...(params.items?.length ? { p_items: params.items as unknown as Json } : {}),
    ...(params.abilities?.length ? { p_abilities: params.abilities as unknown as Json } : {}),
  });
  if (error) throw toAppError(error);
  return data;
}

/**
 * Personagem com dados da campanha e a relação do usuário atual com ele. Personagens
 * inexistentes e personagens que o usuário não pode ver produzem o mesmo `null`.
 */
export async function getCharacter(
  client: CodexveilClient,
  characterId: string,
  userId: string,
): Promise<CharacterDetail | null> {
  const { data, error } = await client
    .from('characters')
    .select(
      'id, owner_id, campaign_id, system_id, name, portrait_path, token_path, sheet, version, updated_at, live_updated_at, granted_level, owner:profiles!characters_owner_id_fkey(display_name), campaign:campaigns(id, name, status, owner_id, party_sheets_visible, players_can_edit_sheets)',
    )
    .eq('id', characterId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;

  let membership: CampaignMembership | null = null;
  if (data.campaign) {
    const { data: member, error: memberError } = await client
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', data.campaign.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (memberError) throw toAppError(memberError);
    if (member) membership = { role: member.role, isOwner: data.campaign.owner_id === userId };
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    ownerName: data.owner?.display_name ?? 'Jogador',
    systemId: data.system_id,
    name: data.name,
    portraitPath: data.portrait_path,
    tokenPath: data.token_path,
    sheet: data.sheet,
    version: data.version,
    updatedAt: data.updated_at,
    liveUpdatedAt: data.live_updated_at,
    grantedLevel: data.granted_level,
    campaign: data.campaign
      ? {
          id: data.campaign.id,
          name: data.campaign.name,
          status: data.campaign.status,
          ownerId: data.campaign.owner_id,
          settings: {
            partySheetsVisible: data.campaign.party_sheets_visible,
            playersCanEditSheets: data.campaign.players_can_edit_sheets,
          },
        }
      : null,
    viewer: { isOwner: data.owner_id === userId, membership },
  };
}

export interface CharacterSheetState {
  name: string;
  sheet: unknown;
  version: number;
  portraitPath: string | null;
}

/** Leitura leve da ficha, usada para ressincronizar após eventos em tempo real. */
export async function getCharacterSheetState(
  client: CodexveilClient,
  characterId: string,
): Promise<CharacterSheetState | null> {
  const { data, error } = await client
    .from('characters')
    .select('name, sheet, version, portrait_path')
    .eq('id', characterId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data
    ? { name: data.name, sheet: data.sheet, version: data.version, portraitPath: data.portrait_path }
    : null;
}

export interface SheetSaveResult {
  version: number;
  updatedAt: string;
}

/**
 * Grava nome e/ou ficha com controle otimista de concorrência: só altera se a versão no
 * banco ainda for `expectedVersion`. Caso contrário lança `conflict` (com a versão atual
 * em `details.currentVersion`), `forbidden` ou `not_found`.
 */
export async function saveCharacterSheet(
  client: CodexveilClient,
  characterId: string,
  expectedVersion: number,
  patch: { name?: string; sheet?: unknown },
): Promise<SheetSaveResult> {
  const { data, error } = await client
    .from('characters')
    .update({
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.sheet === undefined ? {} : { sheet: patch.sheet as Json }),
    })
    .eq('id', characterId)
    .eq('version', expectedVersion)
    .select('version, updated_at');
  if (error) throw toAppError(error);

  const saved = data[0];
  if (saved) return { version: saved.version, updatedAt: saved.updated_at };

  const { data: current, error: currentError } = await client
    .from('characters')
    .select('version')
    .eq('id', characterId)
    .maybeSingle();
  if (currentError) throw toAppError(currentError);
  if (!current) throw new AppError('not_found');
  if (current.version !== expectedVersion) {
    throw new AppError('conflict', undefined, { details: { currentVersion: current.version } });
  }
  throw new AppError('forbidden');
}

/** Define (ou remove) o retrato. Devolve a nova versão da ficha. */
export async function setCharacterPortrait(
  client: CodexveilClient,
  characterId: string,
  portraitPath: string | null,
): Promise<number> {
  const { data, error } = await client
    .from('characters')
    .update({ portrait_path: portraitPath })
    .eq('id', characterId)
    .select('version');
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return row.version;
}

/** Vincula o personagem a uma campanha (ou desvincula, com `null`). Somente o dono. */
export async function setCharacterCampaign(
  client: CodexveilClient,
  characterId: string,
  campaignId: string | null,
): Promise<void> {
  const { error } = await client.rpc('set_character_campaign', {
    p_character_id: characterId,
    // A função aceita NULL para desvincular; o gerador de tipos não expressa isso.
    p_campaign_id: campaignId as string,
  });
  if (error) throw toAppError(error);
}

export async function deleteCharacter(client: CodexveilClient, characterId: string): Promise<void> {
  const { data, error } = await client.from('characters').delete().eq('id', characterId).select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

/** Personagens vinculados a uma campanha (o RLS decide quais fichas o usuário vê). */
export async function listCampaignCharacters(
  client: CodexveilClient,
  campaignId: string,
): Promise<PartyCharacter[]> {
  const { data, error } = await client
    .from('characters')
    .select(
      `id, name, owner_id, system_id, portrait_path, sheet, live_updated_at, owner:profiles!characters_owner_id_fkey(display_name), resources:character_resources(${RESOURCE_COLUMNS}), conditions:character_conditions(${CONDITION_COLUMNS})`,
    )
    .eq('campaign_id', campaignId)
    .order('name', { ascending: true });
  if (error) throw toAppError(error);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    ownerName: row.owner?.display_name ?? 'Jogador',
    systemId: row.system_id,
    portraitPath: row.portrait_path,
    sheet: row.sheet,
    liveUpdatedAt: row.live_updated_at,
    resources: row.resources.map(toCharacterResource).sort(byResourceOrder),
    conditions: row.conditions.map(toCharacterCondition),
  }));
}

// ---------------------------------------------------------------------------
// Trilhas de recurso (vida, dados de vida, espaços de magia...)
// ---------------------------------------------------------------------------

export async function listCharacterResources(
  client: CodexveilClient,
  characterId: string,
): Promise<CharacterResource[]> {
  const { data, error } = await client
    .from('character_resources')
    .select(RESOURCE_COLUMNS)
    .eq('character_id', characterId);
  if (error) throw toAppError(error);
  return data.map(toCharacterResource).sort(byResourceOrder);
}

/**
 * Altera uma trilha de forma atômica no banco (mesmas regras de @codexveil/domain), para
 * que alterações simultâneas de mestre e jogador não se sobrescrevam.
 */
export async function adjustCharacterResource(
  client: CodexveilClient,
  resourceId: string,
  operation: TrackOperation,
  amount: number,
): Promise<CharacterResource> {
  const { data, error } = await client.rpc('adjust_character_resource', {
    p_resource_id: resourceId,
    p_operation: operation,
    p_amount: amount,
  });
  if (error) throw toAppError(error);
  return toCharacterResource(data);
}

export interface ResourceFields {
  label: string;
  current: number;
  max: number | null;
  recovery: ResourceRecovery;
  display?: ResourceDisplay;
  sortOrder?: number;
}

/** Chave interna para trilhas criadas pelo usuário (não precisa ser secreta, só única). */
function customResourceKey(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `custom:${Date.now().toString(36)}${random}`;
}

export async function createCharacterResource(
  client: CodexveilClient,
  characterId: string,
  fields: ResourceFields & { key?: string },
): Promise<CharacterResource> {
  const { data, error } = await client
    .from('character_resources')
    .insert({
      character_id: characterId,
      key: fields.key ?? customResourceKey(),
      label: fields.label,
      current: fields.current,
      max: fields.max,
      recovery: fields.recovery,
      display: fields.display ?? 'pool',
      sort_order: fields.sortOrder ?? 100,
    })
    .select(RESOURCE_COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toCharacterResource(data);
}

export async function updateCharacterResource(
  client: CodexveilClient,
  resourceId: string,
  fields: ResourceFields,
): Promise<CharacterResource> {
  const { data, error } = await client
    .from('character_resources')
    .update({
      label: fields.label,
      current: fields.max === null ? fields.current : Math.min(fields.current, fields.max),
      max: fields.max,
      recovery: fields.recovery,
      ...(fields.display ? { display: fields.display } : {}),
      ...(fields.sortOrder === undefined ? {} : { sort_order: fields.sortOrder }),
    })
    .eq('id', resourceId)
    .select(RESOURCE_COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toCharacterResource(row);
}

export async function deleteCharacterResource(
  client: CodexveilClient,
  resourceId: string,
): Promise<void> {
  const { data, error } = await client
    .from('character_resources')
    .delete()
    .eq('id', resourceId)
    .select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

/** Descanso curto ou longo. Devolve quantas trilhas foram restauradas. */
export async function takeCharacterRest(
  client: CodexveilClient,
  characterId: string,
  rest: RestKind,
): Promise<number> {
  const { data, error } = await client.rpc('take_character_rest', {
    p_character_id: characterId,
    p_rest: rest,
  });
  if (error) throw toAppError(error);
  return data;
}

// ---------------------------------------------------------------------------
// Condições
// ---------------------------------------------------------------------------

export async function listCharacterConditions(
  client: CodexveilClient,
  characterId: string,
): Promise<CharacterCondition[]> {
  const { data, error } = await client
    .from('character_conditions')
    .select(CONDITION_COLUMNS)
    .eq('character_id', characterId)
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toCharacterCondition);
}

/**
 * Aplica uma condição. Se já estiver aplicada, atualiza o nível (condições graduais) e a
 * duração. `rounds` é a duração em rodadas; `null` dura até ser removida.
 * Upsert não é usado porque exigiria permissão de UPDATE nas colunas da chave.
 */
export async function applyCharacterCondition(
  client: CodexveilClient,
  characterId: string,
  key: string,
  level: number | null = null,
  rounds: number | null = null,
): Promise<void> {
  const { error } = await client
    .from('character_conditions')
    .insert({ character_id: characterId, key, level, rounds_remaining: rounds });
  if (!error) return;
  if (error.code !== '23505') throw toAppError(error);

  const { data, error: updateError } = await client
    .from('character_conditions')
    .update({ level, rounds_remaining: rounds })
    .eq('character_id', characterId)
    .eq('key', key)
    .select('id');
  if (updateError) throw toAppError(updateError);
  assertChanged(data);
}

/** Altera o nível de uma condição gradual (ex.: Exaustão depois de um Descanso Longo). */
export async function setCharacterConditionLevel(
  client: CodexveilClient,
  conditionId: string,
  level: number,
): Promise<void> {
  const { data, error } = await client
    .from('character_conditions')
    .update({ level })
    .eq('id', conditionId)
    .select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

/** Altera a duração de uma condição aplicada; `null` passa a durar até ser removida. */
export async function setCharacterConditionRounds(
  client: CodexveilClient,
  conditionId: string,
  rounds: number | null,
): Promise<void> {
  const { data, error } = await client
    .from('character_conditions')
    .update({ rounds_remaining: rounds })
    .eq('id', conditionId)
    .select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

/**
 * Passa rodadas nas condições do personagem (no fim do turno dele): diminui as durações e
 * remove as que terminam. Devolve as chaves das condições que terminaram.
 */
export async function tickCharacterConditions(
  client: CodexveilClient,
  characterId: string,
  rounds = 1,
): Promise<string[]> {
  const { data, error } = await client.rpc('tick_character_conditions', {
    p_character_id: characterId,
    p_rounds: rounds,
  });
  if (error) throw toAppError(error);
  return data ?? [];
}

export async function removeCharacterCondition(
  client: CodexveilClient,
  conditionId: string,
): Promise<void> {
  const { data, error } = await client
    .from('character_conditions')
    .delete()
    .eq('id', conditionId)
    .select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

// ---------------------------------------------------------------------------
// Inventário
// ---------------------------------------------------------------------------

export async function listCharacterItems(
  client: CodexveilClient,
  characterId: string,
): Promise<CharacterItem[]> {
  const { data, error } = await client
    .from('character_items')
    .select(ITEM_COLUMNS)
    .eq('character_id', characterId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toCharacterItem);
}

function itemColumns(item: InventoryItemData) {
  return {
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    weight: item.weight,
    description: item.description,
    notes: item.notes,
    is_equipped: item.isEquipped,
  };
}

export async function createCharacterItem(
  client: CodexveilClient,
  characterId: string,
  item: InventoryItemData,
): Promise<CharacterItem> {
  const { data, error } = await client
    .from('character_items')
    .insert({ character_id: characterId, ...itemColumns(item) })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toCharacterItem(data);
}

export async function updateCharacterItem(
  client: CodexveilClient,
  itemId: string,
  item: InventoryItemData,
): Promise<CharacterItem> {
  const { data, error } = await client
    .from('character_items')
    .update(itemColumns(item))
    .eq('id', itemId)
    .select(ITEM_COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toCharacterItem(row);
}

export async function setCharacterItemEquipped(
  client: CodexveilClient,
  itemId: string,
  isEquipped: boolean,
): Promise<void> {
  const { data, error } = await client
    .from('character_items')
    .update({ is_equipped: isEquipped })
    .eq('id', itemId)
    .select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

/** Soma (ou subtrai) da quantidade de forma atômica; nunca fica negativa. */
export async function adjustCharacterItemQuantity(
  client: CodexveilClient,
  itemId: string,
  delta: number,
): Promise<CharacterItem> {
  const { data, error } = await client.rpc('adjust_item_quantity', {
    p_item_id: itemId,
    p_delta: delta,
  });
  if (error) throw toAppError(error);
  return toCharacterItem(data);
}

export async function deleteCharacterItem(client: CodexveilClient, itemId: string): Promise<void> {
  const { data, error } = await client.from('character_items').delete().eq('id', itemId).select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

// ---------------------------------------------------------------------------
// Habilidades, talentos, magias e ataques
// ---------------------------------------------------------------------------

export async function listCharacterAbilities(
  client: CodexveilClient,
  characterId: string,
): Promise<CharacterAbility[]> {
  const { data, error } = await client
    .from('character_abilities')
    .select(ABILITY_COLUMNS)
    .eq('character_id', characterId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toCharacterAbility);
}

export interface AbilityFields {
  kind: AbilityEntryKind;
  name: string;
  source: string;
  description: string;
  data: Json;
  resourceId: string | null;
}

export async function createCharacterAbility(
  client: CodexveilClient,
  characterId: string,
  fields: AbilityFields,
): Promise<CharacterAbility> {
  const { data, error } = await client
    .from('character_abilities')
    .insert({
      character_id: characterId,
      kind: fields.kind,
      name: fields.name,
      source: fields.source,
      description: fields.description,
      data: fields.data,
      resource_id: fields.resourceId,
    })
    .select(ABILITY_COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toCharacterAbility(data);
}

/** O tipo (`kind`) não muda depois de criado: magias continuam magias. */
export async function updateCharacterAbility(
  client: CodexveilClient,
  abilityId: string,
  fields: Omit<AbilityFields, 'kind'>,
): Promise<CharacterAbility> {
  const { data, error } = await client
    .from('character_abilities')
    .update({
      name: fields.name,
      source: fields.source,
      description: fields.description,
      data: fields.data,
      resource_id: fields.resourceId,
    })
    .eq('id', abilityId)
    .select(ABILITY_COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toCharacterAbility(row);
}

export async function deleteCharacterAbility(
  client: CodexveilClient,
  abilityId: string,
): Promise<void> {
  const { data, error } = await client
    .from('character_abilities')
    .delete()
    .eq('id', abilityId)
    .select('id');
  if (error) throw toAppError(error);
  assertChanged(data);
}

// ---------------------------------------------------------------------------
// Histórico de evolução e cópias de segurança
// ---------------------------------------------------------------------------

export async function listCharacterEvents(
  client: CodexveilClient,
  characterId: string,
  limit = 50,
): Promise<CharacterEvent[]> {
  const { data, error } = await client
    .from('character_events')
    .select('id, kind, summary, occurred_at, actor:profiles(display_name)')
    .eq('character_id', characterId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    kind: isEventKind(row.kind) ? row.kind : 'note',
    summary: row.summary,
    occurredAt: row.occurred_at,
    actorName: row.actor?.display_name ?? null,
  }));
}

export async function addCharacterEvent(
  client: CodexveilClient,
  characterId: string,
  event: { kind: CharacterEventKind; summary: string; data?: Json },
): Promise<void> {
  const { error } = await client.from('character_events').insert({
    character_id: characterId,
    kind: event.kind,
    summary: event.summary,
    data: event.data ?? {},
  });
  if (error) throw toAppError(error);
}

export async function listCharacterSnapshots(
  client: CodexveilClient,
  characterId: string,
): Promise<CharacterSnapshot[]> {
  const { data, error } = await client
    .from('character_snapshots')
    .select('id, name, version, created_at, sheet')
    .eq('character_id', characterId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    version: row.version,
    createdAt: row.created_at,
    sheet: row.sheet,
  }));
}

// ---------------------------------------------------------------------------
// Mídia
// ---------------------------------------------------------------------------

/** Caminho do retrato no bucket privado `campaign-media` (formato exigido pelas policies). */
/** Troca (ou tira) a imagem de token do personagem. */
export async function setCharacterToken(client: CodexveilClient, characterId: string, tokenPath: string | null): Promise<void> {
  const { data, error } = await client.from('characters').update({ token_path: tokenPath }).eq('id', characterId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export function characterPortraitPath(characterId: string, fileName: string): string {
  return `characters/${characterId}/${fileName}`;
}

/** Mestre: libera o próximo nível do personagem (ou `level`). O jogador escolhe as melhorias. */
export async function grantCharacterLevel(client: CodexveilClient, characterId: string, level?: number): Promise<number> {
  const { data, error } = await client.rpc('grant_character_level', { p_character_id: characterId, ...(level ? { p_level: level } : {}) });
  if (error) throw toAppError(error);
  return data;
}
