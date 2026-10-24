/**
 * Rascunho da criação de personagem de D&D 5e (SRD 5.2.1), preenchido passo a passo pelo
 * assistente. O mesmo formato é validado no navegador, no app e no servidor.
 */
import { z } from 'zod';
import { ABILITIES, type Ability } from '../abilities';

export const ABILITY_SCORE_METHODS = ['standard_array', 'point_buy', 'random'] as const;
export type AbilityScoreMethod = (typeof ABILITY_SCORE_METHODS)[number];

export const abilityScoreMethodLabels: Record<
  AbilityScoreMethod,
  { name: string; description: string }
> = {
  standard_array: {
    name: 'Conjunto padrão',
    description: 'Distribua os valores 15, 14, 13, 12, 10 e 8 entre os seis atributos.',
  },
  point_buy: {
    name: 'Compra de pontos',
    description: 'Gaste até 27 pontos: cada atributo começa em 8 e pode chegar a 15.',
  },
  random: {
    name: 'Rolagem',
    description:
      'Role 4d6 seis vezes, descarte o menor dado de cada rolagem e distribua os totais.',
  },
};

/** Conjunto padrão do SRD 5.2.1. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const POINT_BUY_COSTS: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Custo total na compra de pontos; `null` se algum valor estiver fora de 8 a 15. */
export function pointBuyCost(scores: Partial<Record<Ability, number | null>>): number | null {
  let total = 0;
  for (const ability of ABILITIES) {
    const score = scores[ability];
    if (score === null || score === undefined) continue;
    const cost = POINT_BUY_COSTS[score];
    if (cost === undefined) return null;
    total += cost;
  }
  return total;
}

/** Rola 4d6 e descarta o menor dado. `random` deve devolver um número em [0, 1). */
export function rollAbilityScore(random: () => number = Math.random): number {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6)).sort((a, b) => a - b);
  return dice[1]! + dice[2]! + dice[3]!;
}

export const RANDOM_SCORE_MIN = 3;
export const RANDOM_SCORE_MAX = 18;

const selectionSchema = z.union([
  z.string().max(160),
  z.array(z.string().max(160)).max(120),
  z.partialRecord(z.enum(ABILITIES), z.number().int().min(0).max(4)),
]);
export type Selection = z.output<typeof selectionSchema>;

const text = (max: number) =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres.`).default('');

export const dnd5eDraftSchema = z.object({
  name: text(80),
  level: z.number().int().min(1).max(20).default(1),
  /** Classe do SRD (`CLASS_IDS`) ou de um livro liberado ("<livro>:<chave>"). */
  classId: z.string().max(120).default(''),
  backgroundId: z.string().max(120).default(''),
  speciesId: z.string().max(120).default(''),
  abilityMethod: z.enum(ABILITY_SCORE_METHODS).default('standard_array'),
  /** Valores gerados pelo método, antes dos aumentos do antecedente e dos talentos. */
  baseScores: z
    .object(
      Object.fromEntries(
        ABILITIES.map((ability) => [
          ability,
          z.number().int().min(1).max(30).nullable().default(null),
        ]),
      ) as Record<Ability, z.ZodDefault<z.ZodNullable<z.ZodNumber>>>,
    )
    .prefault({}),
  /** Respostas das escolhas, indexadas pelo identificador de cada escolha. */
  selections: z.record(z.string().max(80), selectionSchema).default({}),
  alignment: z.string().max(40).default(''),
  /** Livros oficiais que a ficha pessoal usa; numa campanha, valem os livros do mestre. */
  sourcebooks: z.array(z.string().max(40)).max(80).default([]),
  details: z
    .object({
      appearance: text(4000),
      personality: text(4000),
      ideals: text(2000),
      bonds: text(2000),
      flaws: text(2000),
      backstory: text(20000),
    })
    .prefault({}),
});

export type Dnd5eDraft = z.output<typeof dnd5eDraftSchema>;
export type Dnd5eDraftInput = z.input<typeof dnd5eDraftSchema>;

export function createDnd5eDraft(overrides: Dnd5eDraftInput = {}): Dnd5eDraft {
  return dnd5eDraftSchema.parse(overrides);
}

export function selectionText(draft: Dnd5eDraft, id: string): string {
  const value = draft.selections[id];
  return typeof value === 'string' ? value : '';
}

export function selectionList(draft: Dnd5eDraft, id: string): string[] {
  const value = draft.selections[id];
  return Array.isArray(value) ? [...value] : [];
}

export function selectionIncrease(draft: Dnd5eDraft, id: string): Partial<Record<Ability, number>> {
  const value = draft.selections[id];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
