/**
 * Amigos (pedido por código ou a partir de quem já joga junto), convite direto para campanhas e
 * personagens compartilhados com amigos (só leitura). As regras ficam no banco (RLS e funções).
 */
import { AppError } from '@codexveil/domain';
import { preferencesSchema, type AvatarIcon } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';

export interface Friend {
  /** Registro da amizade (para aceitar ou desfazer). */
  friendshipId: string;
  userId: string;
  displayName: string;
  avatarIcon: AvatarIcon | null;
  status: 'accepted' | 'incoming' | 'outgoing';
}

export async function getMyFriendCode(client: CodexveilClient, userId: string): Promise<string> {
  const { data, error } = await client.from('profiles').select('friend_code').eq('id', userId).single();
  if (error) throw toAppError(error);
  return data.friend_code;
}

export async function listFriends(client: CodexveilClient, userId: string): Promise<Friend[]> {
  const { data, error } = await client
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  const others = data.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id));
  if (others.length === 0) return [];
  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id, display_name, preferences')
    .in('id', others);
  if (profileError) throw toAppError(profileError);
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return data
    .map((row): Friend => {
      const other = row.requester_id === userId ? row.addressee_id : row.requester_id;
      const profile = byId.get(other);
      return {
        friendshipId: row.id,
        userId: other,
        displayName: profile?.display_name ?? 'Conta removida',
        avatarIcon: preferencesSchema.safeParse(profile?.preferences).data?.avatar ?? null,
        status: row.status === 'accepted' ? 'accepted' : row.addressee_id === userId ? 'incoming' : 'outgoing',
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

const requestMessages: Record<string, string> = {
  not_found: 'Nenhuma conta com esse código.',
  self: 'Esse é o seu próprio código.',
  limit: 'Limite de amigos atingido.',
  not_authenticated: 'Entre na sua conta.',
};

/** Pede amizade pelo código de amigo ou pelo id de quem já joga numa campanha com você. */
export async function requestFriend(
  client: CodexveilClient,
  target: { code: string } | { userId: string },
): Promise<'pending' | 'accepted'> {
  const { data, error } = await client.rpc(
    'request_friend',
    'code' in target ? { p_code: target.code } : { p_user_id: target.userId },
  );
  if (error) throw toAppError(error);
  const result = data as { ok: boolean; status?: 'pending' | 'accepted'; reason?: string };
  if (!result.ok) throw new AppError('validation', requestMessages[result.reason ?? ''] ?? 'Não foi possível enviar o pedido.');
  return result.status ?? 'pending';
}

export async function acceptFriend(client: CodexveilClient, friendshipId: string): Promise<void> {
  const { error } = await client.rpc('accept_friend', { p_friendship_id: friendshipId });
  if (error) throw toAppError(error);
}

/** Recusa um pedido, cancela o enviado ou desfaz a amizade. */
export async function removeFriend(client: CodexveilClient, friendshipId: string): Promise<void> {
  const { error } = await client.from('friendships').delete().eq('id', friendshipId);
  if (error) throw toAppError(error);
}

export async function inviteFriendToCampaign(client: CodexveilClient, campaignId: string, friendId: string): Promise<void> {
  const { error } = await client.rpc('invite_friend_to_campaign', { p_campaign_id: campaignId, p_friend_id: friendId });
  if (error) throw toAppError(error);
}

/** Amigos com quem o dono compartilhou a ficha. */
export async function listCharacterShares(client: CodexveilClient, characterId: string): Promise<string[]> {
  const { data, error } = await client.from('character_shares').select('user_id').eq('character_id', characterId);
  if (error) throw toAppError(error);
  return data.map((row) => row.user_id);
}

export async function shareCharacter(client: CodexveilClient, characterId: string, friendId: string): Promise<void> {
  const { error } = await client.from('character_shares').insert({ character_id: characterId, user_id: friendId });
  if (error) throw toAppError(error);
}

export async function unshareCharacter(client: CodexveilClient, characterId: string, friendId: string): Promise<void> {
  const { error } = await client.from('character_shares').delete().eq('character_id', characterId).eq('user_id', friendId);
  if (error) throw toAppError(error);
}

export interface SharedCharacter {
  id: string;
  name: string;
  systemId: string;
  ownerName: string;
}

/** Personagens que amigos compartilharam comigo. */
export async function listCharactersSharedWithMe(client: CodexveilClient, userId: string): Promise<SharedCharacter[]> {
  const { data, error } = await client.from('character_shares').select('character_id').eq('user_id', userId);
  if (error) throw toAppError(error);
  if (data.length === 0) return [];
  const { data: characters, error: characterError } = await client
    .from('characters')
    .select('id, name, system_id, owner:profiles!characters_owner_id_fkey(display_name)')
    .in(
      'id',
      data.map((row) => row.character_id),
    )
    .order('name');
  if (characterError) throw toAppError(characterError);
  return characters.map((row) => ({
    id: row.id,
    name: row.name,
    systemId: row.system_id,
    ownerName: row.owner?.display_name ?? '',
  }));
}

export interface KnownPerson {
  userId: string;
  displayName: string;
  avatarIcon: AvatarIcon | null;
}

/** Pessoas cujo perfil eu já vejo (quem joga comigo e amigos), para adicionar com um clique. */
export async function listKnownPeople(client: CodexveilClient, userId: string): Promise<KnownPerson[]> {
  const { data, error } = await client.from('profiles').select('id, display_name, preferences').neq('id', userId).order('display_name').limit(200);
  if (error) throw toAppError(error);
  return data.map((row) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarIcon: preferencesSchema.safeParse(row.preferences).data?.avatar ?? null,
  }));
}
