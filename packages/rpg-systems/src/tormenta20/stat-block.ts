/**
 * Ficha de ameaça (NPC ou criatura) do Tormenta20, gravada em `creatures.stat_block`.
 */
import { z } from 'zod';
import { T20_ATTRIBUTES, type T20Attribute } from './attributes';

const text = (max: number) => z.string().trim().max(max).default('');
const named = z.object({ name: z.string().trim().min(1).max(200), text: z.string().trim().max(8000).default('') });

export const t20StatBlockSchema = z.object({
  /** Tipo e tamanho ("Monstro Grande", "Humanoide (orc) Médio"). */
  type: text(160),
  /** Nível de desafio ("1/4", "2", "11"). */
  challenge: text(10),
  /** Iniciativa, percepção e sentidos ("+7, Percepção +3, visão no escuro"). */
  senses: text(400),
  initiative: z.number().int().min(-20).max(80).default(0),
  defense: z.number().int().min(0).max(120).default(10),
  /** Resistências e imunidades ("Fort +8, Ref +11, Von +3, redução de dano 5"). */
  defenseNotes: text(600),
  hitPoints: z.number().int().min(0).max(99999).default(1),
  manaPoints: z.number().int().min(0).max(9999).nullable().default(null),
  speed: text(200),
  melee: text(1000),
  ranged: text(1000),
  abilities: z.array(named).max(40).default([]),
  attributes: z
    .object(Object.fromEntries(T20_ATTRIBUTES.map((key) => [key, z.number().int().min(-10).max(30).nullable().default(0)])) as Record<
      T20Attribute,
      z.ZodDefault<z.ZodNullable<z.ZodNumber>>
    >)
    .prefault({}),
  skills: text(600),
  equipment: text(600),
  treasure: text(400),
  description: text(8000),
});

export type T20StatBlock = z.output<typeof t20StatBlockSchema>;

export function createDefaultT20StatBlock(): T20StatBlock {
  return t20StatBlockSchema.parse({});
}

export function parseT20StatBlock(data: unknown): T20StatBlock {
  return t20StatBlockSchema.parse(data ?? {});
}
