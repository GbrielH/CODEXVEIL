/**
 * Taverna: chat livre de campanha (todos os participantes) ou direto entre amigos. As mensagens
 * duram 24 horas (o banco esconde e apaga as mais antigas).
 */
import { preferencesSchema, type AvatarIcon } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export type TavernChannel = { kind: 'campaign'; campaignId: string } | { kind: 'direct'; friendId: string };

export interface TavernMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderIcon: AvatarIcon | null;
  body: string;
  createdAt: string;
}

const COLUMNS = 'id, sender_id, body, created_at, sender:profiles!tavern_messages_sender_id_fkey(display_name, preferences)' as const;

export async function listTavernMessages(client: CodexveilClient, userId: string, channel: TavernChannel, limit = 200): Promise<TavernMessage[]> {
  let query = client.from('tavern_messages').select(COLUMNS).order('created_at', { ascending: false }).limit(limit);
  query =
    channel.kind === 'campaign'
      ? query.eq('campaign_id', channel.campaignId)
      : query.or(`and(sender_id.eq.${userId},recipient_id.eq.${channel.friendId}),and(sender_id.eq.${channel.friendId},recipient_id.eq.${userId})`);
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data
    .map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender?.display_name ?? 'Alguém',
      senderIcon: preferencesSchema.safeParse(row.sender?.preferences).data?.avatar ?? null,
      body: row.body,
      createdAt: row.created_at,
    }))
    .reverse();
}

export async function sendTavernMessage(client: CodexveilClient, channel: TavernChannel, body: string): Promise<void> {
  const { error } = await client
    .from('tavern_messages')
    .insert(channel.kind === 'campaign' ? { campaign_id: channel.campaignId, body } : { recipient_id: channel.friendId, body });
  if (error) throw toAppError(error);
}

export async function deleteTavernMessage(client: CodexveilClient, messageId: string): Promise<void> {
  const { error } = await client.from('tavern_messages').delete().eq('id', messageId);
  if (error) throw toAppError(error);
}
