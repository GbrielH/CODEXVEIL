'use server';

import { createCharacter, getCampaign } from '@codexveil/database';
import { buildT20Character, buildT20Content, parseT20CampaignRules, parseT20Draft, t20DraftIssues, t20RollTotal } from '@codexveil/rpg-systems/tormenta20';
import { characterCreateSchema, uuidSchema } from '@codexveil/validation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { failureMessage } from '@/lib/actions';
import { requireSessionUser } from '@/lib/auth';
import { campaignBookPacks, loadT20Sources, ownReadyBookPacks } from '@/lib/books';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type CreateT20CharacterResult = { ok: true; characterId: string } | { ok: false; message: string };

const inputSchema = z.object({ campaignId: uuidSchema.nullable(), draft: z.unknown() });

/**
 * Cria um personagem de Tormenta20. O servidor recarrega os livros (da campanha ou do próprio
 * usuário), repete toda a validação das regras e só então monta e grava a ficha.
 */
/**
 * Rolagem de atributos sorteada no servidor (uma vez só): devolve os 6 × 4d6 pendentes da pessoa,
 * sorteando no banco se ainda não houver. Recarregar a página traz o mesmo resultado.
 */
export async function rollT20AttributesAction(): Promise<{ ok: true; dice: number[][] } | { ok: false; message: string }> {
  await requireSessionUser(routes.newCharacter);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('t20_attribute_dice');
    if (error) throw error;
    return { ok: true, dice: data as unknown as number[][] };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}

export async function createT20CharacterAction(input: unknown): Promise<CreateT20CharacterResult> {
  const user = await requireSessionUser(routes.newCharacter);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Requisição inválida.' };
  const draft = parseT20Draft(parsed.data.draft);
  const campaignId = parsed.data.campaignId;

  let supabase;
  let content;
  let allowedMethods: readonly ('pontos' | 'rolagem')[] | undefined;
  let sourcebooks: string[] = [];
  try {
    supabase = await createSupabaseServerClient();
    if (campaignId) {
      const campaign = await getCampaign(supabase, campaignId, user.id);
      if (!campaign || campaign.status !== 'active') return { ok: false, message: 'Escolha uma campanha ativa da qual você participa.' };
      if (campaign.role !== 'player') return { ok: false, message: 'Mestres não criam personagens na própria campanha: use os NPCs e ameaças da biblioteca.' };
      if (campaign.systemId !== 'tormenta20') return { ok: false, message: 'Esta campanha usa outro sistema de RPG.' };
      const rules = parseT20CampaignRules(campaign.characterRules);
      if (draft.level !== rules.startingLevel) return { ok: false, message: `O mestre definiu que os personagens começam no ${rules.startingLevel}º nível.` };
      allowedMethods = rules.attributeMethods;
      const sources = await loadT20Sources(supabase, await campaignBookPacks(supabase, campaign));
      content = buildT20Content(sources);
      sourcebooks = sources.map((source) => source.book.id);
    } else {
      // Ficha pessoal: só os livros marcados no assistente.
      const own = await ownReadyBookPacks(supabase, user.id);
      const sources = await loadT20Sources(supabase, own.filter((pack) => draft.sourcebooks.includes(pack.bookKey)));
      content = buildT20Content(sources);
      sourcebooks = sources.map((source) => source.book.id);
    }
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }

  // Rolagem: os valores da ficha precisam ser os sorteados pelo servidor para esta pessoa.
  if (draft.attributeMethod === 'rolagem') {
    const { data: rolled, error } = await supabase.rpc('t20_attribute_dice');
    const serverTotals = error ? [] : (rolled as unknown as number[][]).map(t20RollTotal).sort((a, b) => a - b);
    const draftTotals = [...draft.rolls].sort((a, b) => a - b);
    if (error || serverTotals.join(',') !== draftTotals.join(',')) {
      return { ok: false, message: 'A rolagem de atributos não confere com a sorteada pelo servidor. Volte ao passo de atributos e role de novo.' };
    }
  }

  const issues = t20DraftIssues(content, draft, allowedMethods ? { allowedMethods } : {});
  if (issues.length > 0) return { ok: false, message: `Ainda há pendências: ${issues[0]!.message}` };
  const base = characterCreateSchema.safeParse({ name: draft.name, systemId: 'tormenta20', campaignId });
  if (!base.success) return { ok: false, message: base.error.issues[0]?.message ?? 'Dados inválidos.' };

  const built = buildT20Character(content, draft, sourcebooks);
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
  // A rolagem foi usada: a próxima criação sorteia de novo.
  if (draft.attributeMethod === 'rolagem') await supabase.rpc('consume_t20_attribute_dice');
  revalidatePath(routes.characters);
  if (campaignId) revalidatePath(`/campanhas/${campaignId}`, 'layout');
  return { ok: true, characterId };
}
