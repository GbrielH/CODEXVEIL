/**
 * Tabelas de progressão do SRD 5.2 (mecânicas licenciadas sob CC-BY-4.0).
 */

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

/** Bônus de proficiência por nível de personagem: 2 + ⌊(nível − 1) / 4⌋. */
export function proficiencyBonusForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.trunc(level), MIN_LEVEL), MAX_LEVEL);
  return 2 + Math.floor((clamped - 1) / 4);
}

/** Experiência mínima para cada nível (índice 0 = nível 1). */
export const EXPERIENCE_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000,
] as const;

export function levelForExperience(experience: number): number {
  let level = MIN_LEVEL;
  for (let index = 0; index < EXPERIENCE_THRESHOLDS.length; index++) {
    const threshold = EXPERIENCE_THRESHOLDS[index];
    if (threshold !== undefined && experience >= threshold) level = index + 1;
  }
  return level;
}

/** Experiência necessária para o próximo nível; `null` no nível máximo. */
export function experienceForNextLevel(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return EXPERIENCE_THRESHOLDS[Math.max(level, MIN_LEVEL)] ?? null;
}

/** Níveis de desafio válidos, em ordem crescente. */
export const CHALLENGE_RATINGS = [
  '0',
  '1/8',
  '1/4',
  '1/2',
  ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
] as const;
export type ChallengeRating = string;

const challengeExperience: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

export function isChallengeRating(value: string): boolean {
  return value in challengeExperience;
}

export function experienceForChallenge(rating: string): number | null {
  return challengeExperience[rating] ?? null;
}

/** Valor numérico do nível de desafio (frações incluídas). */
export function challengeValue(rating: string): number | null {
  if (!isChallengeRating(rating)) return null;
  const [numerator, denominator] = rating.split('/').map(Number);
  if (numerator === undefined || Number.isNaN(numerator)) return null;
  return denominator ? numerator / denominator : numerator;
}

/** Bônus de proficiência de criaturas pelo nível de desafio. */
export function proficiencyBonusForChallenge(rating: string): number | null {
  const value = challengeValue(rating);
  if (value === null) return null;
  if (value < 5) return 2;
  return 2 + Math.ceil((Math.min(value, 30) - 4) / 4);
}

/**
 * Espaços de magia por nível de conjurador (tabela de conjurador multiclasse do SRD 5.2).
 * Índice 0 = nível de conjurador 1; cada linha lista espaços dos círculos 1 a 9.
 */
export const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Sugestão de espaços de magia (círculos 1–9) para um nível de conjurador. */
export function suggestedSpellSlots(casterLevel: number): number[] {
  if (casterLevel < 1) return [];
  const row = FULL_CASTER_SLOTS[Math.min(Math.trunc(casterLevel), MAX_LEVEL) - 1] ?? [];
  return [...row];
}
