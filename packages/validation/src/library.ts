import { CONTENT_VISIBILITIES, SHARED_VISIBILITIES } from '@codexveil/domain';
import { z } from 'zod';
import { optionalText, requiredText } from './common';

export const CREATURE_KINDS = ['npc', 'monster'] as const;
export type CreatureKind = (typeof CREATURE_KINDS)[number];

export const creatureKindLabels: Record<CreatureKind, string> = {
  npc: 'NPC',
  monster: 'Monstro',
};

/** Perfil público do registro (o que jogadores veem quando o mestre o revela). */
export const creatureSchema = z.object({
  kind: z.enum(CREATURE_KINDS),
  name: requiredText('o nome', 1, 80),
  subtitle: optionalText(80),
  description: optionalText(4000),
  visibility: z.enum(SHARED_VISIBILITIES).default('gm'),
});
export type CreatureInput = z.input<typeof creatureSchema>;
export type CreatureData = z.output<typeof creatureSchema>;

/** Dados exclusivos do mestre; `stats` é validado pelo módulo do sistema da campanha. */
export const creatureGmDataSchema = z.object({
  notes: optionalText(8000),
  secrets: optionalText(8000),
});
export type CreatureGmDataInput = z.input<typeof creatureGmDataSchema>;

export const noteSchema = z.object({
  title: requiredText('o título', 1, 120),
  body: optionalText(20000),
  visibility: z.enum(CONTENT_VISIBILITIES).default('members'),
  isPinned: z.boolean().default(false),
});
export type NoteInput = z.input<typeof noteSchema>;
export type NoteData = z.output<typeof noteSchema>;
