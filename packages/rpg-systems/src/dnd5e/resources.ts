/**
 * Trilhas de recurso padrão de um personagem de D&D 5e.
 */
import type { ResourceTemplate } from '../types';
import { abilityModifier } from './abilities';
import { suggestedSpellSlots } from './progression';
import { CURRENCIES, HIT_DICE, currencyLabels, type Currency, type Dnd5eSheet, type HitDie } from './sheet';

export const DND5E_RESOURCE_KEYS = {
  hitPoints: 'hp',
  deathSaveSuccesses: 'death_save_successes',
  deathSaveFailures: 'death_save_failures',
  heroicInspiration: 'heroic_inspiration',
} as const;

export function hitDiceResourceKey(die: HitDie): string {
  return `hit_dice_${die}`;
}

export function spellSlotResourceKey(circle: number): string {
  return `spell_slot_${circle}`;
}

export function currencyResourceKey(coin: Currency): string {
  return `currency_${coin}`;
}

const CURRENCY_KEY_PATTERN = /^currency_(cp|sp|ep|gp|pp)$/;

/** Moeda representada por uma trilha, ou `null` se a trilha não for de moedas. */
export function currencyFromResourceKey(key: string): Currency | null {
  const match = CURRENCY_KEY_PATTERN.exec(key);
  return match ? (match[1] as Currency) : null;
}

/** Trilha vazia de uma moeda (sem máximo, recuperação manual). */
export function currencyResource(coin: Currency, amount = 0): ResourceTemplate {
  return {
    key: currencyResourceKey(coin),
    label: currencyLabels[coin].name,
    current: amount,
    max: null,
    recovery: 'manual',
    display: 'pool',
    sortOrder: 200 + CURRENCIES.indexOf(coin),
  };
}

/** Valor total em peças de ouro (1 PL = 10 PO, 1 PE = 0,5 PO, 1 PP = 0,1 PO, 1 PC = 0,01 PO). */
export function totalInGold(coins: Partial<Record<Currency, number>>): number {
  const rates: Record<Currency, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
  const total = CURRENCIES.reduce((sum, coin) => sum + (coins[coin] ?? 0) * rates[coin], 0);
  return Math.round(total * 100) / 100;
}

/**
 * Chaves das trilhas exibidas em áreas próprias da ficha (vida, testes contra a morte,
 * inspiração e moedas); as demais aparecem na lista geral de recursos.
 */
export function isDedicatedResourceKey(key: string): boolean {
  return (
    (Object.values(DND5E_RESOURCE_KEYS) as string[]).includes(key) ||
    currencyFromResourceKey(key) !== null
  );
}

const dieSize: Record<HitDie, number> = { d6: 6, d8: 8, d10: 10, d12: 12 };

/**
 * Sugestão de pontos de vida máximos: valor máximo do dado no 1º nível e a média fixa
 * (metade do dado + 1) nos demais, somando o modificador de Constituição a cada nível.
 * É apenas uma sugestão: o valor máximo é sempre informado pelo usuário.
 */
export function suggestHitPointMax(sheet: Dnd5eSheet): number {
  const conModifier = abilityModifier(sheet.abilities.con);
  let total = 0;
  let isFirstLevel = true;
  for (const entry of sheet.identity.classes) {
    const size = dieSize[entry.hitDie];
    for (let level = 0; level < entry.level; level++) {
      const roll = isFirstLevel ? size : size / 2 + 1;
      total += Math.max(1, roll + conModifier);
      isFirstLevel = false;
    }
  }
  return Math.max(1, total);
}

export function dnd5eDefaultResources(sheet: Dnd5eSheet): ResourceTemplate[] {
  const hitPointMax = suggestHitPointMax(sheet);
  const resources: ResourceTemplate[] = [
    {
      key: DND5E_RESOURCE_KEYS.hitPoints,
      label: 'Pontos de vida',
      current: hitPointMax,
      max: hitPointMax,
      recovery: 'long_rest',
      display: 'health',
      sortOrder: 0,
    },
  ];

  HIT_DICE.forEach((die, index) => {
    const count = sheet.identity.classes
      .filter((entry) => entry.hitDie === die)
      .reduce((sum, entry) => sum + entry.level, 0);
    if (count > 0) {
      resources.push({
        key: hitDiceResourceKey(die),
        label: `Dados de vida (${die})`,
        current: count,
        max: count,
        recovery: 'long_rest',
        display: 'pool',
        sortOrder: 10 + index,
      });
    }
  });

  resources.push(
    {
      key: DND5E_RESOURCE_KEYS.deathSaveSuccesses,
      label: 'Sucessos contra a morte',
      current: 0,
      max: 3,
      recovery: 'manual',
      display: 'checkboxes',
      sortOrder: 20,
    },
    {
      key: DND5E_RESOURCE_KEYS.deathSaveFailures,
      label: 'Falhas contra a morte',
      current: 0,
      max: 3,
      recovery: 'manual',
      display: 'checkboxes',
      sortOrder: 21,
    },
    {
      key: DND5E_RESOURCE_KEYS.heroicInspiration,
      label: 'Inspiração heroica',
      current: 0,
      max: 1,
      recovery: 'manual',
      display: 'checkboxes',
      sortOrder: 30,
    },
    ...CURRENCIES.map((coin) => currencyResource(coin)),
  );

  return resources;
}

/** Trilhas de espaços de magia sugeridas para um nível de conjurador. */
export function spellSlotResources(casterLevel: number): ResourceTemplate[] {
  return suggestedSpellSlots(casterLevel).map((slots, index) => ({
    key: spellSlotResourceKey(index + 1),
    label: `Espaços de magia — ${index + 1}º círculo`,
    current: slots,
    max: slots,
    recovery: 'long_rest',
    display: 'pool',
    sortOrder: 40 + index,
  }));
}
