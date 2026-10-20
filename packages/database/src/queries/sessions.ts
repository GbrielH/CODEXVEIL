/**
 * Sessões e roteiros por blocos.
 *
 * Segredos não dependem da interface: blocos `gm` e sessões não publicadas nem saem do
 * banco para jogadores (RLS). Os blocos lidos são validados com o mesmo esquema usado na
 * escrita, para que a interface nunca renderize dados fora do formato esperado.
 */
import {
  AppError,
  BLOCK_SCHEMA_VERSION,
  type SessionBlockContent,
  type SharedVisibility,
} from '@codexveil/domain';
import {
  sessionBlockContentSchema,
  type SessionCreate,
  type SessionUpdate,
} from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json, Tables } from '../types.gen';
import type { SessionStatus } from '../types';

export interface SessionSummary {
  id: string;
  campaignId: string;
  number: number;
  title: string;
  scheduledAt: string | null;
  status: SessionStatus;
  isPublished: boolean;
  /** A mesa rola dados físicos nesta sessão. */
  physicalDice: boolean;
  updatedAt: string;
}

export interface SessionDetail extends SessionSummary {
  recap: string;
  version: number;
  createdAt: string;
}

export const sessionStatusLabels: Record<SessionStatus, string> = {
  planned: 'Planejada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

const SESSION_COLUMNS =
  'id, campaign_id, number, title, scheduled_at, status, is_published, physical_dice, recap, version, created_at, updated_at' as const;

type SessionRow = Pick<
  Tables<'sessions'>,
  | 'id'
  | 'campaign_id'
  | 'number'
  | 'title'
  | 'scheduled_at'
  | 'status'
  | 'is_published'
  | 'physical_dice'
  | 'recap'
  | 'version'
  | 'created_at'
  | 'updated_at'
>;

function toSessionDetail(row: SessionRow): SessionDetail {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    number: row.number,
    title: row.title,
    scheduledAt: row.scheduled_at,
    status: row.status,
    isPublished: row.is_published,
    physicalDice: row.physical_dice,
    recap: row.recap,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Sessões da campanha, da mais recente para a mais antiga (jogadores veem só as publicadas). */
export async function listSessions(
  client: CodexveilClient,
  campaignId: string,
): Promise<SessionDetail[]> {
  const { data, error } = await client
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('number', { ascending: false });
  if (error) throw toAppError(error);
  return data.map(toSessionDetail);
}

export async function getSession(
  client: CodexveilClient,
  sessionId: string,
): Promise<SessionDetail | null> {
  const { data, error } = await client
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toSessionDetail(data) : null;
}

/**
 * Sessão de referência do painel do mestre: a que está em andamento ou, na falta dela,
 * a próxima planejada (agendada mais cedo; sem data, a de menor número).
 */
export function pickCurrentSession<T extends SessionSummary>(sessions: readonly T[]): T | null {
  const inProgress = sessions.find((session) => session.status === 'in_progress');
  if (inProgress) return inProgress;
  const planned = sessions
    .filter((session) => session.status === 'planned')
    .sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return a.number - b.number;
    });
  return planned[0] ?? null;
}

export async function createSession(
  client: CodexveilClient,
  campaignId: string,
  input: SessionCreate,
): Promise<string> {
  const { data, error } = await client
    .from('sessions')
    .insert({
      campaign_id: campaignId,
      title: input.title,
      scheduled_at: input.scheduledAt,
      is_published: input.isPublished,
      physical_dice: input.physicalDice,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

/** Atualiza título, data, publicação e resumo com controle otimista de versão. */
export async function updateSession(
  client: CodexveilClient,
  sessionId: string,
  expectedVersion: number,
  input: SessionUpdate,
): Promise<number> {
  const { data, error } = await client
    .from('sessions')
    .update({
      title: input.title,
      scheduled_at: input.scheduledAt,
      is_published: input.isPublished,
      physical_dice: input.physicalDice,
      recap: input.recap,
    })
    .eq('id', sessionId)
    .eq('version', expectedVersion)
    .select('version');
  if (error) throw toAppError(error);
  const row = data[0];
  if (row) return row.version;

  const current = await getSession(client, sessionId);
  if (!current) throw new AppError('not_found');
  if (current.version !== expectedVersion) {
    throw new AppError('conflict', undefined, { details: { currentVersion: current.version } });
  }
  throw new AppError('forbidden');
}

/** Muda o estado da sessão. Só uma sessão por campanha pode estar em andamento. */
/** Publica a sessão para os jogadores (feito ao liberar o primeiro trecho na mesa). */
export async function publishSession(client: CodexveilClient, sessionId: string): Promise<void> {
  const { data, error } = await client.from('sessions').update({ is_published: true }).eq('id', sessionId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

export async function setSessionStatus(
  client: CodexveilClient,
  sessionId: string,
  status: SessionStatus,
): Promise<void> {
  const { data, error } = await client
    .from('sessions')
    .update({ status })
    .eq('id', sessionId)
    .select('id');
  if (error) {
    if (error.code === '23505') {
      throw new AppError(
        'conflict',
        'Já existe uma sessão em andamento nesta campanha. Conclua-a antes de iniciar outra.',
        { cause: error },
      );
    }
    throw toAppError(error);
  }
  if (data.length === 0) throw new AppError('forbidden');
}

export async function deleteSession(client: CodexveilClient, sessionId: string): Promise<void> {
  const { data, error } = await client.from('sessions').delete().eq('id', sessionId).select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Duplica sessão e blocos; a cópia nasce planejada e não publicada. */
export async function duplicateSession(client: CodexveilClient, sessionId: string): Promise<string> {
  const { data, error } = await client.rpc('duplicate_session', { p_session_id: sessionId });
  if (error) throw toAppError(error);
  return data;
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

export interface StoredSessionBlock {
  id: string;
  sessionId: string;
  position: number;
  visibility: SharedVisibility;
  /** `null` quando os dados não seguem o esquema atual (exibido como bloco ilegível). */
  content: SessionBlockContent | null;
  type: Tables<'session_blocks'>['type'];
  updatedAt: string;
}

const BLOCK_COLUMNS = 'id, session_id, type, position, visibility, data, updated_at' as const;

type BlockRow = Pick<
  Tables<'session_blocks'>,
  'id' | 'session_id' | 'type' | 'position' | 'visibility' | 'data' | 'updated_at'
>;

function toStoredBlock(row: BlockRow): StoredSessionBlock {
  const parsed = sessionBlockContentSchema.safeParse({ type: row.type, data: row.data });
  return {
    id: row.id,
    sessionId: row.session_id,
    position: row.position,
    // A coluna aceita apenas 'members' e 'gm' para blocos (CHECK no banco).
    visibility: row.visibility === 'members' ? 'members' : 'gm',
    content: parsed.success ? parsed.data : null,
    type: row.type,
    updatedAt: row.updated_at,
  };
}

export async function listSessionBlocks(
  client: CodexveilClient,
  sessionId: string,
): Promise<StoredSessionBlock[]> {
  const { data, error } = await client
    .from('session_blocks')
    .select(BLOCK_COLUMNS)
    .eq('session_id', sessionId)
    .order('position', { ascending: true });
  if (error) throw toAppError(error);
  return data.map(toStoredBlock);
}

export async function createSessionBlock(
  client: CodexveilClient,
  params: {
    sessionId: string;
    campaignId: string;
    position: number;
    visibility: SharedVisibility;
    content: SessionBlockContent;
  },
): Promise<StoredSessionBlock> {
  const { data, error } = await client
    .from('session_blocks')
    .insert({
      session_id: params.sessionId,
      campaign_id: params.campaignId,
      type: params.content.type,
      position: params.position,
      visibility: params.visibility,
      data: params.content.data as Json,
      schema_version: BLOCK_SCHEMA_VERSION,
    })
    .select(BLOCK_COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toStoredBlock(data);
}

export async function updateSessionBlock(
  client: CodexveilClient,
  blockId: string,
  patch: { visibility?: SharedVisibility; content?: SessionBlockContent; position?: number },
): Promise<StoredSessionBlock> {
  const { data, error } = await client
    .from('session_blocks')
    .update({
      ...(patch.visibility ? { visibility: patch.visibility } : {}),
      ...(patch.content
        ? { data: patch.content.data as Json, schema_version: BLOCK_SCHEMA_VERSION }
        : {}),
      ...(patch.position === undefined ? {} : { position: patch.position }),
    })
    .eq('id', blockId)
    .select(BLOCK_COLUMNS);
  if (error) throw toAppError(error);
  const row = data[0];
  if (!row) throw new AppError('forbidden');
  return toStoredBlock(row);
}

export async function deleteSessionBlock(client: CodexveilClient, blockId: string): Promise<void> {
  const { data, error } = await client
    .from('session_blocks')
    .delete()
    .eq('id', blockId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Regrava a ordem completa dos blocos (posições 1024, 2048, ...). */
export async function reorderSessionBlocks(
  client: CodexveilClient,
  sessionId: string,
  blockIds: string[],
): Promise<void> {
  const { error } = await client.rpc('reorder_session_blocks', {
    p_session_id: sessionId,
    p_block_ids: blockIds,
  });
  if (error) throw toAppError(error);
}

// ---------------------------------------------------------------------------
// Referências de blocos (resolvidas sob as regras de acesso de quem lê)
// ---------------------------------------------------------------------------

export interface BlockReferences {
  creatures: Record<string, { name: string; subtitle: string; kind: 'npc' | 'monster' }>;
  characters: Record<string, { name: string }>;
  sessions: Record<string, { title: string; number: number }>;
  notes: Record<string, { title: string }>;
}

function collectIds(blocks: readonly StoredSessionBlock[]) {
  const creatures = new Set<string>();
  const characters = new Set<string>();
  const sessions = new Set<string>();
  const notes = new Set<string>();
  for (const block of blocks) {
    const content = block.content;
    if (!content) continue;
    switch (content.type) {
      case 'npc_ref':
      case 'monster_ref':
        if (content.data.creatureId) creatures.add(content.data.creatureId);
        break;
      case 'character_ref':
        if (content.data.characterId) characters.add(content.data.characterId);
        break;
      case 'content_ref':
        if (content.data.targetId) {
          (content.data.kind === 'session' ? sessions : notes).add(content.data.targetId);
        }
        break;
      default:
        break;
    }
  }
  return { creatures: [...creatures], characters: [...characters], sessions: [...sessions], notes: [...notes] };
}

/**
 * Busca os nomes dos registros referenciados. Como cada consulta passa pelo RLS, um
 * bloco público nunca revela o título de um NPC oculto ou de uma nota privada: o
 * registro simplesmente não aparece no resultado.
 */
export async function resolveBlockReferences(
  client: CodexveilClient,
  blocks: readonly StoredSessionBlock[],
): Promise<BlockReferences> {
  const ids = collectIds(blocks);
  const references: BlockReferences = { creatures: {}, characters: {}, sessions: {}, notes: {} };

  const [creatures, characters, sessions, notes] = await Promise.all([
    ids.creatures.length > 0
      ? client.from('creatures').select('id, name, subtitle, kind').in('id', ids.creatures)
      : null,
    ids.characters.length > 0
      ? client.from('characters').select('id, name').in('id', ids.characters)
      : null,
    ids.sessions.length > 0
      ? client.from('sessions').select('id, title, number').in('id', ids.sessions)
      : null,
    ids.notes.length > 0
      ? client.from('campaign_notes').select('id, title').in('id', ids.notes)
      : null,
  ]);

  if (creatures) {
    if (creatures.error) throw toAppError(creatures.error);
    for (const row of creatures.data) {
      references.creatures[row.id] = { name: row.name, subtitle: row.subtitle, kind: row.kind };
    }
  }
  if (characters) {
    if (characters.error) throw toAppError(characters.error);
    for (const row of characters.data) references.characters[row.id] = { name: row.name };
  }
  if (sessions) {
    if (sessions.error) throw toAppError(sessions.error);
    for (const row of sessions.data) {
      references.sessions[row.id] = { title: row.title, number: row.number };
    }
  }
  if (notes) {
    if (notes.error) throw toAppError(notes.error);
    for (const row of notes.data) references.notes[row.id] = { title: row.title };
  }
  return references;
}

/** Caminho de imagens de roteiro no bucket `campaign-media` (formato exigido pelas policies). */
export function sessionImagePath(campaignId: string, sessionId: string, fileName: string): string {
  return `campaigns/${campaignId}/sessions/${sessionId}/${fileName}`;
}
