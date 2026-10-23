/**
 * Combate automático da ficha de D&D 5e (SRD 5.2.1) a partir do que está equipado e das
 * classes: Classe de Armadura, deslocamento e atributos alterados por itens mágicos.
 * Funções puras: a mesma ficha e os mesmos itens dão sempre os mesmos números (site e app).
 */
import { abilityModifier, type Ability } from './abilities';
import type { Dnd5eSheet } from './sheet';
import { SRD_ARMOR } from './srd/equipment';
import { listSpecies } from './srd/species';
import type { ArmorDefinition } from './srd/types';

/** Item da ficha (o mínimo que o cálculo precisa). */
export interface GearItem {
  name: string;
  category: string;
  isEquipped: boolean;
}

export interface Dnd5eCombatResult {
  /** Atributos com os itens equipados (Manoplas de Força do Ogro etc.). */
  abilities: Record<Ability, number>;
  /** De onde veio cada atributo alterado ("Força 19: Manoplas de Força do Ogro"). */
  abilityNotes: string[];
  armorClass: number;
  /** Como a CA foi calculada, para mostrar ao jogador. */
  armorClassBreakdown: string[];
  /** Deslocamento na unidade da ficha. */
  speed: number;
  speedNotes: string[];
  /** Bônus em todos os testes de resistência (Anel/Manto de Proteção). */
  savingThrowBonus: number;
  /** Armadura equipada sem a Força exigida, armadura sem treino etc. */
  warnings: string[];
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

/** "+1", "+2" ou "+3" no nome do item (armas, armaduras e escudos mágicos). */
export function magicBonus(name: string): number {
  const match = /\+\s*([1-3])\b/.exec(name);
  return match ? Number(match[1]) : 0;
}

/** Armadura do SRD pelo nome do item ("Cota de malha", "Armadura de placas +1", "Escudo"). */
export function findSrdArmorByName(name: string): ArmorDefinition | undefined {
  const target = normalize(name.replace(/\+\s*[1-3]\b/, ''));
  const armors = Object.values(SRD_ARMOR);
  return armors.find((armor) => normalize(armor.name) === target) ?? armors.find((armor) => target.startsWith(normalize(armor.name)));
}

/** Itens que fixam um atributo num valor (só vale se for maior que o atual). */
const ABILITY_ITEMS: { keywords: string[]; ability: Ability; score: number }[] = [
  { keywords: ['manoplas de forca do ogro', 'gauntlets of ogre power'], ability: 'str', score: 19 },
  { keywords: ['tiara do intelecto', 'headband of intellect'], ability: 'int', score: 19 },
  { keywords: ['amuleto da saude', 'amulet of health'], ability: 'con', score: 19 },
  { keywords: ['forca de gigante das colinas', 'hill giant strength'], ability: 'str', score: 21 },
  { keywords: ['forca de gigante de pedra', 'stone giant strength'], ability: 'str', score: 23 },
  { keywords: ['forca de gigante do gelo', 'forca de gigante de gelo', 'frost giant strength'], ability: 'str', score: 23 },
  { keywords: ['forca de gigante do fogo', 'forca de gigante de fogo', 'fire giant strength'], ability: 'str', score: 25 },
  { keywords: ['forca de gigante das nuvens', 'cloud giant strength'], ability: 'str', score: 27 },
  { keywords: ['forca de gigante das tempestades', 'forca de gigante da tempestade', 'storm giant strength'], ability: 'str', score: 29 },
];

/** Anel ou Manto de Proteção: +1 na CA e nos testes de resistência. */
const PROTECTION_ITEMS = ['anel de protecao', 'ring of protection', 'manto de protecao', 'cloak of protection'];

function classLevel(sheet: Dnd5eSheet, ...names: string[]): number {
  const wanted = names.map(normalize);
  return sheet.identity.classes.filter((entry) => wanted.includes(normalize(entry.name))).reduce((total, entry) => total + entry.level, 0);
}

function hasSubclass(sheet: Dnd5eSheet, fragment: string): boolean {
  return sheet.identity.classes.some((entry) => normalize(entry.subclass ?? '').includes(fragment));
}

/** Deslocamento base da espécie em pés (SRD e livros ativos), pelo nome gravado na ficha. */
export function speciesSpeedFeet(speciesName: string): number | null {
  const base = normalize(speciesName.split(' (')[0] ?? speciesName);
  const found = listSpecies().find((species) => normalize(species.name) === base);
  return found ? found.speed : null;
}

const toUnit = (feet: number, unit: 'm' | 'ft') => (unit === 'm' ? Math.round(feet * 0.3 * 10) / 10 : feet);

/**
 * CA, deslocamento e atributos efetivos. `features` são os nomes das características e
 * talentos da ficha (para Estilo de Luta: Defesa).
 */
export function computeDnd5eCombat(sheet: Dnd5eSheet, items: readonly GearItem[], features: readonly string[] = []): Dnd5eCombatResult {
  const equipped = items.filter((item) => item.isEquipped);
  const names = equipped.map((item) => ({ item, name: normalize(item.name) }));

  // Atributos alterados por itens equipados.
  const abilities = { ...sheet.abilities };
  const abilityNotes: string[] = [];
  for (const rule of ABILITY_ITEMS) {
    const match = names.find(({ name }) => rule.keywords.some((keyword) => name.includes(keyword)));
    if (match && rule.score > abilities[rule.ability]) {
      abilities[rule.ability] = rule.score;
      abilityNotes.push(`${rule.ability.toUpperCase()} ${rule.score}: ${match.item.name}`);
    }
  }
  const mod = (ability: Ability) => abilityModifier(abilities[ability]);

  // Armadura e escudo equipados.
  const warnings: string[] = [];
  const armorItems = equipped.map((item) => ({ item, armor: findSrdArmorByName(item.name) })).filter((entry) => entry.armor);
  const body = armorItems.find((entry) => entry.armor!.category !== 'shield');
  const shield = armorItems.find((entry) => entry.armor!.category === 'shield');
  const breakdown: string[] = [];
  let armorClass: number;
  if (body) {
    const armor = body.armor!;
    const dex = armor.dexterity === 'full' ? mod('dex') : armor.dexterity === 'max2' ? Math.min(2, mod('dex')) : 0;
    const bonus = magicBonus(body.item.name);
    armorClass = armor.armorClass + dex + bonus;
    breakdown.push(`${body.item.name}: ${armor.armorClass}${armor.dexterity === 'none' ? '' : ` + Des ${dex >= 0 ? '+' : ''}${dex}${armor.dexterity === 'max2' ? ' (máx. 2)' : ''}`}${bonus ? ` + ${bonus} mágico` : ''}`);
    if (armor.strength && abilities.str < armor.strength) warnings.push(`${armor.name} exige Força ${armor.strength}: deslocamento −3 m.`);
  } else {
    // Sem armadura: 10 + Des, ou a melhor Defesa sem Armadura da classe.
    const options: { value: number; label: string }[] = [{ value: 10 + mod('dex'), label: `Sem armadura: 10 + Des ${mod('dex')}` }];
    if (classLevel(sheet, 'Bárbaro', 'Barbarian') > 0) options.push({ value: 10 + mod('dex') + mod('con'), label: `Defesa sem Armadura (Bárbaro): 10 + Des + Con` });
    if (classLevel(sheet, 'Monge', 'Monk') > 0 && !shield) options.push({ value: 10 + mod('dex') + mod('wis'), label: `Defesa sem Armadura (Monge): 10 + Des + Sab` });
    if (hasSubclass(sheet, 'dracon')) options.push({ value: 10 + mod('dex') + mod('cha'), label: `Resiliência Dracônica: 10 + Des + Car` });
    const best = options.reduce((top, option) => (option.value > top.value ? option : top));
    armorClass = best.value;
    breakdown.push(best.label);
  }
  if (shield) {
    const bonus = magicBonus(shield.item.name);
    armorClass += 2 + bonus;
    breakdown.push(`${shield.item.name}: +2${bonus ? ` + ${bonus} mágico` : ''}`);
  }
  const protections = names.filter(({ name }) => PROTECTION_ITEMS.some((keyword) => name.includes(keyword)));
  for (const { item } of protections) {
    armorClass += 1;
    breakdown.push(`${item.name}: +1`);
  }
  if (body && features.some((feature) => ['defesa', 'estilo de luta: defesa', 'defense'].includes(normalize(feature)))) {
    armorClass += 1;
    breakdown.push('Estilo de Luta (Defesa): +1');
  }

  // Deslocamento: espécie + características de classe − armadura pesada sem Força.
  const speedNotes: string[] = [];
  const unit = sheet.combat.speedUnit;
  const speciesFeet = speciesSpeedFeet(sheet.identity.species);
  let feet = speciesFeet ?? (unit === 'ft' ? sheet.combat.speed : Math.round(sheet.combat.speed / 0.3));
  speedNotes.push(speciesFeet ? `Espécie: ${toUnit(speciesFeet, unit)} ${unit}` : `Base: ${toUnit(feet, unit)} ${unit}`);
  const monk = classLevel(sheet, 'Monge', 'Monk');
  if (monk >= 2 && !body && !shield) {
    const extra = monk >= 18 ? 30 : monk >= 14 ? 25 : monk >= 10 ? 20 : monk >= 6 ? 15 : 10;
    feet += extra;
    speedNotes.push(`Movimento sem Armadura: +${toUnit(extra, unit)} ${unit}`);
  }
  const barbarian = classLevel(sheet, 'Bárbaro', 'Barbarian');
  if (barbarian >= 5 && body?.armor?.category !== 'heavy') {
    feet += 10;
    speedNotes.push(`Movimento Rápido: +${toUnit(10, unit)} ${unit}`);
  }
  if (body?.armor?.strength && abilities.str < body.armor.strength) {
    feet -= 10;
    speedNotes.push(`Armadura pesada sem a Força exigida: −${toUnit(10, unit)} ${unit}`);
  }

  return {
    abilities,
    abilityNotes,
    armorClass,
    armorClassBreakdown: breakdown,
    speed: toUnit(Math.max(0, feet), unit),
    speedNotes,
    savingThrowBonus: protections.length,
    warnings,
  };
}
