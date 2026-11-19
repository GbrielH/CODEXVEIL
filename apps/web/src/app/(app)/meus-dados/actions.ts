'use server';

import { setAuraGrant } from '@codexveil/database';
import { ACTIVE_DICE_AURAS, DICE_AURAS, type DiceAura } from '@codexveil/validation';
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
