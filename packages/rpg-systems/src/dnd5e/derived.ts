/**
 * Valores derivados da ficha de D&D 5e. Funções puras: a mesma ficha sempre produz os
 * mesmos números, na web e no mobile.
 */
import { ABILITIES, abilityModifier, type Ability } from './abilities';
import {
  experienceForNextLevel,
  levelForExperience,
  proficiencyBonusForLevel,
} from './progression';
import { HIT_DICE, totalLevel, type Dnd5eSheet, type HitDie } from './sheet';
import {
  SKILLS,
  proficiencyContribution,
  skillDefinitions,
  type ProficiencyLevel,
  type Skill,
} from './skills';

export interface Dnd5eSkillValue {
  ability: Ability;
  proficiency: ProficiencyLevel;
  bonus: number;
}

export interface Dnd5eDerived {
  level: number;
  proficiencyBonus: number;
  abilityModifiers: Record<Ability, number>;
  savingThrows: Record<Ability, number>;
  skills: Record<Skill, Dnd5eSkillValue>;
  initiative: number;
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  spellcasting: { ability: Ability; saveDc: number; attackBonus: number } | null;
  /** Capacidade de carga: Força × 15 lb (≈ Força × 7,5 kg). */
  carryingCapacity: { pounds: number; kilograms: number };
  hitDice: Record<HitDie, number>;
  experience: {
    current: number;
    nextLevelAt: number | null;
    /** Nível indicado pela experiência; útil quando a evolução é por XP. */
    levelFromExperience: number;
  };
}

function mapAbilities<T>(fn: (ability: Ability) => T): Record<Ability, T> {
  return Object.fromEntries(ABILITIES.map((ability) => [ability, fn(ability)])) as Record<
    Ability,
    T
  >;
}

export function computeDnd5eDerived(sheet: Dnd5eSheet): Dnd5eDerived {
  const level = totalLevel(sheet);
  const proficiencyBonus = proficiencyBonusForLevel(level);
  const abilityModifiers = mapAbilities((ability) => abilityModifier(sheet.abilities[ability]));

  const savingThrows = mapAbilities((ability) => {
    const entry = sheet.savingThrows[ability];
    return abilityModifiers[ability] + (entry.proficient ? proficiencyBonus : 0) + entry.bonus;
  });

  const skills = Object.fromEntries(
    SKILLS.map((skill) => {
      const { ability } = skillDefinitions[skill];
      const entry = sheet.skills[skill];
      const value: Dnd5eSkillValue = {
        ability,
        proficiency: entry.proficiency,
        bonus:
          abilityModifiers[ability] +
          proficiencyContribution(entry.proficiency, proficiencyBonus) +
          entry.bonus,
      };
      return [skill, value];
    }),
  ) as Record<Skill, Dnd5eSkillValue>;

  const castingAbility = sheet.spellcasting.ability;
  const spellcasting = castingAbility
    ? {
        ability: castingAbility,
        saveDc:
          8 +
          proficiencyBonus +
          abilityModifiers[castingAbility] +
          sheet.spellcasting.saveDcBonus,
        attackBonus:
          proficiencyBonus + abilityModifiers[castingAbility] + sheet.spellcasting.attackBonus,
      }
    : null;

  const hitDice = Object.fromEntries(HIT_DICE.map((die) => [die, 0])) as Record<HitDie, number>;
  for (const entry of sheet.identity.classes) {
    hitDice[entry.hitDie] += entry.level;
  }

  return {
    level,
    proficiencyBonus,
    abilityModifiers,
    savingThrows,
    skills,
    initiative: abilityModifiers.dex + sheet.combat.initiativeBonus,
    passivePerception: 10 + skills.perception.bonus,
    passiveInsight: 10 + skills.insight.bonus,
    passiveInvestigation: 10 + skills.investigation.bonus,
    spellcasting,
    carryingCapacity: {
      pounds: sheet.abilities.str * 15,
      kilograms: sheet.abilities.str * 7.5,
    },
    hitDice,
    experience: {
      current: sheet.identity.experience,
      nextLevelAt: experienceForNextLevel(level),
      levelFromExperience: levelForExperience(sheet.identity.experience),
    },
  };
}
