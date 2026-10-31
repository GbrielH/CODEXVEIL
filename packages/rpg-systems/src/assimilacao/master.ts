import { z } from 'zod';

/**
 * Aba MASTER do Assimilador: Partituras de Conflito e Refúgios, no formato das fichas oficiais
 * de fã (ficha-assimilacao-rpg). Tudo texto livre e números: o mestre preenche à mão.
 */
const text = (max: number) => z.string().max(max).default('');
const id = z.string().min(1).max(40);

export const masterActivationSchema = z.object({
  id,
  /** Custo em símbolos, como no livro (ex.: "2C", "1A+1B"). */
  cost: text(20),
  effect: text(600),
});

export const masterThreatSchema = z.object({
  id,
  name: text(120),
  notes: text(2000),
  activations: z.array(masterActivationSchema).max(20).default([]),
});

export const masterObjectiveSchema = z.object({
  id,
  name: text(120),
  current: z.number().int().min(0).max(99).default(0),
  max: z.number().int().min(1).max(99).default(10),
  /** Recompensas e consequências se falhar. */
  notes: text(1000),
});

export const masterConflictSchema = z.object({
  id,
  name: text(120).default('Novo Conflito'),
  conditions: text(3000),
  activations: z.array(masterActivationSchema).max(30).default([]),
  threats: z.array(masterThreatSchema).max(30).default([]),
  objectives: z.array(masterObjectiveSchema).max(20).default([]),
});

export const REFUGE_ATTRIBUTES = ['defesa', 'moral', 'mobilidade', 'beligerancia'] as const;
export const REFUGE_RESOURCES = ['agua', 'alimento', 'madeira'] as const;
export const refugeLabels: Record<
  (typeof REFUGE_ATTRIBUTES)[number] | (typeof REFUGE_RESOURCES)[number],
  string
> = {
  defesa: 'Defesa',
  moral: 'Moral',
  mobilidade: 'Mobilidade',
  beligerancia: 'Beligerância',
  agua: 'Água',
  alimento: 'Alimento',
  madeira: 'Madeira',
};

const score = z.number().int().min(0).max(999).default(0);

export const masterRefugeSchema = z.object({
  id,
  name: text(120).default('Novo Refúgio'),
  population: score,
  capacity: score,
  defesa: score,
  moral: score,
  mobilidade: score,
  beligerancia: score,
  agua: score,
  /** Fonte de água infinita (rio, poço): a Água não acaba. */
  infiniteWater: z.boolean().default(false),
  alimento: score,
  madeira: score,
  notes: text(2000),
});

export type MasterActivation = z.output<typeof masterActivationSchema>;
export type MasterThreat = z.output<typeof masterThreatSchema>;
export type MasterObjective = z.output<typeof masterObjectiveSchema>;
export type MasterConflict = z.output<typeof masterConflictSchema>;
export type MasterRefuge = z.output<typeof masterRefugeSchema>;

/** Lê as listas guardadas, descartando o que não passar no esquema. */
export function parseMasterConflicts(value: unknown): MasterConflict[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const parsed = masterConflictSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
}
export function parseMasterRefuges(value: unknown): MasterRefuge[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const parsed = masterRefugeSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
}
