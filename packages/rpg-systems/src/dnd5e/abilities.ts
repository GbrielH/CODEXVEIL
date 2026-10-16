export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const abilityLabels: Record<Ability, { name: string; abbreviation: string }> = {
  str: { name: 'Força', abbreviation: 'FOR' },
  dex: { name: 'Destreza', abbreviation: 'DES' },
  con: { name: 'Constituição', abbreviation: 'CON' },
  int: { name: 'Inteligência', abbreviation: 'INT' },
  wis: { name: 'Sabedoria', abbreviation: 'SAB' },
  cha: { name: 'Carisma', abbreviation: 'CAR' },
};

export const ABILITY_SCORE_MIN = 1;
export const ABILITY_SCORE_MAX = 30;
export const DEFAULT_ABILITY_SCORE = 10;

/** Modificador de atributo: ⌊(valor − 10) / 2⌋. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Formata bônus com sinal explícito: +3, −1, +0. Usa o sinal de menos tipográfico. */
export function formatModifier(value: number): string {
  if (value < 0) return `−${Math.abs(value)}`;
  return `+${value}`;
}
