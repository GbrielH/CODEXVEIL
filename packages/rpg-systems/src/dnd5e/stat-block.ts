/**
 * Bloco de estatísticas de criaturas (NPCs e monstros) de D&D 5e, guardado em
 * `creature_gm_data.stats` — visível apenas aos mestres.
 */
import { z } from 'zod';
import {
  ABILITIES,
  ABILITY_SCORE_MAX,
  ABILITY_SCORE_MIN,
  DEFAULT_ABILITY_SCORE,
} from './abilities';
import { isChallengeRating } from './progression';

export const DND5E_STAT_BLOCK_VERSION = 1;

export const CREATURE_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type CreatureSize = (typeof CREATURE_SIZES)[number];

export const creatureSizeLabels: Record<CreatureSize, string> = {
  tiny: 'Miúdo',
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
  huge: 'Enorme',
  gargantuan: 'Imenso',
};

const text = (max: number) => z.string().trim().max(max).default('');

const namedEntry = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(4000).default(''),
});
export type StatBlockEntry = z.output<typeof namedEntry>;

const entries = z.array(namedEntry).max(40).default([]);

const abilityScore = z
  .number()
  .int()
  .min(ABILITY_SCORE_MIN)
  .max(ABILITY_SCORE_MAX)
  .default(DEFAULT_ABILITY_SCORE);

export const dnd5eStatBlockSchema = z.object({
  schemaVersion: z.literal(DND5E_STAT_BLOCK_VERSION).default(DND5E_STAT_BLOCK_VERSION),
  size: z.enum(CREATURE_SIZES).default('medium'),
  creatureType: text(60),
  alignment: text(40),
  armorClass: z.number().int().min(0).max(50).default(10),
  armorNote: text(80),
  hitPoints: z.number().int().min(1).max(9999).default(10),
  hitPointFormula: text(40),
  speed: text(120),
  abilities: z
    .object(
      Object.fromEntries(ABILITIES.map((ability) => [ability, abilityScore])) as Record<
        (typeof ABILITIES)[number],
        typeof abilityScore
      >,
    )
    .prefault({}),
  savingThrows: text(200),
  skills: text(300),
  damageResistances: text(300),
  damageImmunities: text(300),
  conditionImmunities: text(300),
  senses: text(200),
  languages: text(200),
  challengeRating: z
    .string()
    .refine(isChallengeRating, { message: 'Nível de desafio inválido.' })
    .default('1'),
  traits: entries,
  actions: entries,
  bonusActions: entries,
  reactions: entries,
  legendaryActions: entries,
});

export type Dnd5eStatBlock = z.output<typeof dnd5eStatBlockSchema>;

export function createDefaultDnd5eStatBlock(): Dnd5eStatBlock {
  return dnd5eStatBlockSchema.parse({});
}

export function parseDnd5eStatBlock(data: unknown): Dnd5eStatBlock {
  return dnd5eStatBlockSchema.parse(data ?? {});
}
