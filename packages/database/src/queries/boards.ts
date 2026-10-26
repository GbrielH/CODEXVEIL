/**
 * Quadros livres da campanha (canvas do mestre com blocos arrastáveis). O conteúdo é uma lista
 * JSON validada no editor; o banco limita o tamanho e garante que só o mestre lê e altera.
 */
import { AppError } from '@codexveil/domain';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json } from '../types.gen';

export interface BoardSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Board extends BoardSummary {
  campaignId: string;
  items: unknown[];
  version: number;
}

export async function listBoards(client: CodexveilClient, campaignId: string): Promise<BoardSummary[]> {
  const { data, error } = await client
    .from('campaign_boards')
    .select('id, title, updated_at')
    .eq('campaign_id', campaignId)
    .order('created_at');
  if (error) throw toAppError(error);
  return data.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
}

export async function getBoard(client: CodexveilClient, boardId: string): Promise<Board | null> {
  const { data, error } = await client
    .from('campaign_boards')
    .select('id, campaign_id, title, items, version, updated_at')
    .eq('id', boardId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  return {
    id: data.id,
    campaignId: data.campaign_id,
    title: data.title,
    items: Array.isArray(data.items) ? data.items : [],
    version: data.version,
    updatedAt: data.updated_at,
  };
}

export async function createBoard(client: CodexveilClient, campaignId: string, title: string): Promise<string> {
  const { data, error } = await client.from('campaign_boards').insert({ campaign_id: campaignId, title }).select('id').single();
  if (error) throw toAppError(error);
  return data.id;
}

/**
 * Grava o conteúdo se ninguém salvou antes (mesma `version`); devolve a nova versão. Outra aba
 * do mestre que salvou no meio gera um conflito, em vez de apagar o trabalho dela.
 */
export async function saveBoardItems(
  client: CodexveilClient,
  boardId: string,
  items: readonly unknown[],
  version: number,
): Promise<number> {
  const { data, error } = await client
    .from('campaign_boards')
    .update({ items: items as unknown as Json, version: version + 1 })
    .eq('id', boardId)
    .eq('version', version)
    .select('version')
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new AppError('conflict', 'O quadro foi alterado em outra aba. Recarregue para ver a versão mais nova.');
  return data.version;
}

export async function updateBoard(
  client: CodexveilClient,
  boardId: string,
  changes: { title: string },
): Promise<void> {
  const { error } = await client.from('campaign_boards').update(changes).eq('id', boardId);
  if (error) throw toAppError(error);
}

export async function deleteBoard(client: CodexveilClient, boardId: string): Promise<void> {
  const { error } = await client.from('campaign_boards').delete().eq('id', boardId);
  if (error) throw toAppError(error);
}
