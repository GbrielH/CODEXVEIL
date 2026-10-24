/**
 * Ataques calculados automaticamente (SRD 5.2.1): para armas do SRD, o atributo, a proficiência,
 * o bônus mágico (+1/+2/+3 no nome do item equipado), os estilos de luta, o Crítico Aprimorado do
 * Campeão e a Fúria do Bárbaro saem da ficha, sem digitar nada. Os campos manuais do ataque
 * (bônus e dano extra) continuam somando, para efeitos que o sistema não conhece.
 */
import { abilityModifier, type Ability } from './abilities';
import type { Dnd5eDerived } from './derived';
import type { Dnd5eAttackData } from './entries';
import { magicBonus, type GearItem } from './equipment-effects';
import type { Dnd5eSheet } from './sheet';
import { findSrdWeaponByName, sheetHasWeaponProficiency } from './weapon-attacks';

/** Efeitos que a pessoa liga e desliga durante o jogo. */
export interface Dnd5eActiveEffects {
  rage: boolean;
}

export interface Dnd5eAttackContext {
  sheet: Dnd5eSheet;
  derived: Dnd5eDerived;
  items: readonly GearItem[];
  /** Nomes das características e talentos da ficha. */
  features: readonly string[];
  effects: Dnd5eActiveEffects;
}

export interface ResolvedDnd5eAttack {
  /** Bônus total no acerto. */
  toHit: number;
  /** Fórmula do dano normal e do crítico (dados dobrados). */
  damage: string | null;
  critical: string | null;
  critRange: number;
  /** De onde veio cada bônus ("Força +3", "Proficiência +2", "Fúria +2 no dano"…). */
  notes: string[];
  /** Arma do SRD reconhecida: atributo e proficiência são automáticos. */
  automatic: boolean;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function classLevel(sheet: Dnd5eSheet, ...names: string[]): number {
  const wanted = names.map(normalize);
  return sheet.identity.classes
    .filter((entry) => wanted.includes(normalize(entry.name)))
    .reduce((total, entry) => total + entry.level, 0);
}

function hasFeature(features: readonly string[], ...fragments: string[]): boolean {
  const all = features.map(normalize);
  return fragments.some((fragment) => all.some((feature) => feature.includes(fragment)));
}

/** Dano extra da Fúria pelo nível de Bárbaro (SRD 5.2.1: +2, +3 no 9º, +4 no 16º). */
export function rageDamageBonus(barbarianLevel: number): number {
  if (barbarianLevel <= 0) return 0;
  return barbarianLevel >= 16 ? 4 : barbarianLevel >= 9 ? 3 : 2;
}

/** A ficha tem Fúria (Bárbaro)? */
export function canRage(sheet: Dnd5eSheet): boolean {
  return classLevel(sheet, 'Bárbaro', 'Barbarian') > 0;
}

/** Margem de crítico do Campeão: 19–20 no 3º nível de Guerreiro, 18–20 no 15º. */
function championCritRange(sheet: Dnd5eSheet): number {
  const champion = sheet.identity.classes.some((entry) =>
    /campe|champion/.test(normalize(entry.subclass ?? '')),
  );
  if (!champion) return 20;
  const fighter = classLevel(sheet, 'Guerreiro', 'Fighter');
  return fighter >= 15 ? 18 : fighter >= 3 ? 19 : 20;
}

function withModifier(formula: string, modifier: number): string {
  if (modifier === 0) return formula;
  return `${formula}${modifier > 0 ? '+' : ''}${modifier}`;
}

function doubleDice(formula: string): string {
  return formula.replace(
    /(\d*)d(\d+)/gi,
    (_, count: string, sides: string) => `${(Number(count) || 1) * 2}d${sides}`,
  );
}

const sign = (value: number) => (value >= 0 ? `+${value}` : String(value));

const ABILITY_SHORT: Record<Ability, string> = {
  str: 'For',
  dex: 'Des',
  con: 'Con',
  int: 'Int',
  wis: 'Sab',
  cha: 'Car',
};

/** Acerto, dano e crítico do ataque, com tudo o que a ficha já sabe. */
export function resolveDnd5eAttack(
  name: string,
  data: Dnd5eAttackData,
  context: Dnd5eAttackContext,
): ResolvedDnd5eAttack {
  const { sheet, derived, items, features, effects } = context;
  const weapon = findSrdWeaponByName(name);
  const notes: string[] = [];
  const mod = (ability: Ability) => abilityModifier(derived.abilities[ability]);

  // Atributo: armas do SRD seguem as regras (à distância = Des; acuidade = o maior); o resto usa o do ataque.
  let ability: Ability | null = data.ability;
  if (weapon) {
    ability =
      weapon.kind === 'ranged'
        ? 'dex'
        : weapon.properties.includes('finesse')
          ? mod('dex') > mod('str')
            ? 'dex'
            : 'str'
          : 'str';
  }
  const proficient = weapon ? sheetHasWeaponProficiency(sheet, weapon) : data.proficient;
  // Item equipado com o nome da arma ("Espada longa +1").
  const item = items.find(
    (entry) =>
      entry.isEquipped &&
      weapon &&
      findSrdWeaponByName(entry.name.replace(/\s*\+\s*[1-3]\b/, ''))?.id === weapon.id,
  );
  const magic = item ? magicBonus(item.name) : magicBonus(name);

  const abilityPart = ability ? mod(ability) : 0;
  let toHit = abilityPart + (proficient ? derived.proficiencyBonus : 0) + magic + data.bonus;
  if (ability) notes.push(`${ABILITY_SHORT[ability]} ${sign(abilityPart)}`);
  if (proficient) notes.push(`Proficiência +${derived.proficiencyBonus}`);
  else if (weapon) notes.push('Sem proficiência nesta arma');
  if (magic) notes.push(`Arma mágica +${magic} (acerto e dano)`);
  if (data.bonus) notes.push(`Bônus manual ${sign(data.bonus)} no acerto`);

  const ranged = weapon ? weapon.kind === 'ranged' : false;
  if (weapon && ranged && hasFeature(features, 'arquearia', 'archery')) {
    toHit += 2;
    notes.push('Estilo de Luta (Arquearia) +2 no acerto');
  }

  let damageBonus = abilityPart + magic + data.damageBonus;
  if (data.damageBonus) notes.push(`Bônus manual ${sign(data.damageBonus)} no dano`);
  if (
    weapon &&
    !ranged &&
    !weapon.properties.includes('two_handed') &&
    hasFeature(features, 'duelismo', 'duelo', 'dueling')
  ) {
    damageBonus += 2;
    notes.push('Estilo de Luta (Duelismo) +2 no dano');
  }
  if (effects.rage && ability === 'str' && !ranged) {
    const rage = rageDamageBonus(classLevel(sheet, 'Bárbaro', 'Barbarian'));
    if (rage) {
      damageBonus += rage;
      notes.push(`Fúria +${rage} no dano`);
    }
  }

  const critRange = Math.min(data.critRange, weapon ? championCritRange(sheet) : 20);
  if (critRange < data.critRange) notes.push(`Crítico Aprimorado (${critRange}–20)`);

  const dice = (critical: boolean) => {
    if (!data.damage.trim()) return null;
    const parts = [critical ? doubleDice(data.damage.trim()) : data.damage.trim()];
    if (data.extraDamage.trim())
      parts.push(critical ? doubleDice(data.extraDamage.trim()) : data.extraDamage.trim());
    if (critical && data.critExtra.trim()) parts.push(data.critExtra.trim());
    return withModifier(parts.join('+'), damageBonus);
  };

  return {
    toHit,
    damage: dice(false),
    critical: dice(true),
    critRange,
    notes,
    automatic: Boolean(weapon),
  };
}
