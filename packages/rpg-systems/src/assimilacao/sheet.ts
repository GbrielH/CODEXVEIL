/**
 * Ficha de Infectado(a) do Assimilação RPG, gravada como JSON em `characters.sheet`.
 *
 * Só a estrutura e os números vivem no código. Características, Assimilações e equipamentos
 * guardam o nome e as anotações que o jogador escreve (os textos do livro não são reproduzidos).
 */
import { z } from 'zod';

export const ASSIMILACAO_SHEET_VERSION = 1;

export const INSTINCTS = [
  'influencia',
  'percepcao',
  'potencia',
  'reacao',
  'resolucao',
  'sagacidade',
] as const;
export const KNOWLEDGES = [
  'biologia',
  'erudicao',
  'engenharia',
  'geografia',
  'medicina',
  'seguranca',
] as const;
export const PRACTICES = [
  'armas',
  'atletismo',
  'expressao',
  'furtividade',
  'manufaturas',
  'sobrevivencia',
] as const;
export type Instinct = (typeof INSTINCTS)[number];
export type Knowledge = (typeof KNOWLEDGES)[number];
export type Practice = (typeof PRACTICES)[number];
export type Aptitude = Instinct | Knowledge | Practice;

export const aptitudeLabels: Record<Aptitude, string> = {
  influencia: 'Influência',
  percepcao: 'Percepção',
  potencia: 'Potência',
  reacao: 'Reação',
  resolucao: 'Resolução',
  sagacidade: 'Sagacidade',
  biologia: 'Biologia',
  erudicao: 'Erudição',
  engenharia: 'Engenharia',
  geografia: 'Geografia',
  medicina: 'Medicina',
  seguranca: 'Segurança',
  armas: 'Armas',
  atletismo: 'Atletismo',
  expressao: 'Expressão',
  furtividade: 'Furtividade',
  manufaturas: 'Manufaturas',
  sobrevivencia: 'Sobrevivência',
};

export const GENERATIONS = ['pre-colapso', 'colapso', 'pos-colapso'] as const;
export type Generation = (typeof GENERATIONS)[number];
export const generationLabels: Record<Generation, string> = {
  'pre-colapso': 'Geração pré-Colapso',
  colapso: 'Geração-Colapso',
  'pos-colapso': 'Geração pós-Colapso',
};

export const ASSIMILATION_KINDS = ['evolutiva', 'adaptativa', 'inoportuna', 'singular'] as const;
export type AssimilationKind = (typeof ASSIMILATION_KINDS)[number];
export const assimilationKindLabels: Record<AssimilationKind, string> = {
  evolutiva: 'Evolutiva',
  adaptativa: 'Adaptativa',
  inoportuna: 'Inoportuna',
  singular: 'Singular',
};

/** Títulos dos seis Níveis de Saúde, do 6 (saudável) ao 1. */
export const HEALTH_LEVEL_TITLES = [
  'Saudável',
  'Escoriação',
  'Laceração',
  'Ferimentos',
  'Debilitação',
  'Incapacitação',
] as const;

const text = (max: number) => z.string().trim().max(max).default('');
const scores = <T extends string>(keys: readonly T[], min: number, max: number, start: number) =>
  z
    .object(
      Object.fromEntries(
        keys.map((key) => [key, z.number().int().min(min).max(max).default(start)]),
      ) as Record<T, z.ZodDefault<z.ZodNumber>>,
    )
    .prefault({} as never);

const purpose = z.object({ text: text(200), inert: z.boolean().default(false) }).prefault({});

export const assimilacaoSheetSchema = z.object({
  schemaVersion: z.literal(ASSIMILACAO_SHEET_VERSION).default(ASSIMILACAO_SHEET_VERSION),
  identity: z
    .object({
      generation: z.enum(GENERATIONS).nullable().default(null),
      age: text(40),
      appearance: text(8000),
      personality: text(8000),
      backstory: text(20000),
    })
    .prefault({}),
  /** Evento Marcante (passado) e Ocupação (atual): cada uma mantém +1 dado, uma vez por sessão. */
  origins: z
    .object({
      event: text(200),
      occupation: text(200),
      eventUsed: z.boolean().default(false),
      occupationUsed: z.boolean().default(false),
    })
    .prefault({}),
  purposes: z
    .object({
      personal: z
        .array(purpose)
        .max(2)
        .default([
          { text: '', inert: false },
          { text: '', inert: false },
        ]),
      collective: z
        .array(purpose)
        .max(2)
        .default([
          { text: '', inert: false },
          { text: '', inert: false },
        ]),
    })
    .prefault({}),
  instincts: scores(INSTINCTS, 1, 5, 1),
  knowledges: scores(KNOWLEDGES, 0, 5, 0),
  practices: scores(PRACTICES, 0, 5, 0),
  /**
   * Cabo de Guerra: Nível de Determinação (o de Assimilação é 10 menos ele). Os pontos gastos
   * ficam nas trilhas `determinacao` e `assimilacao`; os de Saúde, na trilha `saude`.
   */
  tugOfWar: z
    .object({
      determinationLevel: z.number().int().min(0).max(10).default(9),
      /** Determinação bloqueada até a Assimilação se completar (depois de cair um Nível). */
      locked: z.boolean().default(false),
    })
    .prefault({}),
  experience: z
    .object({
      total: z.number().int().min(0).max(999).default(7),
      spent: z.number().int().min(0).max(999).default(0),
    })
    .prefault({}),
  characteristics: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        cost: z.number().int().min(0).max(10).default(1),
        notes: text(2000),
      }),
    )
    .max(60)
    .default([]),
  assimilations: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        kind: z.enum(ASSIMILATION_KINDS).default('evolutiva'),
        /** Pressões ainda ativas (Inoportunas contam para a perda de consciência). */
        pressures: z.number().int().min(0).max(10).default(0),
        notes: text(2000),
      }),
    )
    .max(60)
    .default([]),
  notes: text(20000),
});

export type AssimilacaoSheet = z.output<typeof assimilacaoSheetSchema>;

export function createDefaultAssimilacaoSheet(): AssimilacaoSheet {
  return assimilacaoSheetSchema.parse({});
}

export function parseAssimilacaoSheet(data: unknown): AssimilacaoSheet {
  return assimilacaoSheetSchema.parse(data ?? {});
}
