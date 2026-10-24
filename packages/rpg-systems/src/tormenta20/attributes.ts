/**
 * Atributos do Tormenta20: o valor do atributo já é o modificador (0 = média humana).
 */
export const T20_ATTRIBUTES = ['for', 'des', 'con', 'int', 'sab', 'car'] as const;
export type T20Attribute = (typeof T20_ATTRIBUTES)[number];

export const t20AttributeLabels: Record<T20Attribute, { name: string; abbreviation: string }> = {
  for: { name: 'Força', abbreviation: 'For' },
  des: { name: 'Destreza', abbreviation: 'Des' },
  con: { name: 'Constituição', abbreviation: 'Con' },
  int: { name: 'Inteligência', abbreviation: 'Int' },
  sab: { name: 'Sabedoria', abbreviation: 'Sab' },
  car: { name: 'Carisma', abbreviation: 'Car' },
};

/** Pontos para comprar atributos (todos começam em 0). */
export const T20_POINT_BUY_BUDGET = 10;

/** Custo acumulado de cada valor na compra por pontos; –1 devolve 1 ponto. */
export const T20_POINT_BUY_COST: Readonly<Record<number, number>> = {
  [-1]: -1,
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 7,
};
export const T20_POINT_BUY_MIN = -1;
export const T20_POINT_BUY_MAX = 4;

export function t20PointBuyCost(value: number): number {
  return T20_POINT_BUY_COST[value] ?? Number.POSITIVE_INFINITY;
}

export function t20PointsSpent(values: Readonly<Record<T20Attribute, number>>): number {
  return T20_ATTRIBUTES.reduce((sum, key) => sum + t20PointBuyCost(values[key]), 0);
}

/** Converte um resultado de 4d6 (descartando o menor) no valor do atributo. */
export function t20AttributeFromRoll(total: number): number {
  if (total <= 7) return -2;
  if (total <= 9) return -1;
  if (total <= 11) return 0;
  if (total <= 13) return 1;
  if (total <= 15) return 2;
  if (total <= 17) return 3;
  return 4;
}

/** Na rolagem, os seis valores precisam somar pelo menos 6 (senão o menor é rolado de novo). */
export const T20_ROLL_MINIMUM_SUM = 6;

export function formatT20Bonus(value: number): string {
  return value >= 0 ? `+${value}` : `–${Math.abs(value)}`;
}
