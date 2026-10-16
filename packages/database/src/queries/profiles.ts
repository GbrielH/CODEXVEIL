import { preferencesSchema, type Preferences, type ProfileUpdate } from '@codexveil/validation';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Tables } from '../types.gen';

export interface Profile {
  id: string;
  displayName: string;
  avatarPath: string | null;
  bio: string;
  preferences: Preferences;
  createdAt: string;
}

export const PROFILE_COLUMNS = 'id, display_name, avatar_path, bio, preferences, created_at' as const;

type ProfileRow = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'avatar_path' | 'bio' | 'preferences' | 'created_at'
>;

export function toProfile(row: ProfileRow): Profile {
  const preferences = preferencesSchema.safeParse(row.preferences);
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    bio: row.bio,
    preferences: preferences.success ? preferences.data : preferencesSchema.parse({}),
    createdAt: row.created_at,
  };
}

export async function getProfile(client: CodexveilClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toProfile(data) : null;
}

export async function updateProfile(
  client: CodexveilClient,
  userId: string,
  input: ProfileUpdate,
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update({
      display_name: input.displayName,
      bio: input.bio,
      preferences: input.preferences,
    })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return toProfile(data);
}

export async function setAvatarPath(
  client: CodexveilClient,
  userId: string,
  avatarPath: string | null,
): Promise<void> {
  const { error } = await client.from('profiles').update({ avatar_path: avatarPath }).eq('id', userId);
  if (error) throw toAppError(error);
}

/** URL pública do avatar (bucket `avatars` é público por decisão de produto). */
export function avatarUrl(client: CodexveilClient, path: string | null): string | null {
  if (!path) return null;
  return client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
