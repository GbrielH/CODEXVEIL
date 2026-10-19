import {
  getBookPack,
  listBookEntries,
  listCampaignBookPacks,
  listMyBookPacks,
  type BookPackSummary,
  type CodexveilClient,
} from '@codexveil/database';
import {
  BOOK_ENTRY_KINDS,
  CHARACTER_BOOK_KINDS,
  buildDnd5eBookContent,
  parseDnd5eCampaignRules,
  visibleBookKinds,
  type BookContentSource,
  type BookEntryKind,
  type Dnd5eBookContent,
} from '@codexveil/rpg-systems/dnd5e';
import { uuidSchema } from '@codexveil/validation';

/** Livros liberados na campanha (os do dono que ele marcou nas regras de criação). */
export function campaignBookPacks(client: CodexveilClient, campaign: { ownerId: string; characterRules: unknown }): Promise<BookPackSummary[]> {
  return listCampaignBookPacks(client, campaign.ownerId, parseDnd5eCampaignRules(campaign.characterRules).sourcebooks);
}

/** Livros prontos do próprio usuário (usados nas fichas pessoais). */
export async function ownReadyBookPacks(client: CodexveilClient, userId: string): Promise<BookPackSummary[]> {
  return (await listMyBookPacks(client, userId)).filter((pack) => pack.isReady);
}

/** Conteúdo dos livros para as regras, por livro (na ordem recebida). */
export async function loadBookSources(
  client: CodexveilClient,
  packs: readonly BookPackSummary[],
  kinds: readonly string[] = CHARACTER_BOOK_KINDS,
): Promise<(BookContentSource & { packId: string })[]> {
  const entries = await listBookEntries(
    client,
    packs.map((pack) => pack.id),
    kinds,
  );
  return packs.map((pack) => ({
    packId: pack.id,
    book: { id: pack.bookKey, name: pack.name },
    entries: entries.filter((entry) => entry.packId === pack.id).map(({ kind, key, name, data }) => ({ kind, key, name, data })),
  }));
}

/** Conteúdo pronto para `withDnd5eBookContent` nas ações do servidor. */
export async function loadDnd5eBookContent(client: CodexveilClient, packs: readonly BookPackSummary[]): Promise<Dnd5eBookContent> {
  return buildDnd5eBookContent(await loadBookSources(client, packs));
}

/** Trechos de endereço dos tipos de entrada no leitor (`/livros/<id>/<trecho>/<chave>`). */
export const BOOK_KIND_SLUGS: Record<BookEntryKind, string> = {
  section: 'texto',
  class: 'classes',
  subclass: 'subclasses',
  species: 'especies',
  background: 'antecedentes',
  feat: 'talentos',
  spell: 'magias',
  spell_list: 'listas',
  monster: 'monstros',
  magic_item: 'itens',
};

export function bookKindFromSlug(slug: string): BookEntryKind | undefined {
  return BOOK_ENTRY_KINDS.find((kind) => BOOK_KIND_SLUGS[kind] === slug);
}

/** Livro aberto no leitor e o que o usuário pode ler dele. */
export interface BookReaderContext {
  pack: BookPackSummary;
  /** Tipos que o usuário lê (o dono e os mestres leem tudo). */
  kinds: BookEntryKind[];
  /** Campanha em que o livro foi aberto (leitor da campanha) ou `undefined` (Meus livros). */
  campaignId?: string;
  /** Mestre da campanha: pode copiar monstros e itens para a biblioteca. */
  canCopy: boolean;
}

/**
 * Livro para o leitor. Em "Meus livros", só o dono abre; na campanha, só livros liberados pelo
 * dono da campanha. `null` quando o livro não existe ou o usuário não pode abri-lo.
 */
export async function loadBookReader(
  client: CodexveilClient,
  packId: string,
  viewer: { userId: string; campaign?: { id: string; ownerId: string; characterRules: unknown; role: string; status: string } },
): Promise<BookReaderContext | null> {
  if (!uuidSchema.safeParse(packId).success) return null;
  const pack = await getBookPack(client, packId);
  if (!pack) return null;
  const { campaign } = viewer;
  if (!campaign) {
    return pack.ownerId === viewer.userId ? { pack, kinds: [...BOOK_ENTRY_KINDS], canCopy: false } : null;
  }
  const released = pack.isReady && pack.ownerId === campaign.ownerId && parseDnd5eCampaignRules(campaign.characterRules).sourcebooks.includes(pack.bookKey);
  if (!released) return null;
  const isGm = campaign.role === 'gm';
  return {
    pack,
    kinds: visibleBookKinds(pack.category, isGm || pack.ownerId === viewer.userId),
    campaignId: campaign.id,
    canCopy: isGm && campaign.status === 'active',
  };
}
