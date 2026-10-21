import { resolveBlockReferences, signedMediaUrls, type CodexveilClient, type StoredSessionBlock } from '@codexveil/database';
import type { RevealBlock } from '@/components/gm/reveal-panel';
import { blockLabel, blockPreview } from '@/lib/block-preview';

/** Trechos liberáveis da sessão (todos os blocos menos notas privadas e separadores). */
export async function loadRevealBlocks(client: CodexveilClient, blocks: readonly StoredSessionBlock[]): Promise<RevealBlock[]> {
  // Só o que o mestre marcou "Para liberar na mesa" (o resto é roteiro só dele).
  const revealable = blocks.filter((block) => block.revealable && block.type !== 'gm_note' && block.type !== 'divider');
  const [references, imageUrls] = await Promise.all([
    resolveBlockReferences(client, revealable),
    signedMediaUrls(
      client,
      revealable.map((block) => (block.content?.type === 'image' ? block.content.data.path : null)),
    ),
  ]);
  return revealable.map((block) => ({
    id: block.id,
    label: blockLabel(block),
    preview: blockPreview(block, references),
    imageUrl: block.content?.type === 'image' ? (imageUrls[block.content.data.path] ?? null) : null,
    visibility: block.visibility,
  }));
}
