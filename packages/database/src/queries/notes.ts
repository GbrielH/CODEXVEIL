/**
 * Anotações da campanha. A visibilidade é aplicada pelo RLS:
 * `members` (todos), `gm` (mestres e o autor) e `author` (somente o autor).
 */
import { AppError, type ContentVisibility } from '@codexveil/domain';
import type { NoteData } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export interface CampaignNote {
  id: string;
  campaignId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  visibility: ContentVisibility;
  isPinned: boolean;
  version: number;
  updatedAt: string;
  /** Imagem da anotação no bucket `campaign-media`. */
  imagePath: string | null;
}

const NOTE_COLUMNS =
  'id, campaign_id, author_id, title, body, visibility, is_pinned, version, updated_at, image_path, author:profiles(display_name)' as const;

export async function listCampaignNotes(
  client: CodexveilClient,
  campaignId: string,
): Promise<CampaignNote[]> {
  const { data, error } = await client
    .from('campaign_notes')
    .select(NOTE_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('is_pinned', { ascending: false })
    // As demais seguem a ordem em que foram criadas.
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    authorId: row.author_id,
    authorName: row.author?.display_name ?? 'Participante',
    title: row.title,
    body: row.body,
    visibility: row.visibility,
    isPinned: row.is_pinned,
    version: row.version,
    updatedAt: row.updated_at,
    imagePath: row.image_path,
  }));
}

export async function createCampaignNote(
  client: CodexveilClient,
  campaignId: string,
  input: NoteData,
): Promise<string> {
  const { data, error } = await client
    .from('campaign_notes')
    .insert({
      campaign_id: campaignId,
      title: input.title,
      body: input.body,
      visibility: input.visibility,
      is_pinned: input.isPinned,
    })
    .select('id')
    .single();
  if (error) throw toAppError(error);
  return data.id;
}

/** Atualiza com controle otimista: evita sobrescrever edição feita em outro dispositivo. */
export async function updateCampaignNote(
  client: CodexveilClient,
  noteId: string,
  expectedVersion: number,
  input: NoteData,
): Promise<number> {
  const { data, error } = await client
    .from('campaign_notes')
    .update({
      title: input.title,
      body: input.body,
      visibility: input.visibility,
      is_pinned: input.isPinned,
    })
    .eq('id', noteId)
    .eq('version', expectedVersion)
    .select('version');
  if (error) throw toAppError(error);
  const row = data[0];
  if (row) return row.version;

  const { data: current, error: currentError } = await client
    .from('campaign_notes')
    .select('version')
    .eq('id', noteId)
    .maybeSingle();
  if (currentError) throw toAppError(currentError);
  if (!current) throw new AppError('not_found');
  if (current.version !== expectedVersion) throw new AppError('conflict');
  throw new AppError('forbidden');
}

export async function deleteCampaignNote(client: CodexveilClient, noteId: string): Promise<void> {
  const { data, error } = await client
    .from('campaign_notes')
    .delete()
    .eq('id', noteId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/**
 * Fixa (ou desfixa) a anotação. Cada pessoa fixa uma por campanha: a fixada antes por quem
 * fixa é desfixada primeiro.
 */
export async function setCampaignNotePinned(
  client: CodexveilClient,
  note: CampaignNote,
  userId: string,
  pinned: boolean,
): Promise<void> {
  if (pinned) {
    const { error } = await client
      .from('campaign_notes')
      .update({ is_pinned: false })
      .eq('campaign_id', note.campaignId)
      .eq('author_id', userId)
      .eq('is_pinned', true);
    if (error) throw toAppError(error);
  }
  const { data, error } = await client
    .from('campaign_notes')
    .update({ is_pinned: pinned })
    .eq('id', note.id)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}

/** Caminho da imagem de uma anotação no bucket `campaign-media` (formato exigido pelas policies). */
export function noteImagePath(campaignId: string, noteId: string, fileName: string): string {
  return `campaigns/${campaignId}/notes/${noteId}/${fileName}`;
}

/** Troca (ou tira, com `null`) a imagem da anotação; só o autor consegue. */
export async function setCampaignNoteImage(
  client: CodexveilClient,
  noteId: string,
  imagePath: string | null,
): Promise<void> {
  const { data, error } = await client
    .from('campaign_notes')
    .update({ image_path: imagePath })
    .eq('id', noteId)
    .select('id');
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError('forbidden');
}
