/**
 * Características derivadas do Tormenta20: perícias, Defesa, iniciativa, CD de magias, limite de
 * PM e carga. Valor de perícia = metade do nível + atributo-chave + treinamento (+2/+4/+6) +
 * bônus; Defesa = 10 + Destreza + armadura + escudo + outros.
 */
import { T20_ATTRIBUTES, type T20Attribute } from './attributes';
import { t20ConditionEffects } from './conditions';
import { t20ManaLimit, t20Tier, type T20Tier } from './progression';
import { T20_SKILLS, T20_SKILL_IDS, t20TrainingBonus, type T20Skill } from './skills';
import { t20Level, type T20Sheet } from './sheet';

export interface T20SkillValue {
  skill: T20Skill;
  label: string;
  attribute: T20Attribute;
  trained: boolean;
  /** Pode ser usada (perícias "apenas treinadas" exigem treino). */
  usable: boolean;
  total: number;
}

export interface T20Derived {
  level: number;
  halfLevel: number;
  trainingBonus: number;
  tier: T20Tier;
  attributes: Record<T20Attribute, number>;
  skills: Record<T20Skill, T20SkillValue>;
  defense: number;
  initiative: number;
  hitPointsMax: number;
  manaPointsMax: number;
  manaLimit: number;
  /** CD para resistir às magias e habilidades do personagem. */
  spellDc: number | null;
  /** Espaços de carga: 10 + 2 por ponto de Força positivo (ou –1 por ponto negativo). */
  carryCapacity: number;
  /** Deslocamento em metros, já com as condições. */
  speed: number;
}

const PHYSICAL: readonly T20Attribute[] = ['for', 'des', 'con'];

export function computeT20Derived(sheet: T20Sheet, conditions: readonly string[] = []): T20Derived {
  const level = t20Level(sheet);
  const halfLevel = Math.floor(level / 2);
  const trainingBonus = t20TrainingBonus(level);
  const effects = t20ConditionEffects(conditions);
  const attributes = Object.fromEntries(
    T20_ATTRIBUTES.map((key) => [key, sheet.attributes[key]]),
  ) as Record<T20Attribute, number>;
  const trained = new Set(sheet.skills.trained);

  const skills = Object.fromEntries(
    T20_SKILL_IDS.map((skill) => {
      const definition = T20_SKILLS[skill];
      const isTrained = trained.has(skill);
      let total =
        halfLevel +
        attributes[definition.attribute] +
        (isTrained ? trainingBonus : 0) +
        (sheet.skills.bonuses[skill] ?? 0);
      if (definition.armorPenalty) total += sheet.defense.armorPenalty + effects.armorPenalty;
      total +=
        effects.skills +
        (PHYSICAL.includes(definition.attribute) ? effects.physical : effects.mental);
      if (skill === 'reflexos') total += effects.reflexes;
      if (skill === 'percepcao') total += effects.perception;
      if (skill === 'iniciativa') total += effects.initiative;
      return [
        skill,
        {
          skill,
          label: definition.label,
          attribute: definition.attribute,
          trained: isTrained,
          usable: isTrained || !definition.trainedOnly,
          total,
        },
      ];
    }),
  ) as Record<T20Skill, T20SkillValue>;

  // Armadura pesada: a Destreza não entra na Defesa.
  const dexterity = sheet.defense.useDexterity ? attributes.des : 0;
  const defense =
    10 +
    dexterity +
    sheet.defense.armor +
    sheet.defense.shield +
    sheet.defense.other +
    effects.defense;
  const spellAttribute = sheet.spells.attribute;
  const speed =
    effects.speed === 'zero'
      ? 0
      : effects.speed === 'half'
        ? Math.floor(sheet.identity.speed / 2 / 1.5) * 1.5
        : sheet.identity.speed;

  return {
    level,
    halfLevel,
    trainingBonus,
    tier: t20Tier(level),
    attributes,
    skills,
    defense,
    initiative: skills.iniciativa.total,
    hitPointsMax: sheet.hitPoints.max,
    manaPointsMax: sheet.manaPoints.max,
    manaLimit: t20ManaLimit(level),
    spellDc: spellAttribute ? 10 + halfLevel + attributes[spellAttribute] : null,
    carryCapacity: Math.max(1, 10 + (attributes.for >= 0 ? 2 * attributes.for : attributes.for)),
    speed,
  };
}

/** PV máximos: PV iniciais da classe + Con no 1º nível, e PV por nível + Con (mínimo 1) depois. */
export function t20HitPointsFor(
  classes: readonly { pvInitial: number; pvPerLevel: number; level: number; first?: boolean }[],
  constitution: number,
  extra = 0,
): number {
  let total = 0;
  let counted = 0;
  for (const entry of classes) {
    for (let level = 1; level <= entry.level; level += 1) {
      const firstOfCharacter = counted === 0 && (entry.first ?? true);
      total += firstOfCharacter
        ? entry.pvInitial + constitution
        : Math.max(1, entry.pvPerLevel + constitution);
      counted += 1;
    }
  }
  return Math.max(1, total + extra);
}

/** PM máximos: soma dos PM por nível de cada classe. */
export function t20ManaPointsFor(
  classes: readonly { pmPerLevel: number; level: number }[],
  extra = 0,
): number {
  return Math.max(
    0,
    classes.reduce((sum, entry) => sum + entry.pmPerLevel * entry.level, 0) + extra,
  );
}
