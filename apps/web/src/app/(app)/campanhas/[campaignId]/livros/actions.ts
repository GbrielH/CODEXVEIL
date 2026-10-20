'use server';

import { createCampaignItem, createCreature, getBookEntry, getBookPack, updateCreatureGmData } from '@codexveil/database';
import { bookMagicItemToCampaignItem, bookMonsterToStatBlock, safeBookEntryData } from '@codexveil/rpg-systems/dnd5e';
import { safeT20BookEntryData } from '@codexveil/rpg-systems/tormenta20';
import { campaignItemSchema, uuidSchema } from '@codexveil/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { failureMessage, type ActionResult } from '@/lib/actions';
import { campaignPath } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validIds(campaignId: string, packId: string, key: string): boolean {
  return uuidSchema.safeParse(campaignId).success && uuidSchema.safeParse(packId).success && keyPattern.test(key) && key.length <= 80;
}

/**
 * Copia um monstro de um livro liberado para a biblioteca (oculto dos jogadores). O RLS só
 * entrega monstros dos livros aos mestres, e só mestres criam registros na biblioteca.
 */
export async function copyBookMonsterAction(campaignId: string, packId: string, key: string, kind: string): Promise<ActionResult> {
  if (!validIds(campaignId, packId, key) || (kind !== 'npc' && kind !== 'monster')) return { ok: false, message: 'Requisição inválida.' };
  let creatureId: string;
  try {
    const supabase = await createSupabaseServerClient();
    const [pack, entry] = await Promise.all([getBookPack(supabase, packId), getBookEntry(supabase, packId, 'monster', key)]);
    if (pack?.systemId === 'tormenta20') {
      // Ameaça do Tormenta20: a ficha do livro já está no formato das estatísticas T20.
      const threat = entry ? safeT20BookEntryData('monster', entry.data) : null;
      if (!entry || !threat) return { ok: false, message: 'Ameaça não encontrada no livro.' };
      creatureId = await createCreature(supabase, campaignId, { kind, name: entry.name.slice(0, 80), subtitle: pack.name.slice(0, 80), description: '', visibility: 'gm' });
      await updateCreatureGmData(supabase, creatureId, { stats: threat, notes: `Copiado de ${pack.name} (livro importado).`, secrets: '' });
    } else {
      const data = entry ? safeBookEntryData('monster', entry.data) : null;
      if (!pack || !entry || !data) return { ok: false, message: 'Criatura não encontrada no livro.' };
      creatureId = await createCreature(supabase, campaignId, {
        kind,
        name: entry.name.slice(0, 80),
        subtitle: pack.name.slice(0, 80),
        description: '',
        visibility: 'gm',
      });
      await updateCreatureGmData(supabase, creatureId, {
        stats: bookMonsterToStatBlock(data),
        notes: [`Copiado de ${pack.name} (livro importado).`, ...data.lore].join('\n\n').slice(0, 8000),
        secrets: '',
      });
    }
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca'));
  redirect(campaignPath(campaignId, `/biblioteca/${creatureId}`) as Route);
}

/** Copia um item mágico de um livro liberado para os itens da campanha (oculto dos jogadores). */
export async function copyBookItemAction(campaignId: string, packId: string, key: string): Promise<ActionResult> {
  if (!validIds(campaignId, packId, key)) return { ok: false, message: 'Requisição inválida.' };
  let itemId: string;
  try {
    const supabase = await createSupabaseServerClient();
    const [pack, entry] = await Promise.all([getBookPack(supabase, packId), getBookEntry(supabase, packId, 'magic_item', key)]);
    const data = entry ? safeBookEntryData('magic_item', entry.data) : null;
    if (!pack || !entry || !data) return { ok: false, message: 'Item não encontrado no livro.' };
    itemId = await createCampaignItem(supabase, campaignId, campaignItemSchema.parse(bookMagicItemToCampaignItem(entry.name, data, pack.name)));
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/biblioteca/itens'));
  redirect(campaignPath(campaignId, `/biblioteca/itens/${itemId}`) as Route);
}
