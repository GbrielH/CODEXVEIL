'use server';

import { createCharacter, getCampaign } from '@codexveil/database';
import {
  creationIssues,
  parseTriangleAgencySheet,
  triangleAgencyDefaultResources,
} from '@codexveil/rpg-systems/triangle-agency';
import { characterCreateSchema, creationAnswersSchema, uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { failureMessage } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { keepAsNpc, npcCampaignIdFrom } from '@/lib/npc-creation';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const inputSchema = z.object({
  campaignId: uuidSchema.nullable(),
  name: z.string(),
  sheet: z.unknown(),
  answers: creationAnswersSchema.default([]),
});

export async function createTriangleAgencyCharacterAction(
  input: unknown,
): Promise<{ ok: true; characterId: string } | { ok: false; message: string }> {
  const user = await requireSessionUser(routes.newCharacter);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Requisição inválida.' };
  let sheet;
  try {
    sheet = parseTriangleAgencySheet(parsed.data.sheet);
  } catch {
    return { ok: false, message: 'A ficha do Agente tem dados inválidos.' };
  }
  const pending = creationIssues(sheet);
  if (pending.length) return { ok: false, message: `Ainda há pendências: ${pending[0]}` };
  const supabase = await createSupabaseServerClient();
  if (parsed.data.campaignId) {
    const campaign = await getCampaign(supabase, parsed.data.campaignId, user.id);
    if (!campaign || campaign.status !== 'active' || campaign.role !== 'player')
      return {
        ok: false,
        message: 'Escolha uma campanha ativa da qual você participa como Agente.',
      };
    if (campaign.systemId !== 'triangle-agency')
      return { ok: false, message: 'Esta campanha usa outro sistema de RPG.' };
    if (
      campaign.creationQuestions.some(
        (question) =>
          !parsed.data.answers.some((entry) => entry.question === question && entry.answer.trim()),
      )
    )
      return { ok: false, message: 'Responda a todas as perguntas do Diretor.' };
  }
  const base = characterCreateSchema.safeParse({
    name: parsed.data.name,
    systemId: 'triangle-agency',
    campaignId: parsed.data.campaignId,
  });
  if (!base.success)
    return { ok: false, message: base.error.issues[0]?.message ?? 'Dados inválidos.' };
  try {
    const characterId = await createCharacter(supabase, {
      ...base.data,
      sheet,
      resources: triangleAgencyDefaultResources(sheet),
      ...(base.data.campaignId ? { answers: parsed.data.answers } : {}),
    });
    const npcFailure = await keepAsNpc(supabase, characterId, npcCampaignIdFrom(input));
    if (npcFailure) return npcFailure;
    revalidatePath(routes.characters);
    if (base.data.campaignId) revalidatePath(`/campanhas/${base.data.campaignId}`, 'layout');
    return { ok: true, characterId };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}
