'use server';

import { createCharacter, getCampaign } from '@codexveil/database';
import {
  PERSONAL_SHEET_CONTEXT,
  buildDnd5eCharacterFromDraft,
  dnd5eDraftSchema,
  parseDnd5eCampaignRules,
  validateDnd5eDraft,
  withDnd5eBookContent,
  type DraftIssue,
  type Dnd5eBookContent,
  type Dnd5eCreationContext,
} from '@codexveil/rpg-systems/dnd5e';
import { characterCreateSchema, uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { failureMessage } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { campaignBookPacks, loadDnd5eBookContent, ownReadyBookPacks } from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CreateCharacterResult =
  | { ok: true; characterId: string }
  | { ok: false; message: string; issues?: DraftIssue[] };

const inputSchema = z.object({
  campaignId: uuidSchema.nullable(),
  draft: z.unknown(),
});

/**
 * Cria um personagem de D&D 5e a partir do rascunho do assistente. O servidor repete toda a
 * validação das regras (SRD 5.2 e regras da campanha) antes de montar e gravar a ficha.
 */
export async function createDnd5eCharacterAction(input: unknown): Promise<CreateCharacterResult> {
  const user = await requireSessionUser(routes.newCharacter);
  const parsedInput = inputSchema.safeParse(input);
  if (!parsedInput.success) return { ok: false, message: 'Requisição inválida.' };
  const draft = dnd5eDraftSchema.safeParse(parsedInput.data.draft);
  if (!draft.success) return { ok: false, message: 'Os dados do personagem estão incompletos ou inválidos.' };
  const campaignId = parsedInput.data.campaignId;

  let supabase;
  let context: Dnd5eCreationContext = PERSONAL_SHEET_CONTEXT;
  // Livros da ficha: os escolhidos na ficha pessoal ou, numa campanha, os do mestre.
  let sourcebooks = draft.data.sourcebooks;
  let content: Dnd5eBookContent;
  try {
    supabase = await createSupabaseServerClient();
    if (campaignId) {
      const campaign = await getCampaign(supabase, campaignId, user.id);
      if (!campaign || campaign.status !== 'active') {
        return { ok: false, message: 'Escolha uma campanha ativa da qual você participa.' };
      }
      if (campaign.role !== 'player') {
        return { ok: false, message: 'Mestres não criam personagens na própria campanha: use os NPCs e monstros da biblioteca.' };
      }
      if (campaign.systemId !== 'dnd5e') return { ok: false, message: 'Esta campanha usa outro sistema de RPG.' };
      const rules = parseDnd5eCampaignRules(campaign.characterRules);
      context = {
        lockedLevel: rules.startingLevel,
        abilityScoreMethods: rules.abilityScoreMethods,
        allowEvilAlignments: rules.allowEvilAlignments,
      };
      sourcebooks = rules.sourcebooks;
      content = await loadDnd5eBookContent(supabase, await campaignBookPacks(supabase, campaign));
    } else {
      // Ficha pessoal: só os livros importados que o jogador marcou (o mesmo que o assistente mostra).
      const own = await ownReadyBookPacks(supabase, user.id);
      content = await loadDnd5eBookContent(supabase, own.filter((pack) => sourcebooks.includes(pack.bookKey)));
    }
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }

  // As regras consultam o SRD e os livros liberados (o mesmo conteúdo que o assistente usou).
  const issues = withDnd5eBookContent(content, () => validateDnd5eDraft(draft.data, context));
  if (issues.length > 0) {
    return { ok: false, message: 'Ainda há escolhas pendentes. Revise os passos indicados.', issues };
  }
  const base = characterCreateSchema.safeParse({ name: draft.data.name, systemId: 'dnd5e', campaignId });
  if (!base.success) return { ok: false, message: base.error.issues[0]?.message ?? 'Dados inválidos.' };

  const built = withDnd5eBookContent(content, () => buildDnd5eCharacterFromDraft({ ...draft.data, sourcebooks }));
  let characterId: string;
  try {
    characterId = await createCharacter(supabase, {
      name: base.data.name,
      systemId: base.data.systemId,
      campaignId: base.data.campaignId,
      sheet: built.sheet,
      resources: built.resources,
      items: built.items,
      abilities: built.abilities,
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }

  revalidatePath(routes.characters);
  if (campaignId) revalidatePath(`/campanhas/${campaignId}`, 'layout');
  return { ok: true, characterId };
}
