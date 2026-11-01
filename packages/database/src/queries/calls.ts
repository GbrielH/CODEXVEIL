import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export type CallAccessMode = 'open' | 'invite' | 'lobby';
export type CallJoinStatus = 'approved' | 'waiting' | 'denied';

export const callAccessModeLabels: Record<CallAccessMode, { name: string; hint: string }> = {
  open: { name: 'Aberta', hint: 'Quem tiver o link ou o código entra.' },
  invite: { name: 'Só convidados', hint: 'Entra quem você convidar.' },
  lobby: { name: 'Sala de espera', hint: 'Você aprova cada pessoa que chega.' },
};

export interface CallRoomSummary {
  id: string;
  slug: string;
  code: string;
  title: string;
  accessMode: CallAccessMode;
  status: 'active' | 'ended';
  ownerName: string;
  campaignName: string | null;
}

export interface CallRoom {
  id: string;
  slug: string;
  code: string;
  title: string;
  ownerId: string;
  campaignId: string | null;
  sessionId: string | null;
  accessMode: CallAccessMode;
  status: 'active' | 'ended';
  transcriptionEnabled: boolean;
  createdAt: string;
}

export interface CallParticipant {
  userId: string;
  displayName: string;
  characterId: string | null;
  characterName: string | null;
  role: 'master' | 'player';
  status: CallJoinStatus;
  leftAt: string | null;
}

const ROOM_COLUMNS =
  'id, slug, code, title, owner_id, campaign_id, session_id, access_mode, status, transcription_enabled, created_at';

function toRoom(row: {
  id: string;
  slug: string;
  code: string;
  title: string;
  owner_id: string;
  campaign_id: string | null;
  session_id: string | null;
  access_mode: string;
  status: string;
  transcription_enabled: boolean;
  created_at: string;
}): CallRoom {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    title: row.title,
    ownerId: row.owner_id,
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    accessMode: row.access_mode as CallAccessMode,
    status: row.status === 'ended' ? 'ended' : 'active',
    transcriptionEnabled: row.transcription_enabled,
    createdAt: row.created_at,
  };
}

/** Cria a sala; devolve o link (`slug`) e o código curto. */
export async function createCallRoom(
  client: CodexveilClient,
  input: {
    title: string;
    accessMode: CallAccessMode;
    campaignId: string | null;
    sessionId: string | null;
  },
): Promise<{ id: string; slug: string; code: string }> {
  const { data, error } = await client.rpc('create_call_room', {
    p_title: input.title,
    p_access_mode: input.accessMode,
    p_campaign_id: input.campaignId as string,
    p_session_id: input.sessionId as string,
  });
  if (error) throw toAppError(error);
  const row = (data as unknown as { id: string; slug: string; code: string }[])[0];
  if (!row) throw new Error('A sala não foi criada.');
  return row;
}

/** Acha uma sala pelo link ou pelo código (para entrar). */
export async function findCallRoom(
  client: CodexveilClient,
  ref: string,
): Promise<CallRoomSummary | null> {
  const { data, error } = await client.rpc('find_call_room', { p_ref: ref.trim() });
  if (error) throw toAppError(error);
  const row = (
    data as unknown as {
      id: string;
      slug: string;
      code: string;
      title: string;
      access_mode: string;
      status: string;
      owner_name: string | null;
      campaign_name: string | null;
    }[]
  )[0];
  return row
    ? {
        id: row.id,
        slug: row.slug,
        code: row.code,
        title: row.title,
        accessMode: row.access_mode as CallAccessMode,
        status: row.status === 'ended' ? 'ended' : 'active',
        ownerName: row.owner_name ?? 'Alguém',
        campaignName: row.campaign_name,
      }
    : null;
}

/** Entra na sala (ou pede para entrar, na sala de espera). */
export async function joinCallRoom(
  client: CodexveilClient,
  roomId: string,
): Promise<CallJoinStatus> {
  const { data, error } = await client.rpc('join_call_room', { p_room_id: roomId });
  if (error) throw toAppError(error);
  return data as CallJoinStatus;
}

export async function leaveCallRoom(client: CodexveilClient, roomId: string): Promise<void> {
  const { error } = await client.rpc('leave_call_room', { p_room_id: roomId });
  if (error) throw toAppError(error);
}

export async function decideCallParticipant(
  client: CodexveilClient,
  roomId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  const { error } = await client.rpc('decide_call_participant', {
    p_room_id: roomId,
    p_user_id: userId,
    p_approve: approve,
  });
  if (error) throw toAppError(error);
}

export async function inviteToCall(
  client: CodexveilClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const { error } = await client.rpc('invite_to_call', { p_room_id: roomId, p_user_id: userId });
  if (error) throw toAppError(error);
}

/** Encerra a sala para todos (só o dono). */
export async function endCallRoom(client: CodexveilClient, roomId: string): Promise<void> {
  const { error } = await client
    .from('call_rooms')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw toAppError(error);
}

export async function getCallRoom(client: CodexveilClient, slug: string): Promise<CallRoom | null> {
  const { data, error } = await client
    .from('call_rooms')
    .select(ROOM_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toRoom(data) : null;
}

/** Salas recentes em que a pessoa criou, entrou ou foi convidada. */
export async function listMyCallRooms(client: CodexveilClient): Promise<CallRoom[]> {
  const { data, error } = await client
    .from('call_rooms')
    .select(ROOM_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw toAppError(error);
  return data.map(toRoom);
}

/** Participantes com nome e personagem (para a lista da call). */
export async function listCallParticipants(
  client: CodexveilClient,
  roomId: string,
): Promise<CallParticipant[]> {
  const { data, error } = await client
    .from('call_participants')
    .select(
      'user_id, character_id, role, status, left_at, profile:profiles!call_participants_user_id_fkey(display_name), character:characters(name)',
    )
    .eq('room_id', roomId);
  if (error) throw toAppError(error);
  return (
    data as unknown as {
      user_id: string;
      character_id: string | null;
      role: string;
      status: string;
      left_at: string | null;
      profile: { display_name: string } | null;
      character: { name: string } | null;
    }[]
  ).map((row) => ({
    userId: row.user_id,
    displayName: row.profile?.display_name ?? 'Alguém',
    characterId: row.character_id,
    characterName: row.character?.name ?? null,
    role: row.role === 'master' ? 'master' : 'player',
    status: row.status as CallJoinStatus,
    leftAt: row.left_at,
  }));
}

/** Convites recebidos para salas ainda ativas. */
export async function listMyCallInvites(
  client: CodexveilClient,
  userId: string,
): Promise<{ roomId: string; slug: string; title: string; code: string; createdAt: string }[]> {
  const { data, error } = await client
    .from('call_invites')
    .select('room_id, created_at, room:call_rooms(slug, title, code, status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw toAppError(error);
  return (
    data as unknown as {
      room_id: string;
      created_at: string;
      room: { slug: string; title: string; code: string; status: string } | null;
    }[]
  )
    .filter((row) => row.room?.status === 'active')
    .map((row) => ({
      roomId: row.room_id,
      slug: row.room!.slug,
      title: row.room!.title,
      code: row.room!.code,
      createdAt: row.created_at,
    }));
}

export interface TranscriptSegment {
  id: string;
  roomId: string;
  userId: string;
  speakerType: 'player' | 'master';
  characterId: string | null;
  speakerLabel: string;
  text: string;
  startedAt: string;
  endedAt: string;
}

const SEGMENT_COLUMNS =
  'id, room_id, user_id, speaker_type, character_id, speaker_label, text, started_at, ended_at';

function toSegment(row: {
  id: string;
  room_id: string;
  user_id: string;
  speaker_type: string;
  character_id: string | null;
  speaker_label: string;
  text: string;
  started_at: string;
  ended_at: string;
}): TranscriptSegment {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    speakerType: row.speaker_type === 'master' ? 'master' : 'player',
    characterId: row.character_id,
    speakerLabel: row.speaker_label,
    text: row.text,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

/** Grava um trecho final da própria fala (o banco põe o personagem ou "Mestre"). */
export async function saveTranscriptSegment(
  client: CodexveilClient,
  roomId: string,
  speech: { text: string; startedAt: Date; endedAt: Date },
): Promise<void> {
  const { error } = await client.from('transcript_segments').insert({
    room_id: roomId,
    text: speech.text.trim().slice(0, 4000),
    started_at: speech.startedAt.toISOString(),
    ended_at: speech.endedAt.toISOString(),
  } as never);
  if (error) throw toAppError(error);
}

export async function listTranscript(
  client: CodexveilClient,
  roomId: string,
): Promise<TranscriptSegment[]> {
  const { data, error } = await client
    .from('transcript_segments')
    .select(SEGMENT_COLUMNS)
    .eq('room_id', roomId)
    .order('started_at')
    .limit(5000);
  if (error) throw toAppError(error);
  return data.map(toSegment);
}

/** Transcrição de uma sessão (todas as calls vinculadas a ela). */
export async function listSessionTranscript(
  client: CodexveilClient,
  sessionId: string,
): Promise<TranscriptSegment[]> {
  const { data, error } = await client
    .from('transcript_segments')
    .select(SEGMENT_COLUMNS)
    .eq('session_id', sessionId)
    .order('started_at')
    .limit(5000);
  if (error) throw toAppError(error);
  return data.map(toSegment);
}

/** O mestre corrige o texto de um trecho (erro de reconhecimento). */
export async function updateTranscriptSegment(
  client: CodexveilClient,
  id: string,
  text: string,
): Promise<void> {
  const { error } = await client
    .from('transcript_segments')
    .update({ text: text.trim() })
    .eq('id', id);
  if (error) throw toAppError(error);
}

/** O dono liga ou desliga "Gravar transcrição". */
export async function setCallTranscription(
  client: CodexveilClient,
  roomId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await client
    .from('call_rooms')
    .update({ transcription_enabled: enabled })
    .eq('id', roomId);
  if (error) throw toAppError(error);
}
