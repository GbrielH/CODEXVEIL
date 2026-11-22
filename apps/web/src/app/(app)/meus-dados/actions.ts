'use server';

import { getProfile, setAuraGrant, updateProfile } from '@codexveil/database';
import {
  ACTIVE_DICE_AURAS,
  AURA_ART_PATH,
  AURA_SOUND_PATH,
  DICE_AURAS,
  type DiceAura,
} from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { failureMessage, type ActionResult } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Conta de criador: libera (ou retira) uma aura para um amigo. O banco confere tudo (RLS). */
export async function setAuraGrantAction(
  friendId: string,
  aura: DiceAura,
  allowed: boolean,
): Promise<ActionResult> {
  await requireSessionUser(routes.myDice);
  if (!DICE_AURAS.includes(aura)) return { ok: false, message: 'Aura desconhecida.' };
  if (!ACTIVE_DICE_AURAS.includes(aura)) return { ok: false, message: 'Aura em breve.' };
  try {
    const supabase = await createSupabaseServerClient();
    await setAuraGrant(supabase, friendId, aura, allowed);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(routes.myDice);
  return { ok: true };
}

/**
 * Conta de criador: guarda (ou tira) a imagem própria do crítico de uma aura. O arquivo já foi
 * enviado pelo navegador para `users/{conta}/dice/`; aqui só o caminho vai para o perfil.
 */
export async function setAuraArtAction(aura: DiceAura, path: string | null): Promise<ActionResult> {
  const user = await requireSessionUser(routes.myDice);
  if (!DICE_AURAS.includes(aura)) return { ok: false, message: 'Aura desconhecida.' };
  if (path && (!AURA_ART_PATH.test(path) || !path.startsWith(`users/${user.id}/`)))
    return { ok: false, message: 'Imagem inválida.' };
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfile(supabase, user.id);
    if (!profile) return { ok: false, message: 'Perfil não encontrado.' };
    if (!profile.creatorFeatures)
      return { ok: false, message: 'Só contas de criador enviam imagem para o crítico.' };
    const auraArt = { ...profile.preferences.auraArt };
    if (path) auraArt[aura] = path;
    else delete auraArt[aura];
    await updateProfile(supabase, user.id, {
      displayName: profile.displayName,
      bio: profile.bio,
      preferences: { ...profile.preferences, auraArt },
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(routes.myDice);
  return { ok: true };
}

/** Conta de criador: guarda (ou tira) o som próprio do crítico de uma aura. */
export async function setAuraSoundAction(
  aura: DiceAura,
  path: string | null,
): Promise<ActionResult> {
  const user = await requireSessionUser(routes.myDice);
  if (!DICE_AURAS.includes(aura)) return { ok: false, message: 'Aura desconhecida.' };
  if (path && (!AURA_SOUND_PATH.test(path) || !path.startsWith(`users/${user.id}/sounds/`)))
    return { ok: false, message: 'Som inválido.' };
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfile(supabase, user.id);
    if (!profile) return { ok: false, message: 'Perfil não encontrado.' };
    if (!profile.creatorFeatures)
      return { ok: false, message: 'Só contas de criador enviam som para o crítico.' };
    const auraSound = { ...profile.preferences.auraSound };
    if (path) auraSound[aura] = path;
    else delete auraSound[aura];
    await updateProfile(supabase, user.id, {
      displayName: profile.displayName,
      bio: profile.bio,
      preferences: { ...profile.preferences, auraSound },
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(routes.myDice);
  return { ok: true };
}
