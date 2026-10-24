/**
 * Dados específicos de D&D 5e para entradas da tabela `character_abilities`
 * (coluna `data`): magias e ataques. Habilidades de classe, talentos e traços usam
 * apenas os campos genéricos (nome, origem, descrição) e um recurso opcional de usos.
 */
import { withBonus } from '@codexveil/domain';
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
  /** Bônus fixo no dano (armas mágicas +1, estilos de luta…). */
  damageBonus: z.number().int().min(-30).max(30).default(0),
  /** Dano adicional com outro tipo (ex.: "1d6" de fogo de uma espada flamejante). */
  extraDamage: text(40),
  extraDamageType: text(40),
  /** Menor resultado natural do d20 que é crítico (20 = só o 20; 19 = 19–20…). */
  critRange: z.number().int().min(2).max(20).default(20),
  /** Dano a mais só no crítico (ex.: "1d8" de Ataque Brutal), além de dobrar os dados. */
  critExtra: text(40),
});
export type Dnd5eAttackData = z.output<typeof dnd5eAttackDataSchema>;

/** "20" ou "19–20": a faixa de crítico do ataque. */
export function critRangeLabel(critRange: number): string {
  return critRange >= 20 ? '20' : `${critRange}–20`;
}

/** Dobra a quantidade de dados de uma fórmula ("1d8+2" → "2d8+2"). */
export function doubleDice(formula: string): string {
  return formula.replace(
    /(\d*)d(\d+)/gi,
    (_, count: string, sides: string) => `${(Number(count) || 1) * 2}d${sides}`,
  );
}

/**
 * Fórmula de dano do ataque: dados da arma + modificador + bônus de dano + dano adicional. No
 * crítico, os dados (da arma e do adicional) dobram e entra o dano extra de crítico.
 */
export function attackDamageFormula(
  attack: Dnd5eAttackData,
  scores: Record<Ability, number>,
  critical = false,
): string | null {
  if (!attack.damage.trim()) return null;
  const parts = [critical ? doubleDice(attack.damage) : attack.damage];
  if (attack.extraDamage.trim())
    parts.push(critical ? doubleDice(attack.extraDamage) : attack.extraDamage);
  if (critical && attack.critExtra.trim()) parts.push(attack.critExtra);
  const modifier = attackDamageModifier(attack.ability, scores) + attack.damageBonus;
  return withBonus(parts.map((part) => part.trim()).join('+'), modifier);
}

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
