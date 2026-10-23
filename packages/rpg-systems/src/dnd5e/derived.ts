/**
 * Valores derivados da ficha de D&D 5e. Funções puras: a mesma ficha sempre produz os
 * mesmos números, na web e no mobile.
 */
import { ABILITIES, abilityModifier, type Ability } from './abilities';
import { computeDnd5eCombat, type GearItem } from './equipment-effects';
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
  /** Classe de Armadura calculada (armadura, escudo, Destreza, Defesa sem Armadura, itens). */
  armorClass: number;
  armorClassBreakdown: string[];
  /** Deslocamento calculado (espécie, classe, armadura), na unidade da ficha. */
  speed: number;
  speedNotes: string[];
  /** Atributos efetivos (com itens como as Manoplas de Força do Ogro). */
  abilities: Record<Ability, number>;
  abilityNotes: string[];
  /** Avisos do equipamento (armadura sem a Força exigida…). */
  combatWarnings: string[];
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

/**
 * Valores derivados. Com `gear` (itens e nomes das características), CA, deslocamento e
 * atributos vêm do equipamento; sem ele (ex.: prévia da criação), da ficha.
 */
export function computeDnd5eDerived(sheet: Dnd5eSheet, gear?: { items: readonly GearItem[]; features?: readonly string[] }): Dnd5eDerived {
  const level = totalLevel(sheet);
  const proficiencyBonus = proficiencyBonusForLevel(level);
  const combat = gear ? computeDnd5eCombat(sheet, gear.items, gear.features ?? []) : null;
  const scores = combat?.abilities ?? sheet.abilities;
  const abilityModifiers = mapAbilities((ability) => abilityModifier(scores[ability]));
  const plainName = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  // Pau para Toda Obra (Bardo 2º): metade da proficiência nos testes de atributo sem proficiência.
  const jackOfAllTrades = sheet.identity.classes.some((entry) => ['bardo', 'bard'].includes(plainName(entry.name)) && entry.level >= 2);
  // Alerta (talento): soma a proficiência na Iniciativa.
  const alert = (gear?.features ?? []).some((feature) => ['alerta', 'alert'].includes(plainName(feature).replace(/^talento:\s*/, '').trim()));
  const checkProficiency = (level: ProficiencyLevel) =>
    level === 'none' && jackOfAllTrades ? Math.floor(proficiencyBonus / 2) : proficiencyContribution(level, proficiencyBonus);

  const savingThrows = mapAbilities((ability) => {
    const entry = sheet.savingThrows[ability];
    return abilityModifiers[ability] + (entry.proficient ? proficiencyBonus : 0) + entry.bonus + (combat?.savingThrowBonus ?? 0);
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
          checkProficiency(entry.proficiency) +
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
    initiative:
      abilityModifiers.dex +
      (alert && sheet.combat.initiativeProficiency === 'none' ? proficiencyBonus : checkProficiency(sheet.combat.initiativeProficiency)) +
      sheet.combat.initiativeBonus,
    armorClass: combat?.armorClass ?? sheet.combat.armorClass,
    armorClassBreakdown: combat?.armorClassBreakdown ?? [],
    speed: combat?.speed ?? sheet.combat.speed,
    speedNotes: combat?.speedNotes ?? [],
    abilities: scores,
    abilityNotes: combat?.abilityNotes ?? [],
    combatWarnings: combat?.warnings ?? [],
    passivePerception: 10 + skills.perception.bonus,
    passiveInsight: 10 + skills.insight.bonus,
    passiveInvestigation: 10 + skills.investigation.bonus,
    spellcasting,
    carryingCapacity: {
      pounds: scores.str * 15,
      kilograms: scores.str * 7.5,
    },
    hitDice,
    experience: {
      current: sheet.identity.experience,
      nextLevelAt: experienceForNextLevel(level),
      levelFromExperience: levelForExperience(sheet.identity.experience),
    },
  };
}
