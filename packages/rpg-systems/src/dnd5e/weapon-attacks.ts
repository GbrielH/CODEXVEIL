/**
 * Ataque a partir de uma arma do inventário: ao equipar uma arma do SRD que ainda não tem
 * ataque na ficha, a ficha ganha o ataque com o atributo, a proficiência, o dano e o alcance
 * da arma (as mesmas regras da criação de personagem).
 */
import { abilityModifier } from './abilities';
import type { Dnd5eAttackData } from './entries';
import type { Dnd5eSheet } from './sheet';
import { SRD_WEAPONS, damageTypeLabels, formatDistance, weaponPropertyLabels } from './srd/equipment';
import type { WeaponDefinition } from './srd/types';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

/** Arma do SRD pelo nome do item ("Adaga", "Machadinhas (2)", "Espada longa"). */
export function findSrdWeaponByName(itemName: string): WeaponDefinition | undefined {
  const target = normalize(itemName);
  const weapons = Object.values(SRD_WEAPONS);
  return (
    weapons.find((weapon) => normalize(weapon.name) === target) ??
    // Plural simples: "Adagas", "Machadinhas".
    weapons.find((weapon) => `${normalize(weapon.name)}s` === target || normalize(weapon.name).replace(/ /g, 's ') + 's' === target)
  );
}

/** Proficiência pelo texto da ficha ("Armas simples e marciais", "Armas simples, Rapieira"…). */
export function sheetHasWeaponProficiency(sheet: Dnd5eSheet, weapon: WeaponDefinition): boolean {
  const text = normalize(sheet.proficiencies.weapons);
  if (text.includes(normalize(weapon.name))) return true;
  return weapon.category === 'simple' ? text.includes('simples') : text.includes('marcia');
}

export interface WeaponAttackEntry {
  kind: 'attack';
  name: string;
  source: string;
  description: string;
  data: Dnd5eAttackData;
}

export function weaponAttackEntry(weapon: WeaponDefinition, sheet: Dnd5eSheet): WeaponAttackEntry {
  const unit = sheet.combat.speedUnit;
  const str = abilityModifier(sheet.abilities.str);
  const dex = abilityModifier(sheet.abilities.dex);
  const ability = weapon.kind === 'ranged' ? 'dex' : weapon.properties.includes('finesse') ? (dex > str ? 'dex' : 'str') : 'str';
  const reach = weapon.properties.includes('reach') ? formatDistance(10, unit) : formatDistance(5, unit);
  const range =
    weapon.kind === 'ranged' && weapon.range
      ? `${formatDistance(weapon.range[0], unit)}/${formatDistance(weapon.range[1], unit)}`
      : weapon.range
        ? `${reach}; arremesso ${formatDistance(weapon.range[0], unit)}/${formatDistance(weapon.range[1], unit)}`
        : reach;
  const properties = weapon.properties
    .map((property) => (property === 'versatile' && weapon.versatileDamage ? `Versátil (${weapon.versatileDamage})` : weaponPropertyLabels[property]))
    .join(', ');
  const proficient = sheetHasWeaponProficiency(sheet, weapon);
  return {
    kind: 'attack',
    name: weapon.name,
    source: weapon.category === 'simple' ? 'Arma simples' : 'Arma marcial',
    description: [properties ? `Propriedades: ${properties}.` : '', proficient ? '' : 'Sem proficiência: não soma o bônus de proficiência.'].filter(Boolean).join(' '),
    data: { ability, proficient, bonus: 0, damage: weapon.damage, damageType: damageTypeLabels[weapon.damageType], range, damageBonus: 0, extraDamage: '', extraDamageType: '', critRange: 20, critExtra: '' },
  };
}

/**
 * O ataque pode ser usado agora? Se ele corresponde a uma arma do inventário (pelo nome), só
 * vale com a arma equipada; ataques sem arma no inventário (desarmado, garras, magias de
 * ataque) valem sempre.
 */
export function isAttackAvailable(attackName: string, items: readonly { name: string; isEquipped: boolean }[]): boolean {
  const target = normalize(attackName);
  const weapon = findSrdWeaponByName(attackName);
  const matches = items.filter((item) => {
    if (normalize(item.name) === target) return true;
    const itemWeapon = findSrdWeaponByName(item.name);
    return Boolean(weapon && itemWeapon && itemWeapon.id === weapon.id);
  });
  return matches.length === 0 || matches.some((item) => item.isEquipped);
}
