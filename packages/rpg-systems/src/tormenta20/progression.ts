/**
 * Progressão do Tormenta20: experiência por nível, patamares e dinheiro inicial.
 */

/** XP acumulado para alcançar cada nível (índice 0 = 1º nível). */
export const T20_XP_BY_LEVEL = [
  0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000,
  171000, 190000,
] as const;

// O nível máximo (20) fica em `sheet.ts` (T20_MAX_LEVEL).

/** Nível correspondente a um total de XP. */
export function t20LevelForXp(xp: number): number {
  let level = 1;
  for (let index = 0; index < T20_XP_BY_LEVEL.length; index += 1) {
    if (xp >= T20_XP_BY_LEVEL[index]!) level = index + 1;
  }
  return level;
}

export type T20Tier = 'iniciante' | 'veterano' | 'campeao' | 'lenda';

export const t20TierLabels: Record<T20Tier, string> = {
  iniciante: 'Iniciante',
  veterano: 'Veterano',
  campeao: 'Campeão',
  lenda: 'Lenda',
};

/** Patamar de jogo: 1º–4º, 5º–10º, 11º–16º e 17º–20º níveis. */
export function t20Tier(level: number): T20Tier {
  if (level >= 17) return 'lenda';
  if (level >= 11) return 'campeao';
  if (level >= 5) return 'veterano';
  return 'iniciante';
}

/** Dinheiro inicial em T$ por nível (no 1º nível, 4d6). */
export const T20_STARTING_MONEY: Readonly<Record<number, number | '4d6'>> = {
  1: '4d6',
  2: 300,
  3: 600,
  4: 1000,
  5: 2000,
  6: 3000,
  7: 5000,
  8: 7000,
  9: 10000,
  10: 13000,
  11: 19000,
  12: 27000,
  13: 36000,
  14: 49000,
  15: 66000,
  16: 88000,
  17: 110000,
  18: 150000,
  19: 200000,
  20: 260000,
};

/** Limite de PM gastos numa única habilidade ou magia: o nível do personagem. */
export function t20ManaLimit(level: number): number {
  return Math.max(1, level);
}

/** Círculo máximo de magia de uma classe conjuradora completa pelo nível (1º, 5º, 9º, 13º e 17º). */
export function t20MaxSpellCircle(classLevel: number, progression: 'full' | 'half' = 'full'): number {
  if (progression === 'half') {
    if (classLevel >= 14) return 4;
    if (classLevel >= 10) return 3;
    if (classLevel >= 6) return 2;
    return 1;
  }
  if (classLevel >= 17) return 5;
  if (classLevel >= 13) return 4;
  if (classLevel >= 9) return 3;
  if (classLevel >= 5) return 2;
  return 1;
}
