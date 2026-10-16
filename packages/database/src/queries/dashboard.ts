import type { SessionStatus } from '../types';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export interface UpcomingSession {
  id: string;
  campaignId: string;
  campaignName: string;
  number: number;
  title: string;
  scheduledAt: string;
  status: SessionStatus;
}

/** Próximas sessões agendadas nas campanhas visíveis ao usuário (o RLS filtra). */
export async function listUpcomingSessions(
  client: CodexveilClient,
  limit = 5,
): Promise<UpcomingSession[]> {
  const { data, error } = await client
    .from('sessions')
    .select('id, campaign_id, number, title, scheduled_at, status, campaign:campaigns(name, status)')
    .gte('scheduled_at', new Date().toISOString())
    .neq('status', 'completed')
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw toAppError(error);
  return data
    .filter((row) => row.scheduled_at !== null && row.campaign?.status === 'active')
    .map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      campaignName: row.campaign?.name ?? '',
      number: row.number,
      title: row.title,
      scheduledAt: row.scheduled_at as string,
      status: row.status,
    }));
}

export interface CharacterListItem {
  id: string;
  name: string;
  systemId: string;
  campaignId: string | null;
  campaignName: string | null;
  sheet: unknown;
  portraitPath: string | null;
  updatedAt: string;
}

/** Personagens do usuário, mais recentes primeiro. */
export async function listMyCharacters(
  client: CodexveilClient,
  userId: string,
): Promise<CharacterListItem[]> {
  const { data, error } = await client
    .from('characters')
    .select('id, name, system_id, campaign_id, sheet, portrait_path, updated_at, campaign:campaigns(name)')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw toAppError(error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    systemId: row.system_id,
    campaignId: row.campaign_id,
    campaignName: row.campaign?.name ?? null,
    sheet: row.sheet,
    portraitPath: row.portrait_path,
    updatedAt: row.updated_at,
  }));
}
