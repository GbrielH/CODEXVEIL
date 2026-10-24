/**
 * Livros importados pelo usuário (`book_packs`) e o conteúdo deles (`book_entries`).
 *
 * O dono importa o pacote do próprio exemplar; a validação do conteúdo fica no módulo do
 * sistema (`parseBookPack` em `@codexveil/rpg-systems`). Aqui só há leitura e gravação. O RLS
 * deixa a mesa ler os livros que o dono liberou nas campanhas dele.
 */
import { fixBookOrdinals, fixBookOrdinalsDeep } from '@codexveil/domain';
import type { CodexveilClient } from '../client';
import { toAppError } from '../errors';
import type { Json, Tables } from '../types.gen';

export interface BookPackSummary {
  id: string;
  ownerId: string;
  /** Sistema de RPG do livro (`dnd5e`, `tormenta20`). */
  systemId: string;
  bookKey: string;
  name: string;
  category: string;
  edition: string;
  origin: string;
  /** Quantidade de entradas por tipo (`spell`, `monster`…). */
  entryCounts: Record<string, number>;
  isReady: boolean;
  updatedAt: string;
}

export interface BookEntryRow {
  id: string;
  packId: string;
  kind: string;
  key: string;
  name: string;
  data: Json;
  sortOrder: number;
}

const PACK_COLUMNS =
  'id, owner_id, system_id, book_key, name, category, edition, origin, entry_counts, is_ready, updated_at' as const;

type PackRow = Pick<
  Tables<'book_packs'>,
  | 'id'
  | 'owner_id'
  | 'system_id'
  | 'book_key'
  | 'name'
  | 'category'
  | 'edition'
  | 'origin'
  | 'entry_counts'
  | 'is_ready'
  | 'updated_at'
>;

function toPack(row: PackRow): BookPackSummary {
  const counts: Record<string, number> = {};
  if (
    row.entry_counts &&
    typeof row.entry_counts === 'object' &&
    !Array.isArray(row.entry_counts)
  ) {
    for (const [kind, value] of Object.entries(row.entry_counts))
      if (typeof value === 'number') counts[kind] = value;
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    systemId: row.system_id,
    bookKey: row.book_key,
    name: row.name,
    category: row.category,
    edition: row.edition,
    origin: row.origin,
    entryCounts: counts,
    isReady: row.is_ready,
    updatedAt: row.updated_at,
  };
}

/** Livros importados pelo usuário (prontos ou não), em ordem alfabética. */
export async function listMyBookPacks(
  client: CodexveilClient,
  ownerId: string,
): Promise<BookPackSummary[]> {
  const { data, error } = await client
    .from('book_packs')
    .select(PACK_COLUMNS)
    .eq('owner_id', ownerId)
    .order('name');
  if (error) throw toAppError(error);
  return data.map(toPack);
}

/**
 * Livros prontos do dono da campanha entre os liberados (`bookKeys`), na ordem de `bookKeys`.
 * Livros que o dono apagou (ou que o usuário não pode ver) simplesmente não voltam.
 */
export async function listCampaignBookPacks(
  client: CodexveilClient,
  ownerId: string,
  bookKeys: readonly string[],
): Promise<BookPackSummary[]> {
  if (bookKeys.length === 0) return [];
  const { data, error } = await client
    .from('book_packs')
    .select(PACK_COLUMNS)
    .eq('owner_id', ownerId)
    .eq('is_ready', true)
    .in('book_key', [...bookKeys]);
  if (error) throw toAppError(error);
  return data.map(toPack).sort((a, b) => bookKeys.indexOf(a.bookKey) - bookKeys.indexOf(b.bookKey));
}

export async function getBookPack(
  client: CodexveilClient,
  packId: string,
): Promise<BookPackSummary | null> {
  const { data, error } = await client
    .from('book_packs')
    .select(PACK_COLUMNS)
    .eq('id', packId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toPack(data) : null;
}

export async function deleteBookPack(client: CodexveilClient, packId: string): Promise<void> {
  const { error } = await client.from('book_packs').delete().eq('id', packId);
  if (error) throw toAppError(error);
}

const PAGE = 1000;

/**
 * Livros com conteúdo idêntico guardam as entradas uma vez só (`content_pack_id`): devolve, para
 * cada livro pedido, o livro onde estão as entradas.
 */
async function contentPackIds(
  client: CodexveilClient,
  packIds: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map(packIds.map((id) => [id, id]));
  if (packIds.length === 0) return map;
  const { data, error } = await client
    .from('book_packs')
    .select('id, content_pack_id')
    .in('id', [...packIds]);
  if (error) throw toAppError(error);
  for (const row of data ?? []) if (row.content_pack_id) map.set(row.id, row.content_pack_id);
  return map;
}

/** Repete as entradas do conteúdo para cada livro pedido que aponta para ele. */
function spreadToPacks<T extends { packId: string }>(
  rows: readonly T[],
  map: Map<string, string>,
): T[] {
  const result: T[] = [];
  for (const [packId, contentId] of map) {
    for (const row of rows) if (row.packId === contentId) result.push({ ...row, packId });
  }
  return result;
}

/** Lê todas as linhas de uma consulta paginada (o PostgREST devolve no máximo 1000 por vez). */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw toAppError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Entradas completas dos livros indicados, dos tipos pedidos (ex.: os usados na criação de personagens). */
export async function listBookEntries(
  client: CodexveilClient,
  packIds: readonly string[],
  kinds: readonly string[],
): Promise<BookEntryRow[]> {
  if (packIds.length === 0 || kinds.length === 0) return [];
  const map = await contentPackIds(client, packIds);
  const rows = await readAll((from, to) =>
    client
      .from('book_entries')
      .select('id, pack_id, kind, key, name, data, sort_order')
      .in('pack_id', [...new Set(map.values())])
      .in('kind', [...kinds])
      .order('pack_id')
      .order('kind')
      .order('sort_order')
      .order('key')
      .range(from, to),
  );
  return spreadToPacks(
    rows.map((row) => ({
      id: row.id,
      packId: row.pack_id,
      kind: row.kind,
      key: row.key,
      name: fixBookOrdinals(row.name),
      data: fixBookOrdinalsDeep(row.data),
      sortOrder: row.sort_order,
    })),
    map,
  );
}

export interface BookEntryListing {
  id: string;
  packId: string;
  kind: string;
  key: string;
  name: string;
  sortOrder: number;
  /** Campos curtos para listas: capítulo e página (texto), ND e tipo (monstros), raridade (itens), círculo (magias). */
  meta: Record<string, string>;
}

const META_FIELDS: Record<string, string> = {
  section: 'chapter:data->>chapter, page:data->>page',
  // D&D (cr, size, rarity, level) e Tormenta20 (challenge, itemKind, price, circle, spellType, group…).
  monster: 'cr:data->>cr, type:data->>type, size:data->>size, challenge:data->>challenge',
  magic_item: 'rarity:data->>rarity, type:data->>type, itemKind:data->>kind, price:data->>price',
  spell: 'level:data->>level, school:data->>school, circle:data->>circle, spellType:data->>type',
  subclass: 'classId:data->>classId',
  feat: 'category:data->>category, group:data->>group, prerequisite:data->>prerequisite',
  deity: 'energy:data->>energy',
  equipment: 'group:data->>group, category:data->>category, price:data->>price',
  species: 'size:data->>size',
};

/** Lista leve (sem o conteúdo) de um tipo de entrada, para índices e buscas. */
export async function listBookEntryIndex(
  client: CodexveilClient,
  packIds: readonly string[],
  kind: string,
): Promise<BookEntryListing[]> {
  if (packIds.length === 0) return [];
  const extra = META_FIELDS[kind];
  const map = await contentPackIds(client, packIds);
  const rows = await readAll((from, to) =>
    client
      .from('book_entries')
      .select(`id, pack_id, kind, key, name, sort_order${extra ? `, ${extra}` : ''}`)
      .in('pack_id', [...new Set(map.values())])
      .eq('kind', kind)
      .order('pack_id')
      .order('sort_order')
      .order('name')
      .range(from, to),
  );
  const listing = (rows as unknown as Record<string, unknown>[]).map((row) => {
    const meta: Record<string, string> = {};
    for (const [field, value] of Object.entries(row)) {
      if (['id', 'pack_id', 'kind', 'key', 'name', 'sort_order'].includes(field)) continue;
      if (typeof value === 'string' || typeof value === 'number') meta[field] = String(value);
    }
    return {
      id: String(row.id),
      packId: String(row.pack_id),
      kind: String(row.kind),
      key: String(row.key),
      name: String(row.name),
      sortOrder: Number(row.sort_order),
      meta,
    };
  });
  return spreadToPacks(listing, map);
}

export async function getBookEntry(
  client: CodexveilClient,
  packId: string,
  kind: string,
  key: string,
): Promise<BookEntryRow | null> {
  const contentId = (await contentPackIds(client, [packId])).get(packId) ?? packId;
  const { data, error } = await client
    .from('book_entries')
    .select('id, pack_id, kind, key, name, data, sort_order')
    .eq('pack_id', contentId)
    .eq('kind', kind)
    .eq('key', key)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data
    ? {
        id: data.id,
        packId,
        kind: data.kind,
        key: data.key,
        name: fixBookOrdinals(data.name),
        data: fixBookOrdinalsDeep(data.data),
        sortOrder: data.sort_order,
      }
    : null;
}

// ----------------------------------------------------------------------------- Importação

export interface BookImportInput {
  /** Sistema do pacote; padrão `dnd5e` (pacotes antigos). */
  systemId?: string;
  book: { id: string; name: string; category: string; edition: string; origin: string };
  entries: readonly { kind: string; key: string; name: string; data: unknown }[];
}

/** Tamanho máximo aproximado de cada lote enviado (o corpo das requisições tem limite). */
const BATCH_BYTES = 900_000;
const BATCH_ROWS = 400;

/**
 * Importa (ou substitui) um livro: apaga a versão anterior do mesmo livro, cria o livro, envia o
 * conteúdo em lotes e só então o marca como pronto. Se algo falhar no meio, o livro fica
 * incompleto (invisível para a mesa) e pode ser importado de novo.
 */
export async function importBookPack(
  client: CodexveilClient,
  ownerId: string,
  input: BookImportInput,
  onProgress?: (done: number, total: number) => void,
): Promise<BookPackSummary> {
  const { error: removeError } = await client
    .from('book_packs')
    .delete()
    .eq('owner_id', ownerId)
    .eq('book_key', input.book.id);
  if (removeError) throw toAppError(removeError);

  const { data: pack, error } = await client
    .from('book_packs')
    .insert({
      system_id: input.systemId ?? 'dnd5e',
      book_key: input.book.id,
      name: input.book.name,
      category: input.book.category,
      edition: input.book.edition,
      origin: input.book.origin,
    })
    .select(PACK_COLUMNS)
    .single();
  if (error) throw toAppError(error);

  const total = input.entries.length;
  const counts: Record<string, number> = {};
  let batch: {
    pack_id: string;
    kind: string;
    key: string;
    name: string;
    data: Json;
    sort_order: number;
  }[] = [];
  let batchBytes = 0;
  let done = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const { error: insertError } = await client.from('book_entries').insert(batch);
    if (insertError) throw toAppError(insertError);
    done += batch.length;
    batch = [];
    batchBytes = 0;
    onProgress?.(done, total);
  };
  onProgress?.(0, total);
  for (const [index, entry] of input.entries.entries()) {
    const data = (entry.data ?? {}) as Json;
    const size = JSON.stringify(data).length + entry.name.length + 100;
    if (batch.length > 0 && (batchBytes + size > BATCH_BYTES || batch.length >= BATCH_ROWS))
      await flush();
    batch.push({
      pack_id: pack.id,
      kind: entry.kind,
      key: entry.key,
      name: entry.name,
      data,
      sort_order: index,
    });
    batchBytes += size;
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  }
  await flush();

  // O banco confere se já existe um livro com o mesmo conteúdo: se sim, apaga esta cópia e liga
  // o livro ao conteúdo existente (cada livro ocupa espaço uma vez só).
  const { error: finishError } = await client.rpc('finish_book_import', {
    p_pack_id: pack.id,
    p_entry_counts: counts as Json,
  });
  if (finishError) throw toAppError(finishError);
  const ready = await getBookPack(client, pack.id);
  if (!ready) throw toAppError(new Error('Livro não encontrado depois da importação.'));
  return ready;
}
