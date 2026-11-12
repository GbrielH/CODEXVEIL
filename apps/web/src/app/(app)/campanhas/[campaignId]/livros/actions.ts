'use server';

import {
  CAMPAIGN_MEDIA_BUCKET,
  campaignMapPath,
  createCampaignItem,
  createCreature,
  createSession,
  createSessionBlocks,
  createSessionMap,
  creatureImagePath,
  downloadBookAsset,
  getBookEntry,
  getBookPack,
  listBookEntries,
  setCreatureImage,
  updateCreatureGmData,
  updateSessionMap,
  type CodexveilClient,
} from '@codexveil/database';
import { ordem2MissionBlocks, parseOrdem2BookPack, type Ordem2BookEntry } from '@codexveil/rpg-systems/ordem2';
import { sessionBlockContentSchema, sessionCreateSchema } from '@codexveil/validation';
import { bookMagicItemToCampaignItem, bookMonsterToStatBlock, safeBookEntryData } from '@codexveil/rpg-systems/dnd5e';
import { safeT20BookEntryData, t20SizeFromType } from '@codexveil/rpg-systems/tormenta20';
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
      creatureId = await createCreature(supabase, campaignId, {
        kind,
        name: entry.name.slice(0, 80),
        subtitle: pack.name.slice(0, 80),
        description: '',
        visibility: 'gm',
        size: t20SizeFromType(threat.type),
      });
      await updateCreatureGmData(supabase, creatureId, { stats: threat, notes: `Copiado de ${pack.name} (livro importado).`, secrets: '' });
    } else {
      const data = entry ? safeBookEntryData('monster', entry.data) : null;
      if (!pack || !entry || !data) return { ok: false, message: 'Criatura não encontrada no livro.' };
      const stats = bookMonsterToStatBlock(data);
      creatureId = await createCreature(supabase, campaignId, {
        kind,
        name: entry.name.slice(0, 80),
        subtitle: pack.name.slice(0, 80),
        description: '',
        visibility: 'gm',
        size: stats.size,
      });
      await updateCreatureGmData(supabase, creatureId, {
        stats,
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

/** Copia uma imagem do livro (bucket `book-assets`) para a mídia da campanha; devolve o caminho. */
async function copyBookImage(
  supabase: CodexveilClient,
  bookKey: string,
  key: string,
  target: (fileName: string) => string,
): Promise<string | null> {
  const match = /^([0-9a-f]{32,64})-(jpg|png|webp)$/.exec(key);
  if (!match) return null;
  const blob = await downloadBookAsset(supabase, 'ordem2', bookKey, key);
  const path = target(`${match[1]!.slice(0, 60)}.${match[2]}`);
  const { error } = await supabase.storage.from(CAMPAIGN_MEDIA_BUCKET).upload(path, blob, {
    contentType: match[2] === 'png' ? 'image/png' : match[2] === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/**
 * Ordem Paranormal 2: monta uma missão pronta do livro na campanha. Cria uma sessão (rascunho, só
 * do mestre) com o roteiro completo (narração, regras de cada cena e os quadros dos pontos de
 * interesse), copia as criaturas para a biblioteca (ocultas, com a ficha e a arte) e cria os
 * mapas da sessão com a imagem do livro.
 */
export async function startOrdem2MissionAction(campaignId: string, packId: string, missionKey: string): Promise<ActionResult> {
  if (!validIds(campaignId, packId, missionKey)) return { ok: false, message: 'Requisição inválida.' };
  let sessionId: string;
  try {
    const supabase = await createSupabaseServerClient();
    const pack = await getBookPack(supabase, packId);
    if (!pack || pack.systemId !== 'ordem2') return { ok: false, message: 'Livro não encontrado.' };
    const rows = await listBookEntries(supabase, [packId], ['mission', 'scene', 'point_of_interest', 'creature', 'map']);
    // Valida as entradas como o importador (o banco guarda JSON livre).
    const { pack: parsed } = parseOrdem2BookPack({
      format: 'codexveil.ordem2.book',
      version: 1,
      book: { id: pack.bookKey, name: pack.name, category: 'core' },
      entries: rows.map((row) => ({ kind: row.kind, key: row.key, name: row.name, data: row.data })),
    });
    const entries = parsed.entries;
    const mission = entries.find((entry) => entry.kind === 'mission' && entry.key === missionKey) as
      | Ordem2BookEntry<'mission'>
      | undefined;
    if (!mission) return { ok: false, message: 'Missão não encontrada no livro (só o mestre lê as missões).' };
    const scenes = mission.data.scenes
      .map((key) => entries.find((entry) => entry.kind === 'scene' && entry.key === key))
      .filter((entry): entry is Ordem2BookEntry<'scene'> => Boolean(entry));

    const creatureIds: Record<string, string> = {};
    for (const key of new Set(scenes.flatMap((scene) => scene.data.creatures))) {
      const creature = entries.find((entry) => entry.kind === 'creature' && entry.key === key) as
        | Ordem2BookEntry<'creature'>
        | undefined;
      if (!creature) continue;
      const id = await createCreature(supabase, campaignId, {
        kind: 'monster',
        name: creature.name.slice(0, 80),
        subtitle: mission.name.slice(0, 80),
        description: creature.data.stats.description.slice(0, 4000),
        visibility: 'gm',
        size: 'medium',
      });
      await updateCreatureGmData(supabase, id, {
        stats: creature.data.stats,
        notes: `Copiado de ${pack.name}, missão ${mission.name} (livro importado).`,
        secrets: '',
      });
      if (creature.data.image) {
        const path = await copyBookImage(supabase, pack.bookKey, creature.data.image, (file) => creatureImagePath(campaignId, file));
        if (path) await setCreatureImage(supabase, id, path);
      }
      creatureIds[key] = id;
    }

    sessionId = await createSession(supabase, campaignId, sessionCreateSchema.parse({ title: mission.name.slice(0, 120) }));

    const mapImages: Record<string, string> = {};
    for (const scene of scenes) {
      for (const key of scene.data.maps) {
        const map = entries.find((entry) => entry.kind === 'map' && entry.key === key) as Ordem2BookEntry<'map'> | undefined;
        if (!map) continue;
        const path = await copyBookImage(supabase, pack.bookKey, map.data.image, (file) => campaignMapPath(campaignId, file));
        if (!path) continue;
        mapImages[key] = path;
        const mapId = await createSessionMap(supabase, { campaignId, sessionId, name: map.name.slice(0, 80) });
        await updateSessionMap(supabase, mapId, { imagePath: path, showGrid: false });
      }
    }

    const blocks = ordem2MissionBlocks({ mission, entries, creatureIds, mapImages }).filter(
      (block) => sessionBlockContentSchema.safeParse(block.content).success,
    );
    await createSessionBlocks(supabase, { sessionId, campaignId, startPosition: 1000, blocks });
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
  revalidatePath(campaignPath(campaignId, '/sessoes'));
  revalidatePath(campaignPath(campaignId, '/biblioteca'));
  redirect(campaignPath(campaignId, `/sessoes/${sessionId}/editar`) as Route);
}
