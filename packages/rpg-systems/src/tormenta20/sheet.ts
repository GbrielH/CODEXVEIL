/**
 * Ficha de personagem do Tormenta20, gravada como JSON em `characters.sheet`.
 *
 * Raça, classes, origem, divindade, poderes e magias guardam o nome (para exibir) e a chave do
 * conteúdo do livro (`livro:chave`), que liga a ficha às regras do pacote importado. Habilidades,
 * poderes e magias também viram linhas em `character_abilities` com o texto completo.
 */
import { z } from 'zod';
import { T20_ATTRIBUTES, type T20Attribute } from './attributes';
import { T20_SKILL_IDS, type T20Skill } from './skills';

export const T20_SHEET_VERSION = 1;
export const T20_MIN_LEVEL = 1;
export const T20_MAX_LEVEL = 20;

export const T20_SIZES = ['minusculo', 'pequeno', 'medio', 'grande', 'enorme', 'colossal'] as const;
export type T20Size = (typeof T20_SIZES)[number];

export const t20SizeLabels: Record<T20Size, string> = {
  minusculo: 'Minúsculo',
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
  enorme: 'Enorme',
  colossal: 'Colossal',
};

export const T20_WEAPON_PROFICIENCIES = ['simples', 'marciais', 'exoticas', 'fogo'] as const;
export const T20_ARMOR_PROFICIENCIES = ['leves', 'pesadas', 'escudos'] as const;

const text = (max: number) => z.string().trim().max(max).default('');
const entityKey = z.string().trim().max(120).default('');
const attributeRecord = z
  .object(
    Object.fromEntries(
      T20_ATTRIBUTES.map((key) => [key, z.number().int().min(-10).max(20).default(0)]),
    ) as Record<T20Attribute, z.ZodDefault<z.ZodNumber>>,
  )
  .prefault({});

const namedRef = z.object({
  key: entityKey,
  name: z.string().trim().min(1).max(200),
  source: text(200),
});

export const t20SheetSchema = z.object({
  schemaVersion: z.literal(T20_SHEET_VERSION).default(T20_SHEET_VERSION),
  identity: z
    .object({
      race: text(120),
      raceKey: entityKey,
      /** Variante da raça (Suraggel: aggelus ou sulfure). */
      raceVariant: text(80),
      origin: text(120),
      originKey: entityKey,
      deity: text(120),
      deityKey: entityKey,
      classes: z
        .array(
          z.object({
            key: entityKey,
            name: z.string().trim().min(1).max(120),
            level: z.number().int().min(1).max(20),
          }),
        )
        .max(6)
        .default([]),
      xp: z.number().int().min(0).max(10_000_000).default(0),
      size: z.enum(T20_SIZES).default('medio'),
      /** Deslocamento em metros. */
      speed: z.number().min(0).max(120).default(9),
      height: text(40),
      appearance: text(4000),
      personality: text(4000),
      history: text(8000),
      notes: text(8000),
      /** Livros usados na criação (ids dos livros). */
      sourcebooks: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
    })
    .prefault({}),
  /** Valor final de cada atributo (já com raça, poderes e itens permanentes). */
  attributes: attributeRecord,
  skills: z
    .object({
      trained: z
        .array(z.enum(T20_SKILL_IDS as [T20Skill, ...T20Skill[]]))
        .max(29)
        .default([]),
      /** Bônus fixos por perícia (poderes, itens, raça). */
      bonuses: z.record(z.string(), z.number().int().min(-20).max(40)).default({}),
      /** Especialidades de Ofício treinadas (alquimista, ferreiro…). */
      crafts: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    })
    .prefault({}),
  hitPoints: z.object({ max: z.number().int().min(1).max(9999).default(1) }).prefault({}),
  manaPoints: z.object({ max: z.number().int().min(0).max(9999).default(0) }).prefault({}),
  defense: z
    .object({
      /** Bônus de armadura e escudo equipados (vêm do inventário quando possível). */
      armor: z.number().int().min(0).max(40).default(0),
      shield: z.number().int().min(0).max(20).default(0),
      other: z.number().int().min(-20).max(40).default(0),
      /** Algumas armaduras pesadas não somam a Destreza. */
      useDexterity: z.boolean().default(true),
      armorPenalty: z.number().int().min(-20).max(0).default(0),
    })
    .prefault({}),
  proficiencies: z
    .object({
      weapons: z.array(z.enum(T20_WEAPON_PROFICIENCIES)).max(4).default(['simples']),
      armors: z.array(z.enum(T20_ARMOR_PROFICIENCIES)).max(3).default(['leves']),
      other: text(500),
    })
    .prefault({}),
  powers: z
    .array(
      namedRef.extend({
        level: z.number().int().min(1).max(20).default(1),
        /** Aumento de Atributo: qual atributo subiu. */ attribute: z
          .enum(T20_ATTRIBUTES)
          .optional(),
      }),
    )
    .max(120)
    .default([]),
  spells: z
    .object({
      /** Atributo-chave das magias (Int para magos, Sab para clérigos…). */
      attribute: z.enum(T20_ATTRIBUTES).nullable().default(null),
      known: z
        .array(
          namedRef.extend({
            circle: z.number().int().min(1).max(5),
            type: z.enum(['arcana', 'divina', 'universal']),
          }),
        )
        .max(200)
        .default([]),
    })
    .prefault({}),
});

export type T20Sheet = z.output<typeof t20SheetSchema>;
export type T20SheetInput = z.input<typeof t20SheetSchema>;

export function createDefaultT20Sheet(): T20Sheet {
  return t20SheetSchema.parse({});
}

export function parseT20Sheet(data: unknown): T20Sheet {
  if (data && typeof data === 'object') {
    const version = (data as { schemaVersion?: unknown }).schemaVersion;
    if (version !== undefined && version !== T20_SHEET_VERSION) {
      throw new RangeError(`Versão de ficha Tormenta20 não suportada: ${JSON.stringify(version)}.`);
    }
  }
  return t20SheetSchema.parse(data ?? {});
}

/** Nível do personagem: soma dos níveis de classe, entre 1 e 20. */
export function t20Level(sheet: Pick<T20Sheet, 'identity'>): number {
  const sum = sheet.identity.classes.reduce((total, entry) => total + entry.level, 0);
  return Math.min(Math.max(sum, T20_MIN_LEVEL), T20_MAX_LEVEL);
}
