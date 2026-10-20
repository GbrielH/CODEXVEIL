import { getCampaign, listBookEntries, listCampaignBookPacks, listMyBookPacks, type BookPackSummary, type CodexveilClient } from '@codexveil/database';
import { CHARACTER_BOOK_KINDS, parseDnd5eCampaignRules, type BookContentSource } from '@codexveil/rpg-systems/dnd5e';
import { T20_CHARACTER_BOOK_KINDS, type T20ContentSource } from '@codexveil/rpg-systems/tormenta20';

/** Livros de um sistema (um usuário pode ter livros de D&D e de Tormenta20). */
export function packsOfSystem(packs: readonly BookPackSummary[], systemId: string): BookPackSummary[] {
  return packs.filter((pack) => (pack.systemId ?? 'dnd5e') === systemId);
}

async function sourcesFor(client: CodexveilClient, packs: readonly BookPackSummary[], kinds: readonly string[]) {
  if (packs.length === 0) return [];
  const entries = await listBookEntries(
    client,
    packs.map((pack) => pack.id),
    kinds,
  );
  return packs.map((pack) => ({
    book: { id: pack.bookKey, name: pack.name },
    entries: entries.filter((entry) => entry.packId === pack.id).map(({ kind, key, name, data }) => ({ kind, key, name, data })),
  }));
}

/** Conteúdo de personagem dos livros de D&D, por livro (o mesmo que o site usa). */
export async function loadBookSources(client: CodexveilClient, packs: readonly BookPackSummary[]): Promise<BookContentSource[]> {
  return sourcesFor(client, packsOfSystem(packs, 'dnd5e'), CHARACTER_BOOK_KINDS);
}

/** Conteúdo de personagem dos livros de Tormenta20. */
export async function loadT20Sources(client: CodexveilClient, packs: readonly BookPackSummary[]): Promise<T20ContentSource[]> {
  return sourcesFor(client, packsOfSystem(packs, 'tormenta20'), T20_CHARACTER_BOOK_KINDS);
}

/** Livros liberados na campanha (os do dono) ou, na ficha pessoal, os livros prontos do usuário. */
type SheetCharacter = { campaign: { id: string } | null; viewer: { isOwner: boolean }; sheet?: unknown };

/** Livros escolhidos na criação, gravados na ficha (`identity.sourcebooks`). */
function sheetSourcebooks(sheet: unknown): string[] {
  const identity = (sheet as { identity?: { sourcebooks?: unknown } } | null)?.identity;
  return Array.isArray(identity?.sourcebooks) ? identity.sourcebooks.filter((id): id is string => typeof id === 'string') : [];
}

async function packsFor(client: CodexveilClient, userId: string, character: SheetCharacter) {
  if (character.campaign) {
    const campaign = await getCampaign(client, character.campaign.id, userId);
    if (!campaign) return [];
    return listCampaignBookPacks(client, campaign.ownerId, parseDnd5eCampaignRules(campaign.characterRules).sourcebooks);
  }
  if (!character.viewer.isOwner) return [];
  // Ficha pessoal: só os livros escolhidos na criação, entre os importados pelo dono.
  const chosen = sheetSourcebooks(character.sheet);
  return (await listMyBookPacks(client, userId)).filter((pack) => pack.isReady && chosen.includes(pack.bookKey));
}

/** Livros de uma ficha de D&D (para a subida de nível). Igual ao site (`character-sheet.tsx`). */
export async function sheetBookSources(
  client: CodexveilClient,
  userId: string,
  character: SheetCharacter,
): Promise<BookContentSource[]> {
  return loadBookSources(client, await packsFor(client, userId, character));
}

/** Livros de uma ficha de Tormenta20 (para a subida de nível). */
export async function sheetT20Sources(
  client: CodexveilClient,
  userId: string,
  character: SheetCharacter,
): Promise<T20ContentSource[]> {
  return loadT20Sources(client, await packsFor(client, userId, character));
}
