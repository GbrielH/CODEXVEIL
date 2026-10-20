'use server';

import { createSession, deleteSession, duplicateSession, notifySessionScheduled, setSessionStatus } from '@codexveil/database';
import { fieldErrorsFrom, sessionCreateSchema, uuidSchema } from '@codexveil/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { failureMessage, readText, type ActionResult, type FormState } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { fromBrasiliaInput } from '@/lib/format';
import { campaignPath, sessionPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ids = (...values: unknown[]) => values.every((value) => uuidSchema.safeParse(value).success);

export async function createSessionAction(
  campaignId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSessionUser(campaignPath(campaignId, '/sessoes'));
  if (!ids(campaignId)) return { status: 'error', message: 'Requisição inválida.' };
  // Data no horário de Brasília; texto inválido segue adiante para o esquema recusar.
  const scheduledAt = fromBrasiliaInput(readText(formData, 'scheduledAt'));
  const raw = {
    title: readText(formData, 'title'),
    scheduledAt: scheduledAt === undefined ? 'data-invalida' : scheduledAt,
    isPublished: formData.get('isPublished') === 'on',
    mode: formData.get('mode') === 'online' ? ('online' as const) : ('presencial' as const),
    physicalDice: formData.get('physicalDice') === 'on',
  };
  const parsed = sessionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { title: raw.title, scheduledAt: readText(formData, 'scheduledAt') },
    };
  }

  let sessionId: string;
  try {
    const supabase = await createSupabaseServerClient();
    sessionId = await createSession(supabase, campaignId, parsed.data);
    // Sessão publicada com data: avisa os jogadores no app (falhas não impedem a criação).
    if (parsed.data.isPublished && parsed.data.scheduledAt) await notifySessionScheduled(supabase, sessionId);
  } catch (error) {
    return { status: 'error', message: failureMessage(error), values: { title: raw.title } };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  redirect(sessionPath(campaignId, sessionId, '/editar') as Route);
}

export async function duplicateSessionAction(campaignId: string, sessionId: string): Promise<ActionResult> {
  if (!ids(campaignId, sessionId)) return { ok: false, message: 'Requisição inválida.' };
  let copyId: string;
  try {
    const supabase = await createSupabaseServerClient();
    copyId = await duplicateSession(supabase, sessionId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  redirect(sessionPath(campaignId, copyId, '/editar') as Route);
}

export async function deleteSessionAction(campaignId: string, sessionId: string): Promise<ActionResult> {
  if (!ids(campaignId, sessionId)) return { ok: false, message: 'Requisição inválida.' };
  try {
    const supabase = await createSupabaseServerClient();
    await deleteSession(supabase, sessionId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  redirect(`${campaignPath(campaignId, '/sessoes')}?aviso=sessao-excluida` as Route);
}

const statusSchema = z.enum(['planned', 'in_progress', 'completed']);

export async function setSessionStatusAction(
  campaignId: string,
  sessionId: string,
  status: string,
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(status);
  if (!ids(campaignId, sessionId) || !parsed.success) return { ok: false, message: 'Requisição inválida.' };
  try {
    const supabase = await createSupabaseServerClient();
    await setSessionStatus(supabase, sessionId, parsed.data);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  const messages = {
    planned: 'Sessão marcada como planejada.',
    in_progress: 'Sessão iniciada. Ela aparece na mesa do mestre.',
    completed: 'Sessão concluída.',
  };
  return { ok: true, message: messages[parsed.data] };
}
