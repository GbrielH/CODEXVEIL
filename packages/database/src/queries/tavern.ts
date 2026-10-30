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
  /** Imagem anexada (caminho no bucket `campaign-media`). */
  imagePath: string | null;
  /** Resposta do Tomo (a pedido de quem aparece como remetente). */
  fromTomo: boolean;
  createdAt: string;
}

const COLUMNS = 'id, sender_id, body, image_path, from_tomo, created_at, sender:profiles!tavern_messages_sender_id_fkey(display_name, preferences)' as const;

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
      imagePath: row.image_path,
      fromTomo: row.from_tomo,
      createdAt: row.created_at,
    }))
    .reverse();
}

/** Pasta da imagem: campanha `tavern/<campanha>/`; direta `tavern/<remetente>/<amigo>/`. */
export function tavernImagePath(channel: TavernChannel, senderId: string, fileName: string): string {
  return channel.kind === 'campaign' ? `tavern/${channel.campaignId}/${fileName}` : `tavern/${senderId}/${channel.friendId}/${fileName}`;
}

export async function sendTavernMessage(client: CodexveilClient, channel: TavernChannel, body: string, imagePath: string | null = null): Promise<void> {
  const extra = imagePath ? { image_path: imagePath } : {};
  const { error } = await client
    .from('tavern_messages')
    .insert(channel.kind === 'campaign' ? { campaign_id: channel.campaignId, body, ...extra } : { recipient_id: channel.friendId, body, ...extra });
  if (error) throw toAppError(error);
}

export async function deleteTavernMessage(client: CodexveilClient, messageId: string): Promise<void> {
  const { error } = await client.from('tavern_messages').delete().eq('id', messageId);
  if (error) throw toAppError(error);
}

/** Grava a resposta do Tomo na conversa (a pedido de quem chamou). */
export async function postTomoReply(client: CodexveilClient, channel: TavernChannel, body: string): Promise<void> {
  const { error } = await client.rpc('tavern_tomo_reply', {
    p_campaign_id: channel.kind === 'campaign' ? channel.campaignId : null,
    p_recipient_id: channel.kind === 'direct' ? channel.friendId : null,
    p_body: body,
  } as never);
  if (error) throw toAppError(error);
}

/** Mensagens de outras pessoas depois de `since`, por grupo (`c:<campanha>` ou `f:<amigo>`). */
export async function countTavernUnread(client: CodexveilClient, userId: string, since: Record<string, string>, defaultSince: string): Promise<Record<string, number>> {
  const oldest = Object.values(since).reduce((min, value) => (value < min ? value : min), defaultSince);
  const { data, error } = await client
    .from('tavern_messages')
    .select('campaign_id, sender_id, recipient_id, created_at')
    .gt('created_at', oldest)
    .neq('sender_id', userId)
    .limit(500);
  if (error) throw toAppError(error);
  const counts: Record<string, number> = {};
  for (const row of data) {
    const key = row.campaign_id ? `c:${row.campaign_id}` : `f:${row.sender_id}`;
    if (row.created_at > (since[key] ?? defaultSince)) counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
