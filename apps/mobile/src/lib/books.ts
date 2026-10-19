import { getCampaign, listBookEntries, listCampaignBookPacks, listMyBookPacks, type BookPackSummary, type CodexveilClient } from '@codexveil/database';
import { CHARACTER_BOOK_KINDS, parseDnd5eCampaignRules, type BookContentSource } from '@codexveil/rpg-systems/dnd5e';

/** Conteúdo de personagem dos livros, por livro (o mesmo que o site usa). */
export async function loadBookSources(client: CodexveilClient, packs: readonly BookPackSummary[]): Promise<BookContentSource[]> {
  if (packs.length === 0) return [];
  const entries = await listBookEntries(
    client,
    packs.map((pack) => pack.id),
    CHARACTER_BOOK_KINDS,
  );
  return packs.map((pack) => ({
    book: { id: pack.bookKey, name: pack.name },
    entries: entries.filter((entry) => entry.packId === pack.id).map(({ kind, key, name, data }) => ({ kind, key, name, data })),
  }));
}

/**
 * Livros de uma ficha (para a subida de nível): os liberados na campanha do personagem ou, na ficha
 * pessoal, os livros prontos do dono. Igual ao site (`character-sheet.tsx`).
 */
export async function sheetBookSources(
  client: CodexveilClient,
  userId: string,
  character: { campaign: { id: string } | null; viewer: { isOwner: boolean } },
): Promise<BookContentSource[]> {
  if (character.campaign) {
    const campaign = await getCampaign(client, character.campaign.id, userId);
    if (!campaign) return [];
    return loadBookSources(client, await listCampaignBookPacks(client, campaign.ownerId, parseDnd5eCampaignRules(campaign.characterRules).sourcebooks));
  }
  if (!character.viewer.isOwner) return [];
  return loadBookSources(client, (await listMyBookPacks(client, userId)).filter((pack) => pack.isReady));
}
