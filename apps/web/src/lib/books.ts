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
  type Dnd5eBookContent,
} from '@codexveil/rpg-systems/dnd5e';
import { T20_BOOK_ENTRY_KINDS, T20_CHARACTER_BOOK_KINDS, t20BookEntryKindLabels } from '@codexveil/rpg-systems/tormenta20';
import { bookEntryKindLabels } from '@codexveil/rpg-systems/dnd5e';
import { uuidSchema } from '@codexveil/validation';

/** Livros liberados na campanha (os do dono que ele marcou nas regras de criação). */
export function campaignBookPacks(client: CodexveilClient, campaign: { ownerId: string; characterRules: unknown }): Promise<BookPackSummary[]> {
  return listCampaignBookPacks(client, campaign.ownerId, campaignSourcebooks(campaign.characterRules));
}

/** Livros liberados nas regras da campanha, de qualquer sistema (o campo `sourcebooks`). */
export function campaignSourcebooks(characterRules: unknown): string[] {
  const raw = characterRules && typeof characterRules === 'object' ? (characterRules as { sourcebooks?: unknown }).sourcebooks : undefined;
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : parseDnd5eCampaignRules(characterRules).sourcebooks;
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
export const BOOK_KIND_SLUGS: Record<string, string> = {
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
  deity: 'deuses',
  equipment: 'equipamento',
};

export function bookKindFromSlug(slug: string): string | undefined {
  return Object.keys(BOOK_KIND_SLUGS).find((kind) => BOOK_KIND_SLUGS[kind] === slug);
}

/** Nome de um tipo de entrada no sistema do livro (Tormenta20: "Raças", "Origens", "Poderes"…). */
export function bookKindLabel(systemId: string, kind: string, form: 'one' | 'many' = 'many'): string {
  const labels: Record<string, { one: string; many: string }> = systemId === 'tormenta20' ? t20BookEntryKindLabels : bookEntryKindLabels;
  return labels[kind]?.[form] ?? kind;
}

/** Livro aberto no leitor e o que o usuário pode ler dele. */
export interface BookReaderContext {
  pack: BookPackSummary;
  /** Tipos que o usuário lê (o dono e os mestres leem tudo). */
  kinds: string[];
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
    return pack.ownerId === viewer.userId ? { pack, kinds: pack.systemId === 'tormenta20' ? [...T20_BOOK_ENTRY_KINDS] : [...BOOK_ENTRY_KINDS], canCopy: false } : null;
  }
  const released = pack.isReady && pack.ownerId === campaign.ownerId && campaignSourcebooks(campaign.characterRules).includes(pack.bookKey);
  if (!released) return null;
  const isGm = campaign.role === 'gm';
  const readAll = isGm || pack.ownerId === viewer.userId;
  // Tormenta20: jogadores leem o conteúdo de personagem (raças, classes, origens, poderes, magias,
  // deuses e equipamento) e o texto dos livros de jogador; ameaças e itens mágicos ficam com o mestre.
  const t20Kinds = readAll
    ? [...T20_BOOK_ENTRY_KINDS]
    : [...T20_CHARACTER_BOOK_KINDS, ...(['core', 'player', 'setting'].includes(pack.category) ? ['section'] : [])];
  return {
    pack,
    kinds: pack.systemId === 'tormenta20' ? t20Kinds : visibleBookKinds(pack.category, readAll),
    campaignId: campaign.id,
    canCopy: isGm && campaign.status === 'active',
  };
}

/** Livros de um sistema entre os informados (um usuário pode ter livros de D&D e de Tormenta20). */
export function packsOfSystem(packs: readonly BookPackSummary[], systemId: string): BookPackSummary[] {
  return packs.filter((pack) => (pack.systemId ?? 'dnd5e') === systemId);
}

/** Fontes de conteúdo do Tormenta20 (raças, classes, origens, deuses, poderes, magias e equipamento). */
export async function loadT20Sources(client: CodexveilClient, packs: readonly BookPackSummary[]) {
  const sources = await loadBookSources(client, packsOfSystem(packs, 'tormenta20'), T20_CHARACTER_BOOK_KINDS);
  return sources.map(({ book, entries }) => ({ book, entries }));
}
