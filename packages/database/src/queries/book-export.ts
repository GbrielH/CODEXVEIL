/**
 * Exporta um livro importado de volta para o formato de pacote (`.book.json`), para o dono
 * guardar uma cópia ou importar em outra conta dele. Só o dono lê todas as entradas (RLS).
 */
import type { CodexveilClient } from '../client';
import { downloadBookAsset } from './book-assets';
import { listBookEntries, type BookPackSummary } from './books';

const FORMATS: Record<string, string> = {
  dnd5e: 'codexveil.dnd5e.book',
  tormenta20: 'codexveil.tormenta20.book',
  assimilacao: 'codexveil.assimilacao.book',
  'triangle-agency': 'codexveil.triangle-agency.book',
  ordem2: 'codexveil.ordem2.book',
};

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return btoa(binary);
}

export async function exportBookPack(
  client: CodexveilClient,
  pack: BookPackSummary,
  onProgress?: (step: string) => void,
): Promise<Record<string, unknown>> {
  const systemId = pack.systemId ?? 'dnd5e';
  onProgress?.('Lendo o conteúdo…');
  const rows = await listBookEntries(client, [pack.id], Object.keys(pack.entryCounts));
  const entries = rows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ kind: row.kind, key: row.key, name: row.name, data: row.data }));
  const result: Record<string, unknown> = {
    format: FORMATS[systemId] ?? FORMATS.dnd5e,
    version: 1,
    book: {
      id: pack.bookKey,
      name: pack.name,
      category: pack.category,
      edition: pack.edition,
      origin: pack.origin,
    },
    entries,
  };
  // Imagens do livro (bucket `book-assets`), citadas pelas entradas em `data.image`.
  const keys = [
    ...new Set(
      entries
        .map((entry) => (entry.data as { image?: unknown } | null)?.image)
        .filter(
          (key): key is string =>
            typeof key === 'string' && /^[0-9a-f]{32,64}-(jpg|png|webp)$/.test(key),
        ),
    ),
  ];
  if (keys.length) {
    const assets = [];
    for (const [index, key] of keys.entries()) {
      onProgress?.(`Baixando imagens (${index + 1}/${keys.length})…`);
      const ext = key.split('-').pop();
      assets.push({
        key,
        mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
        data: await blobToBase64(await downloadBookAsset(client, systemId, pack.bookKey, key)),
      });
    }
    result.assets = assets;
  }
  return result;
}
