import type { BlockReferences, StoredSessionBlock } from '@codexveil/database';
import { blockTypeLabels } from '@codexveil/domain';

/** Texto curto de um bloco do roteiro, para a lista de liberação da mesa do mestre. */
export function blockPreview(block: StoredSessionBlock, references: BlockReferences): string {
  const content = block.content;
  if (!content) return '';
  switch (content.type) {
    case 'paragraph':
    case 'heading':
    case 'subheading':
    case 'gm_note':
      return content.data.text;
    case 'callout':
      return [content.data.title, content.data.text].filter(Boolean).join(': ');
    case 'image':
      return content.data.caption || content.data.alt;
    case 'list':
      return content.data.items.join(' · ');
    case 'checklist':
      return content.data.items.map((item) => item.text).join(' · ');
    case 'npc_ref':
    case 'monster_ref':
      return [references.creatures[content.data.creatureId]?.name, content.data.note].filter(Boolean).join(': ');
    case 'character_ref':
      return [references.characters[content.data.characterId]?.name, content.data.note].filter(Boolean).join(': ');
    case 'content_ref':
      return [content.data.kind === 'session' ? references.sessions[content.data.targetId]?.title : references.notes[content.data.targetId]?.title, content.data.note].filter(Boolean).join(': ');
    default:
      return '';
  }
}

export function blockLabel(block: StoredSessionBlock): string {
  return blockTypeLabels[block.type];
}
