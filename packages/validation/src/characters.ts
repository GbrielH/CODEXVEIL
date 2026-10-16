import { ITEM_CATEGORIES, RESOURCE_RECOVERIES } from '@codexveil/domain';
import { z } from 'zod';
import { systemIdSchema } from './campaigns';
import { optionalText, requiredText, uuidSchema } from './common';

export const characterCreateSchema = z.object({
  name: requiredText('o nome do personagem', 1, 80),
  systemId: systemIdSchema,
  campaignId: uuidSchema.nullable().default(null),
});
export type CharacterCreateInput = z.input<typeof characterCreateSchema>;
export type CharacterCreate = z.output<typeof characterCreateSchema>;

export const characterNameSchema = requiredText('o nome do personagem', 1, 80);

export const inventoryItemSchema = z.object({
  name: requiredText('o nome do item', 1, 120),
  category: z.enum(ITEM_CATEGORIES).default('gear'),
  quantity: z
    .number({ error: 'Informe a quantidade.' })
    .int('Use um número inteiro.')
    .min(0, 'A quantidade não pode ser negativa.')
    .max(99_999, 'Quantidade alta demais.')
    .default(1),
  weight: z
    .number()
    .min(0, 'O peso não pode ser negativo.')
    .max(100_000, 'Peso alto demais.')
    .nullable()
    .default(null),
  description: optionalText(4000),
  notes: optionalText(2000),
  isEquipped: z.boolean().default(false),
});
export type InventoryItemInput = z.input<typeof inventoryItemSchema>;
export type InventoryItemData = z.output<typeof inventoryItemSchema>;

export const ABILITY_ENTRY_KINDS = [
  'class_feature',
  'species_trait',
  'feat',
  'background_feature',
  'spell',
  'attack',
  'other',
] as const;
export type AbilityEntryKind = (typeof ABILITY_ENTRY_KINDS)[number];

export const abilityEntryKindLabels: Record<AbilityEntryKind, string> = {
  class_feature: 'Habilidade de classe',
  species_trait: 'Característica de espécie',
  feat: 'Talento',
  background_feature: 'Antecedente',
  spell: 'Magia',
  attack: 'Ataque',
  other: 'Outro',
};

/** Campos genéricos de habilidades e magias; `data` é validado pelo módulo do sistema. */
export const abilityEntrySchema = z.object({
  kind: z.enum(ABILITY_ENTRY_KINDS),
  name: requiredText('o nome', 1, 120),
  source: optionalText(120),
  description: optionalText(8000),
  resourceId: uuidSchema.nullable().default(null),
});
export type AbilityEntryInput = z.input<typeof abilityEntrySchema>;

export const resourceSchema = z
  .object({
    label: requiredText('o nome do recurso', 1, 60),
    current: z.number().int().min(0).max(99_999),
    max: z.number().int().min(0).max(99_999).nullable(),
    recovery: z.enum(RESOURCE_RECOVERIES).default('manual'),
  })
  .refine((data) => data.max === null || data.current <= data.max, {
    path: ['current'],
    message: 'O valor atual não pode passar do máximo.',
  });
export type ResourceInput = z.input<typeof resourceSchema>;

export const conditionSchema = z.object({
  key: requiredText('a condição', 1, 40),
  level: z.number().int().min(1).max(10).nullable().default(null),
});
export type ConditionInput = z.input<typeof conditionSchema>;
