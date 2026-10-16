/**
 * Modelo de blocos do editor de roteiros.
 *
 * Cada bloco é um registro próprio (tabela `session_blocks`) com tipo, posição,
 * visibilidade e dados estruturados em JSON validado — nunca HTML arbitrário.
 * O formato dos dados é versionado por `BLOCK_SCHEMA_VERSION` para permitir migrações.
 *
 * Blocos de referência guardam apenas o identificador do registro referenciado. O nome
 * exibido é buscado sob as regras de acesso do leitor, para que um bloco público não
 * revele o título de um NPC ou nota que o jogador não pode ver.
 */
import type { SharedVisibility } from '../visibility';

export const BLOCK_SCHEMA_VERSION = 1;

export const SESSION_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'subheading',
  'callout',
  'gm_note',
  'image',
  'divider',
  'list',
  'checklist',
  'npc_ref',
  'monster_ref',
  'character_ref',
  'content_ref',
] as const;
export type SessionBlockType = (typeof SESSION_BLOCK_TYPES)[number];

export const CALLOUT_TONES = ['lore', 'info', 'warning', 'danger'] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

export const CONTENT_REF_KINDS = ['session', 'note'] as const;
export type ContentRefKind = (typeof CONTENT_REF_KINDS)[number];

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

/** Dados específicos de cada tipo de bloco (armazenados na coluna `data`). */
export interface SessionBlockDataMap {
  paragraph: { text: string };
  heading: { text: string };
  subheading: { text: string };
  callout: { tone: CalloutTone; title: string | null; text: string };
  gm_note: { text: string };
  image: { path: string; alt: string; caption: string | null };
  divider: Record<string, never>;
  list: { style: 'bulleted' | 'numbered'; items: string[] };
  checklist: { items: ChecklistItem[] };
  npc_ref: { creatureId: string; note: string | null };
  monster_ref: { creatureId: string; note: string | null };
  character_ref: { characterId: string; note: string | null };
  content_ref: { kind: ContentRefKind; targetId: string; note: string | null };
}

export type SessionBlockContent = {
  [K in SessionBlockType]: { type: K; data: SessionBlockDataMap[K] };
}[SessionBlockType];

export interface SessionBlock<T extends SessionBlockContent = SessionBlockContent> {
  id: string;
  sessionId: string;
  position: number;
  visibility: SharedVisibility;
  content: T;
}

export const blockTypeLabels: Record<SessionBlockType, string> = {
  paragraph: 'Texto',
  heading: 'Título',
  subheading: 'Subtítulo',
  callout: 'Caixa de destaque',
  gm_note: 'Nota privada do mestre',
  image: 'Imagem',
  divider: 'Separador',
  list: 'Lista',
  checklist: 'Checklist',
  npc_ref: 'Referência a NPC',
  monster_ref: 'Referência a monstro',
  character_ref: 'Referência a personagem',
  content_ref: 'Referência a conteúdo',
};

/** Notas privadas do mestre nunca podem ser públicas (garantido também por CHECK no banco). */
export function isAlwaysPrivate(type: SessionBlockType): boolean {
  return type === 'gm_note';
}

export function defaultVisibilityFor(type: SessionBlockType): SharedVisibility {
  return isAlwaysPrivate(type) ? 'gm' : 'members';
}

/** Conteúdo inicial de um bloco recém-criado. */
export function createBlockContent(type: SessionBlockType): SessionBlockContent {
  switch (type) {
    case 'paragraph':
    case 'heading':
    case 'subheading':
    case 'gm_note':
      return { type, data: { text: '' } };
    case 'callout':
      return { type, data: { tone: 'lore', title: null, text: '' } };
    case 'image':
      return { type, data: { path: '', alt: '', caption: null } };
    case 'divider':
      return { type, data: {} };
    case 'list':
      return { type, data: { style: 'bulleted', items: [''] } };
    case 'checklist':
      return { type, data: { items: [] } };
    case 'npc_ref':
    case 'monster_ref':
      return { type, data: { creatureId: '', note: null } };
    case 'character_ref':
      return { type, data: { characterId: '', note: null } };
    case 'content_ref':
      return { type, data: { kind: 'session', targetId: '', note: null } };
  }
}

/** Distância padrão entre posições ao inserir no fim da lista. */
export const POSITION_STEP = 1024;
/** Abaixo deste intervalo, as posições devem ser renumeradas. */
export const MIN_POSITION_GAP = 1e-6;

/**
 * Posição para inserir um bloco entre dois vizinhos (posições fracionárias).
 * `null` indica início ou fim da lista.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return POSITION_STEP;
  if (before === null) return (after as number) - POSITION_STEP;
  if (after === null) return before + POSITION_STEP;
  if (after <= before) {
    throw new RangeError('A posição seguinte precisa ser maior que a anterior.');
  }
  return before + (after - before) / 2;
}

/** Indica se alguma distância entre posições consecutivas ficou pequena demais. */
export function needsRenumbering(sortedPositions: readonly number[]): boolean {
  for (let i = 1; i < sortedPositions.length; i++) {
    const current = sortedPositions[i];
    const previous = sortedPositions[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current - previous < MIN_POSITION_GAP) return true;
  }
  return false;
}

/** Move um item da posição `from` para `to` numa lista ordenada (sem mutar a original). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    throw new RangeError('Índice fora da lista.');
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
