'use server';

import { createCharacter, getCampaign } from '@codexveil/database';
import {
  assimilacaoDefaultResources,
  creationIssues,
  parseAssimilacaoCampaignRules,
  parseAssimilacaoSheet,
} from '@codexveil/rpg-systems/assimilacao';
import { characterCreateSchema, creationAnswersSchema, uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { failureMessage } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CreateAssimilacaoCharacterResult =
  { ok: true; characterId: string } | { ok: false; message: string };

const inputSchema = z.object({
  campaignId: uuidSchema.nullable(),
  name: z.string(),
  sheet: z.unknown(),
  answers: creationAnswersSchema.default([]),
});

/**
 * Cria um Infectado. O servidor relê as regras da campanha, repete os limites da criação
 * (Instintos, Conhecimentos/Práticas, Experiência) e o Cabo de Guerra inicial antes de gravar.
 */
export async function createAssimilacaoCharacterAction(
  input: unknown,
): Promise<CreateAssimilacaoCharacterResult> {
  await requireSessionUser(routes.newCharacter);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Requisição inválida.' };
  let sheet;
  try {
    sheet = parseAssimilacaoSheet(parsed.data.sheet);
  } catch {
    return { ok: false, message: 'A ficha tem dados inválidos.' };
  }
  const { campaignId, answers } = parsed.data;

  let supabase;
  let experience = 7;
  try {
    supabase = await createSupabaseServerClient();
    if (campaignId) {
      const user = await requireSessionUser(routes.newCharacter);
      const campaign = await getCampaign(supabase, campaignId, user.id);
      if (!campaign || campaign.status !== 'active')
        return { ok: false, message: 'Escolha uma campanha ativa da qual você participa.' };
      if (campaign.role !== 'player')
        return {
          ok: false,
          message:
            'Mestres não criam Infectados na própria campanha: use as Ameaças da biblioteca.',
        };
      if (campaign.systemId !== 'assimilacao')
        return { ok: false, message: 'Esta campanha usa outro sistema de RPG.' };
      const missing = campaign.creationQuestions.some(
        (question) => !answers.find((entry) => entry.question === question && entry.answer.trim()),
      );
      if (missing) return { ok: false, message: 'Responda a todas as perguntas do mestre.' };
      const rules = parseAssimilacaoCampaignRules(campaign.characterRules);
      experience = rules.startingExperience;
      // O Cabo de Guerra inicial é o da campanha (a Característica Estágio Avançado tira 1 a mais).
      const advanced = sheet.characteristics.some((entry) =>
        /est[aá]gio avan[cç]ado/i.test(entry.name),
      );
      const expected = rules.startingDetermination - (advanced ? 1 : 0);
      if (sheet.tugOfWar.determinationLevel !== expected)
        return {
          ok: false,
          message: `Nesta campanha o Infectado começa com Determinação ${expected}.`,
        };
    }
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }

  sheet = { ...sheet, experience: { ...sheet.experience, total: experience } };
  const issues = creationIssues(sheet, experience);
  if (issues.length > 0) return { ok: false, message: `Ainda há pendências: ${issues[0]}` };
  const base = characterCreateSchema.safeParse({
    name: parsed.data.name,
    systemId: 'assimilacao',
    campaignId,
  });
  if (!base.success)
    return { ok: false, message: base.error.issues[0]?.message ?? 'Dados inválidos.' };

  let characterId: string;
  try {
    characterId = await createCharacter(supabase, {
      name: base.data.name,
      systemId: base.data.systemId,
      campaignId: base.data.campaignId,
      sheet,
      resources: assimilacaoDefaultResources(sheet),
      ...(campaignId ? { answers } : {}),
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(routes.characters);
  if (campaignId) revalidatePath(`/campanhas/${campaignId}`, 'layout');
  return { ok: true, characterId };
}
