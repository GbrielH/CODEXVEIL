/**
 * Perícias da ficha com o bônus já somado, para o painel de rolagem (site e app): escolher uma
 * perícia monta "1d20+bônus" sozinho.
 */
import { SKILLS, skillDefinitions } from './dnd5e/skills';
import { computeDnd5eDerived } from './dnd5e/derived';
import { parseDnd5eSheet } from './dnd5e/sheet';
import { computeT20Derived } from './tormenta20/derived';
import { parseT20Sheet } from './tormenta20/sheet';

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
