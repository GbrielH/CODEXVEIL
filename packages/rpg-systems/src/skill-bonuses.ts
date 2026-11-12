/**
 * Perícias da ficha com o bônus já somado, para o painel de rolagem (site e app): escolher uma
 * perícia monta "1d20+bônus" sozinho.
 */
import { ABILITIES, abilityLabels, abilityModifier } from './dnd5e/abilities';
import { SKILLS, skillDefinitions } from './dnd5e/skills';
import { computeDnd5eDerived } from './dnd5e/derived';
import { parseDnd5eSheet } from './dnd5e/sheet';
import { computeT20Derived } from './tormenta20/derived';
import { parseT20Sheet } from './tormenta20/sheet';
import { T20_ATTRIBUTES, t20AttributeLabels } from './tormenta20/attributes';

export function characterSkillBonuses(
  systemId: string,
  sheet: unknown,
): { label: string; bonus: number }[] {
  try {
    if (systemId === 'dnd5e') {
      const derived = computeDnd5eDerived(parseDnd5eSheet(sheet));
      return SKILLS.map((skill) => ({
        label: skillDefinitions[skill].label,
        bonus: derived.skills[skill].bonus,
      }));
    }
    if (systemId === 'tormenta20') {
      const derived = computeT20Derived(parseT20Sheet(sheet));
      return Object.values(derived.skills)
        .filter((value) => value.usable)
        .map((value) => ({ label: value.label, bonus: value.total }));
    }
  } catch {
    return [];
  }
  return [];
}

/**
 * Atributos da ficha com o modificador que entra na rolagem (D&D: modificador do valor;
 * Tormenta20: o próprio atributo), para o painel de rolagem montar "1d20+mod".
 */
export function characterAttributeBonuses(systemId: string, sheet: unknown): { label: string; bonus: number }[] {
  try {
    if (systemId === 'dnd5e') {
      const parsed = parseDnd5eSheet(sheet);
      return ABILITIES.map((ability) => ({ label: abilityLabels[ability].name, bonus: abilityModifier(parsed.abilities[ability]) }));
    }
    if (systemId === 'tormenta20') {
      const derived = computeT20Derived(parseT20Sheet(sheet));
      return T20_ATTRIBUTES.map((attribute) => ({ label: t20AttributeLabels[attribute].name, bonus: derived.attributes[attribute] }));
    }
  } catch {
    return [];
  }
  return [];
}
