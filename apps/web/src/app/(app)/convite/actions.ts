'use server';

import { acceptCampaignInvite, declineCampaignInvite } from '@codexveil/database';
import { formatInviteCode, inviteRejectionMessages } from '@codexveil/domain';
import { inviteCodeSchema } from '@codexveil/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { failureMessage, readText, type FormState } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function goToInviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireSessionUser('/convite');
  const code = readText(formData, 'code');
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: { code: parsed.error.issues[0]?.message ?? 'Código inválido.' },
      values: { code },
    };
  }
  redirect(`/convite/${formatInviteCode(parsed.data)}` as Route);
}

export async function acceptInviteAction(code: string, _previous: FormState): Promise<FormState> {
  await requireSessionUser(`/convite/${code}`);
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return { status: 'error', message: inviteRejectionMessages.invalid_code };

  let result: Awaited<ReturnType<typeof acceptCampaignInvite>>;
  try {
    const supabase = await createSupabaseServerClient();
    result = await acceptCampaignInvite(supabase, parsed.data);
  } catch (error) {
    return { status: 'error', message: failureMessage(error) };
  }

  // Redirecionamentos ficam fora do try: `redirect` funciona lançando um sinal interno.
  if (result.ok) {
    revalidatePath(routes.dashboard);
    redirect(`/campanhas/${result.campaignId}?aviso=convite-aceito` as Route);
  }
  if (result.reason === 'already_member' && result.campaignId) {
    redirect(`/campanhas/${result.campaignId}` as Route);
  }
  return { status: 'error', message: inviteRejectionMessages[result.reason] };
}

export async function declineInviteAction(code: string, _previous: FormState): Promise<FormState> {
  await requireSessionUser(`/convite/${code}`);
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return { status: 'error', message: inviteRejectionMessages.invalid_code };
  try {
    const supabase = await createSupabaseServerClient();
    await declineCampaignInvite(supabase, parsed.data);
  } catch (error) {
    return { status: 'error', message: failureMessage(error) };
  }
  revalidatePath(routes.dashboard);
  redirect(`${routes.dashboard}?aviso=convite-recusado` as Route);
}
