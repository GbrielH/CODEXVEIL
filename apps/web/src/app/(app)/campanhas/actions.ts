'use server';

import {
  archiveCampaign,
  createCampaign,
  createCampaignInvite,
  deleteCampaign,
  leaveCampaign,
  removeCampaignMedia,
  removeCampaignMember,
  revokeCampaignInvite,
  setCampaignMemberRole,
  transferCampaignOwnership,
  unarchiveCampaign,
  updateCampaign,
} from '@codexveil/database';
import { CAMPAIGN_ROLES, formatInviteCode } from '@codexveil/domain';
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  fieldErrorsFrom,
  inviteCreateSchema,
  uuidSchema,
} from '@codexveil/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { failureMessage, readText, type ActionResult, type FormState } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { readCampaignRules } from '@/lib/campaign-rules';
import { siteUrl } from '@/lib/env';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ids = (...values: unknown[]) => values.every((value) => uuidSchema.safeParse(value).success);
const invalidRequest: ActionResult = { ok: false, message: 'Requisição inválida.' };

function campaignPath(campaignId: string, section = ''): Route {
  return `/campanhas/${campaignId}${section}` as Route;
}

export async function createCampaignAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireSessionUser(routes.newCampaign);
  const raw = {
    name: readText(formData, 'name'),
    description: readText(formData, 'description'),
    systemId: readText(formData, 'systemId'),
  };
  const rules = readCampaignRules(raw.systemId, formData);
  const parsed = campaignCreateSchema.safeParse({ ...raw, characterRules: rules.ok ? rules.rules : {} });
  if (!parsed.success || !rules.ok) {
    return {
      status: 'error',
      fieldErrors: { ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)), ...(rules.ok ? {} : rules.fieldErrors) },
      values: raw,
    };
  }

  let campaignId: string;
  try {
    const supabase = await createSupabaseServerClient();
    campaignId = await createCampaign(supabase, parsed.data);
  } catch (error) {
    return { status: 'error', message: failureMessage(error), values: raw };
  }

  revalidatePath(routes.dashboard);
  redirect(`${campaignPath(campaignId)}?aviso=campanha-criada` as Route);
}

export async function updateCampaignAction(
  campaignId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!ids(campaignId)) return { status: 'error', message: 'Requisição inválida.' };
  const raw = {
    name: readText(formData, 'name'),
    description: readText(formData, 'description'),
    partySheetsVisible: formData.get('partySheetsVisible') === 'on',
    playersCanEditSheets: formData.get('playersCanEditSheets') === 'on',
  };
  // O sistema só escolhe o leitor dos campos; o banco guarda as regras como JSON opaco.
  const rules = readCampaignRules(readText(formData, 'systemId'), formData);
  const parsed = campaignUpdateSchema.safeParse({ ...raw, ...(rules.ok ? { characterRules: rules.rules } : {}) });
  if (!parsed.success || !rules.ok) {
    return {
      status: 'error',
      fieldErrors: { ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)), ...(rules.ok ? {} : rules.fieldErrors) },
      values: { name: raw.name, description: raw.description },
    };
  }
  try {
    const supabase = await createSupabaseServerClient();
    await updateCampaign(supabase, campaignId, parsed.data);
  } catch (error) {
    return { status: 'error', message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  return { status: 'success', message: 'Alterações salvas.' };
}

export async function archiveCampaignAction(campaignId: string): Promise<ActionResult> {
  if (!ids(campaignId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await archiveCampaign(supabase, campaignId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  revalidatePath(routes.dashboard);
  return { ok: true, message: 'Campanha arquivada. Os dados continuam preservados.' };
}

export async function unarchiveCampaignAction(campaignId: string): Promise<ActionResult> {
  if (!ids(campaignId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await unarchiveCampaign(supabase, campaignId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  revalidatePath(routes.dashboard);
  return { ok: true, message: 'Campanha reaberta.' };
}

export async function deleteCampaignAction(campaignId: string): Promise<ActionResult> {
  if (!ids(campaignId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await removeCampaignMedia(supabase, campaignId);
    await deleteCampaign(supabase, campaignId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(routes.dashboard);
  redirect(`${routes.campaigns}?aviso=campanha-excluida` as Route);
}

export interface InviteFormState extends FormState {
  invite?: { code: string; link: string };
}

export async function createInviteAction(
  campaignId: string,
  _previous: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  if (!ids(campaignId)) return { status: 'error', message: 'Requisição inválida.' };
  const unlimited = formData.get('unlimited') === 'on';
  const email = readText(formData, 'invitedEmail').trim();
  const raw = {
    expiresInDays: Number(readText(formData, 'expiresInDays') || '7'),
    maxUses: email ? 1 : unlimited ? null : Number(readText(formData, 'maxUses') || '1'),
    invitedEmail: email.length > 0 ? email : null,
  };
  const parsed = inviteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const invite = await createCampaignInvite(supabase, campaignId, parsed.data);
    revalidatePath(campaignPath(campaignId, '/convites'));
    const code = formatInviteCode(invite.code);
    return {
      status: 'success',
      message: 'Convite criado. Compartilhe o código ou o link com o jogador.',
      invite: { code, link: `${siteUrl()}/convite/${code}` },
    };
  } catch (error) {
    return { status: 'error', message: failureMessage(error) };
  }
}

export async function revokeInviteAction(campaignId: string, inviteId: string): Promise<ActionResult> {
  if (!ids(campaignId, inviteId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await revokeCampaignInvite(supabase, inviteId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/convites'));
  return { ok: true, message: 'Convite revogado.' };
}

export async function removeMemberAction(campaignId: string, userId: string): Promise<ActionResult> {
  if (!ids(campaignId, userId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await removeCampaignMember(supabase, campaignId, userId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  return { ok: true, message: 'Participante removido.' };
}

export async function setMemberRoleAction(
  campaignId: string,
  userId: string,
  role: string,
): Promise<ActionResult> {
  const parsedRole = z.enum(CAMPAIGN_ROLES).safeParse(role);
  if (!ids(campaignId, userId) || !parsedRole.success) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await setCampaignMemberRole(supabase, campaignId, userId, parsedRole.data);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  return { ok: true, message: parsedRole.data === 'gm' ? 'Agora é mestre.' : 'Agora é jogador.' };
}

export async function transferOwnershipAction(campaignId: string, userId: string): Promise<ActionResult> {
  if (!ids(campaignId, userId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await transferCampaignOwnership(supabase, campaignId, userId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId), 'layout');
  return { ok: true, message: 'A campanha tem um novo mestre responsável.' };
}

export async function leaveCampaignAction(campaignId: string): Promise<ActionResult> {
  if (!ids(campaignId)) return invalidRequest;
  try {
    const supabase = await createSupabaseServerClient();
    await leaveCampaign(supabase, campaignId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(routes.dashboard);
  redirect(`${routes.dashboard}?aviso=saiu-da-campanha` as Route);
}
