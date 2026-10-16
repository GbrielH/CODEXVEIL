'use server';

import { createCreature, deleteCreature } from '@codexveil/database';
import { creatureSchema, fieldErrorsFrom, uuidSchema } from '@codexveil/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { failureMessage, readText, type ActionResult, type FormState } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function createCreatureAction(
  campaignId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionUser(campaignPath(campaignId, '/biblioteca'));
  if (!uuidSchema.safeParse(campaignId).success) return { status: 'error', message: 'Requisição inválida.' };
  const raw = {
    kind: readText(formData, 'kind'),
    name: readText(formData, 'name'),
    subtitle: readText(formData, 'subtitle'),
    description: '',
    visibility: formData.get('revealed') === 'on' ? 'members' : 'gm',
  };
  const parsed = creatureSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values: { name: raw.name, subtitle: raw.subtitle, kind: raw.kind } };
  }
  let creatureId: string;
  try {
    const supabase = await createSupabaseServerClient();
    creatureId = await createCreature(supabase, campaignId, parsed.data);
  } catch (error) {
    return { status: 'error', message: failureMessage(error), values: { name: raw.name, subtitle: raw.subtitle, kind: raw.kind } };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca'));
  redirect(campaignPath(campaignId, `/biblioteca/${creatureId}`) as Route);
}

export async function deleteCreatureAction(campaignId: string, creatureId: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(campaignId).success || !uuidSchema.safeParse(creatureId).success) {
    return { ok: false, message: 'Requisição inválida.' };
  }
  try {
    const supabase = await createSupabaseServerClient();
    await deleteCreature(supabase, creatureId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca'));
  redirect(`${campaignPath(campaignId, '/biblioteca')}?aviso=registro-excluido` as Route);
}
