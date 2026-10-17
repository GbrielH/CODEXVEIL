import { CONTENT_VISIBILITIES, ITEM_CATEGORIES, SHARED_VISIBILITIES } from '@codexveil/domain';
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

/** Item da biblioteca do mestre (criado por ele ou copiado do SRD). */
export const campaignItemSchema = z.object({
  name: requiredText('o nome do item', 1, 120),
  category: z.enum(ITEM_CATEGORIES).default('gear'),
  rarity: optionalText(60),
  requiresAttunement: z.boolean().default(false),
  weight: z.number().min(0, 'O peso não pode ser negativo.').max(100_000, 'Peso alto demais.').nullable().default(null),
  value: optionalText(60),
  description: optionalText(8000),
  visibility: z.enum(SHARED_VISIBILITIES).default('gm'),
});
export type CampaignItemInput = z.input<typeof campaignItemSchema>;
export type CampaignItemData = z.output<typeof campaignItemSchema>;
