import { getCharacter, type CharacterDetail } from '@codexveil/database';
import { uuidSchema } from '@codexveil/validation';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requireSessionUser, type SessionUser } from '@/lib/auth';
import { characterPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Carrega o personagem para a requisição atual. Inexistente e sem permissão produzem o
 * mesmo "não encontrado": trocar o UUID na URL não revela se a ficha existe.
 */
export const loadCharacterOrNotFound = cache(
  async (characterId: string): Promise<{ user: SessionUser; character: CharacterDetail }> => {
    const user = await requireSessionUser(characterPath(characterId));
    if (!uuidSchema.safeParse(characterId).success) notFound();
    const supabase = await createSupabaseServerClient();
    const character = await getCharacter(supabase, characterId, user.id);
    if (!character) notFound();
    return { user, character };
  },
);
