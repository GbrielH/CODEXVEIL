/**
 * Dados específicos de D&D 5e para entradas da tabela `character_abilities`
 * (coluna `data`): magias e ataques. Habilidades de classe, talentos e traços usam
 * apenas os campos genéricos (nome, origem, descrição) e um recurso opcional de usos.
 */
import { z } from 'zod';
import { ABILITIES, abilityModifier, type Ability } from './abilities';
import type { Dnd5eDerived } from './derived';

export const SPELL_SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
] as const;
export type SpellSchool = (typeof SPELL_SCHOOLS)[number];

export const spellSchoolLabels: Record<SpellSchool, string> = {
  abjuration: 'Abjuração',
  conjuration: 'Conjuração',
  divination: 'Adivinhação',
  enchantment: 'Encantamento',
  evocation: 'Evocação',
  illusion: 'Ilusão',
  necromancy: 'Necromancia',
  transmutation: 'Transmutação',
};

const text = (max: number) => z.string().trim().max(max).default('');

export const dnd5eSpellDataSchema = z.object({
  /** 0 = truque. */
  circle: z.number().int().min(0).max(9).default(0),
  school: z.enum(SPELL_SCHOOLS).nullable().default(null),
  castingTime: text(60),
  range: text(60),
  components: text(120),
  duration: text(60),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  prepared: z.boolean().default(false),
});
export type Dnd5eSpellData = z.output<typeof dnd5eSpellDataSchema>;

export const dnd5eAttackDataSchema = z.object({
  /** Atributo usado no ataque; `null` para bônus fixo (ex.: ataques de criaturas invocadas). */
  ability: z.enum(ABILITIES).nullable().default('str'),
  proficient: z.boolean().default(true),
  bonus: z.number().int().min(-30).max(30).default(0),
  damage: text(60),
  damageType: text(40),
  range: text(60),
});
export type Dnd5eAttackData = z.output<typeof dnd5eAttackDataSchema>;

/** Bônus total da jogada de ataque. */
export function attackRollBonus(attack: Dnd5eAttackData, derived: Dnd5eDerived): number {
  const abilityPart = attack.ability ? derived.abilityModifiers[attack.ability] : 0;
  return abilityPart + (attack.proficient ? derived.proficiencyBonus : 0) + attack.bonus;
}

/** Modificador de atributo usado no dano (para exibição ao lado da fórmula). */
export function attackDamageModifier(
  ability: Ability | null,
  scores: Record<Ability, number>,
): number {
  return ability ? abilityModifier(scores[ability]) : 0;
}
