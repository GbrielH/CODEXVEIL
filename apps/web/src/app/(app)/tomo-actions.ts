'use server';

import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { executeTomoAction, type TomoActionResult } from '@/lib/tomo-run';

export type { TomoActionResult };

/** Ação proposta pelo Tomo e confirmada no chat do site (o app usa `/api/assistente/acao`). */
export async function runTomoAction(
  scope: { campaignId?: unknown; characterId?: unknown },
  input: unknown,
): Promise<TomoActionResult> {
  const user = await requireSessionUser(routes.dashboard);
  return executeTomoAction(await createSupabaseServerClient(), user, scope, input);
}
