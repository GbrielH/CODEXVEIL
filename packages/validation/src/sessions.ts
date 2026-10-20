/**
 * Validação de sessões e blocos de roteiro. Os esquemas de bloco espelham o modelo de
 * `@codexveil/domain` (SessionBlockDataMap); a asserção de tipo no fim do arquivo quebra a
 * compilação se os dois divergirem.
 */
import {
  CALLOUT_TONES,
  CONTENT_REF_KINDS,
  SHARED_VISIBILITIES,
  type SessionBlockContent,
} from '@codexveil/domain';
import { z } from 'zod';
import { optionalText, requiredText, uuidSchema } from './common';

export const sessionCreateSchema = z.object({
  title: requiredText('o título da sessão', 1, 120),
  scheduledAt: z.iso.datetime({ offset: true, error: 'Data inválida.' }).nullable().default(null),
  isPublished: z.boolean().default(false),
  /** Presencial (o mestre escolhe dados físicos ou virtuais) ou online (dados virtuais). */
  mode: z.enum(['presencial', 'online']).default('presencial'),
  /** Dados presenciais: a mesa rola dados físicos e o app não rola nas ações. */
  physicalDice: z.boolean().default(false),
});
export type SessionMode = 'presencial' | 'online';
export type SessionCreateInput = z.input<typeof sessionCreateSchema>;
export type SessionCreate = z.output<typeof sessionCreateSchema>;

export const sessionUpdateSchema = sessionCreateSchema.extend({
  recap: optionalText(20000),
});
export type SessionUpdate = z.output<typeof sessionUpdateSchema>;

const blockText = z.string().max(20000, 'Texto longo demais para um único bloco.');
const shortNote = z.string().trim().max(500).nullable();

const blockSchemas = [
  z.object({ type: z.literal('paragraph'), data: z.object({ text: blockText }) }),
  z.object({ type: z.literal('heading'), data: z.object({ text: z.string().max(200) }) }),
  z.object({ type: z.literal('subheading'), data: z.object({ text: z.string().max(200) }) }),
  z.object({
    type: z.literal('callout'),
    data: z.object({
      tone: z.enum(CALLOUT_TONES),
      title: z.string().max(200).nullable(),
      text: blockText,
    }),
  }),
  z.object({ type: z.literal('gm_note'), data: z.object({ text: blockText }) }),
  z.object({
    type: z.literal('image'),
    data: z.object({
      path: z.string().max(500),
      alt: z.string().max(300),
      caption: z.string().max(500).nullable(),
    }),
  }),
  z.object({ type: z.literal('divider'), data: z.object({}).strict() }),
  z.object({
    type: z.literal('list'),
    data: z.object({
      style: z.enum(['bulleted', 'numbered']),
      items: z.array(z.string().max(2000)).max(200),
    }),
  }),
  z.object({
    type: z.literal('checklist'),
    data: z.object({
      items: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            text: z.string().max(2000),
            checked: z.boolean(),
          }),
        )
        .max(200),
    }),
  }),
  z.object({
    type: z.literal('npc_ref'),
    data: z.object({ creatureId: z.union([uuidSchema, z.literal('')]), note: shortNote }),
  }),
  z.object({
    type: z.literal('monster_ref'),
    data: z.object({ creatureId: z.union([uuidSchema, z.literal('')]), note: shortNote }),
  }),
  z.object({
    type: z.literal('character_ref'),
    data: z.object({ characterId: z.union([uuidSchema, z.literal('')]), note: shortNote }),
  }),
  z.object({
    type: z.literal('content_ref'),
    data: z.object({
      kind: z.enum(CONTENT_REF_KINDS),
      targetId: z.union([uuidSchema, z.literal('')]),
      note: shortNote,
    }),
  }),
] as const;

export const sessionBlockContentSchema = z.discriminatedUnion('type', blockSchemas);

export const sessionBlockSchema = z
  .object({
    visibility: z.enum(SHARED_VISIBILITIES),
    content: sessionBlockContentSchema,
  })
  .refine((block) => block.content.type !== 'gm_note' || block.visibility === 'gm', {
    path: ['visibility'],
    message: 'Notas privadas do mestre não podem ficar visíveis aos jogadores.',
  });

// Garante em tempo de compilação que o esquema e o modelo do domínio são equivalentes.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const blockModelMatchesSchema: Equals<z.output<typeof sessionBlockContentSchema>, SessionBlockContent> =
  true;
void blockModelMatchesSchema;
