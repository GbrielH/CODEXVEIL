'use server';

import {
  createCampaignItem,
  createCreature,
  deleteCampaignItem,
  deleteCreature,
  updateCreatureGmData,
} from '@codexveil/database';
import {
  loadSrdMagicItems,
  loadSrdMonsters,
  srdMagicItemToCampaignItem,
  srdMonsterToStatBlock,
  srdSlug,
} from '@codexveil/rpg-systems/dnd5e';
import { campaignItemSchema, creatureSchema, fieldErrorsFrom, uuidSchema } from '@codexveil/validation';
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

/** Copia um monstro do SRD para a biblioteca (oculto dos jogadores), com o bloco de estatísticas. */
export async function importSrdMonsterAction(campaignId: string, slug: string, kind: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(campaignId).success || (kind !== 'npc' && kind !== 'monster')) {
    return { ok: false, message: 'Requisição inválida.' };
  }
  const monster = (await loadSrdMonsters()).find((entry) => srdSlug(entry.name) === slug);
  if (!monster) return { ok: false, message: 'Criatura não encontrada no SRD.' };
  let creatureId: string;
  try {
    const supabase = await createSupabaseServerClient();
    creatureId = await createCreature(supabase, campaignId, {
      kind,
      name: monster.namePt.slice(0, 80),
      subtitle: 'SRD 5.2.1',
      description: '',
      visibility: 'gm',
    });
    await updateCreatureGmData(supabase, creatureId, {
      stats: srdMonsterToStatBlock(monster),
      notes: 'Copiado do SRD 5.2.1 (CC-BY-4.0). Ações e traços com o texto original, em inglês.',
      secrets: '',
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca'));
  redirect(campaignPath(campaignId, `/biblioteca/${creatureId}`) as Route);
}

/** Copia um item mágico do SRD para os itens da campanha (oculto dos jogadores). */
export async function importSrdItemAction(campaignId: string, slug: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(campaignId).success) return { ok: false, message: 'Requisição inválida.' };
  const item = (await loadSrdMagicItems()).find((entry) => srdSlug(entry.name) === slug);
  if (!item) return { ok: false, message: 'Item não encontrado no SRD.' };
  let itemId: string;
  try {
    const supabase = await createSupabaseServerClient();
    itemId = await createCampaignItem(supabase, campaignId, campaignItemSchema.parse(srdMagicItemToCampaignItem(item)), {
      srdName: item.name,
    });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca/itens'));
  redirect(campaignPath(campaignId, `/biblioteca/itens/${itemId}`) as Route);
}

export async function createItemAction(campaignId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSessionUser(campaignPath(campaignId, '/biblioteca/itens'));
  if (!uuidSchema.safeParse(campaignId).success) return { status: 'error', message: 'Requisição inválida.' };
  const weightText = readText(formData, 'weight').replace(',', '.').trim();
  const raw = {
    name: readText(formData, 'name'),
    category: readText(formData, 'category') || 'gear',
    rarity: readText(formData, 'rarity'),
    requiresAttunement: formData.get('requiresAttunement') === 'on',
    weight: weightText === '' ? null : Number(weightText),
    value: readText(formData, 'value'),
    description: readText(formData, 'description'),
    visibility: formData.get('revealed') === 'on' ? 'members' : 'gm',
  };
  const values = { name: raw.name, rarity: raw.rarity, value: raw.value, description: raw.description, weight: weightText, category: raw.category };
  const parsed = campaignItemSchema.safeParse(raw);
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrorsFrom(parsed.error), values };
  let itemId: string;
  try {
    const supabase = await createSupabaseServerClient();
    itemId = await createCampaignItem(supabase, campaignId, parsed.data);
  } catch (error) {
    return { status: 'error', message: failureMessage(error), values };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca/itens'));
  redirect(campaignPath(campaignId, `/biblioteca/itens/${itemId}`) as Route);
}

export async function deleteItemAction(campaignId: string, itemId: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(campaignId).success || !uuidSchema.safeParse(itemId).success) {
    return { ok: false, message: 'Requisição inválida.' };
  }
  try {
    const supabase = await createSupabaseServerClient();
    await deleteCampaignItem(supabase, itemId);
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca/itens'));
  redirect(`${campaignPath(campaignId, '/biblioteca/itens')}?aviso=item-excluido` as Route);
}
