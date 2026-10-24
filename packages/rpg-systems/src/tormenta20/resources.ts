import type { ResourceTemplate } from '../types';
import type { T20Sheet } from './sheet';

export const T20_RESOURCE_KEYS = {
  hitPoints: 'hp',
  manaPoints: 'pm',
  money: 'tibar',
} as const;

/** Trilhas de um personagem novo: PV, PM e Tibares (T$). */
export function t20DefaultResources(sheet: T20Sheet, money = 0): ResourceTemplate[] {
  return [
    {
      key: T20_RESOURCE_KEYS.hitPoints,
      label: 'Pontos de Vida',
      current: sheet.hitPoints.max,
      max: sheet.hitPoints.max,
      recovery: 'long_rest',
      display: 'health',
      sortOrder: 0,
    },
    {
      key: T20_RESOURCE_KEYS.manaPoints,
      label: 'Pontos de Mana',
      current: sheet.manaPoints.max,
      max: sheet.manaPoints.max,
      recovery: 'long_rest',
      display: 'pool',
      sortOrder: 1,
    },
    {
      key: T20_RESOURCE_KEYS.money,
      label: 'Tibares (T$)',
      current: money,
      max: null,
      recovery: 'manual',
      display: 'pool',
      sortOrder: 200,
    },
  ];
}

/** Trilhas exibidas em áreas próprias da ficha (vida, mana e dinheiro). */
export function isT20DedicatedResourceKey(key: string): boolean {
  return (Object.values(T20_RESOURCE_KEYS) as string[]).includes(key);
}

/** Recuperação com uma noite de descanso: metade do nível (ruim) até o triplo (luxuosa). */
export const T20_REST_QUALITY = {
  ruim: { label: 'Ruim (ao relento)', factor: 0.5 },
  normal: { label: 'Normal (estalagem comum)', factor: 1 },
  confortavel: { label: 'Confortável', factor: 2 },
  luxuosa: { label: 'Luxuosa', factor: 3 },
} as const;

export type T20RestQuality = keyof typeof T20_REST_QUALITY;

export function t20RestRecovery(level: number, quality: T20RestQuality): number {
  return Math.max(1, Math.floor(level * T20_REST_QUALITY[quality].factor));
}
