import { z } from 'zod';
import { TRIANGLE_QUALITIES } from '../sheet';

export const TRIANGLE_BOOK_PACK_FORMAT = 'codexveil.triangle-agency.book';
export const TRIANGLE_BOOK_PACK_VERSION = 1;
export const TRIANGLE_BOOK_ENTRY_KINDS = [
  'section',
  'arc_anomaly',
  'arc_reality',
  'arc_competency',
  'anomalous_ability',
  'requisition',
  'locked_document',
] as const;
export type TriangleBookEntryKind = (typeof TRIANGLE_BOOK_ENTRY_KINDS)[number];

export const triangleBookEntryKindLabels: Record<
  TriangleBookEntryKind,
  { one: string; many: string }
> = {
  section: { one: 'Página', many: 'Livro completo' },
  arc_anomaly: { one: 'Anomalia', many: 'Anomalias' },
  arc_reality: { one: 'Realidade', many: 'Realidades' },
  arc_competency: { one: 'Competência', many: 'Competências' },
  anomalous_ability: { one: 'Habilidade Anômala', many: 'Habilidades Anômalas' },
  requisition: { one: 'Requisição', many: 'Requisições' },
  locked_document: { one: 'Documento Bloqueado', many: 'Documentos Bloqueados' },
};

export const TRIANGLE_PLAYER_BOOK_KINDS = [
  'arc_anomaly',
  'arc_reality',
  'arc_competency',
  'anomalous_ability',
  'requisition',
] as const satisfies readonly TriangleBookEntryKind[];

const text = (max: number) => z.string().trim().max(max).default('');
const page = z.number().int().min(0).max(1000).default(0);
export const triangleBookEntryDataSchemas = {
  section: z.object({
    chapter: text(160),
    order: z.number().int().min(0).max(10000),
    page,
    body: text(60000),
  }),
  arc_anomaly: z.object({ page, body: text(20000) }),
  arc_reality: z.object({
    page,
    trigger: text(6000),
    burnoutRelief: text(6000),
    body: text(20000),
  }),
  arc_competency: z.object({
    page,
    primaryDirective: text(6000),
    sanctionedBehaviors: z.array(z.string().max(2000)).max(20).default([]),
    initialRequisition: text(6000),
    body: text(20000),
  }),
  anomalous_ability: z.object({
    page,
    anomaly: text(120),
    quality: z.enum(TRIANGLE_QUALITIES).nullable().default(null),
    body: text(12000),
  }),
  requisition: z.object({
    page,
    costs: z
      .array(z.object({ label: text(160), merits: z.number().int().min(0).max(9999) }))
      .max(20)
      .default([]),
    body: text(12000),
  }),
  locked_document: z.object({ page, code: text(40), body: text(30000) }),
} as const satisfies Record<TriangleBookEntryKind, z.ZodType>;

export type TriangleBookEntryData<K extends TriangleBookEntryKind> = z.output<
  (typeof triangleBookEntryDataSchemas)[K]
>;
export interface TriangleBookEntry<K extends TriangleBookEntryKind = TriangleBookEntryKind> {
  kind: K;
  key: string;
  name: string;
  data: TriangleBookEntryData<K>;
}

const bookKey = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const triangleBookInfoSchema = z.object({
  id: bookKey,
  name: z.string().trim().min(1).max(120),
  category: z.enum(['core', 'player', 'monsters', 'gm', 'setting', 'adventure']),
  edition: text(80),
  origin: text(300),
});

export interface TriangleBookPack {
  format: typeof TRIANGLE_BOOK_PACK_FORMAT;
  version: typeof TRIANGLE_BOOK_PACK_VERSION;
  book: z.output<typeof triangleBookInfoSchema>;
  entries: TriangleBookEntry[];
}

export function parseTriangleBookPack(input: unknown): {
  pack: TriangleBookPack;
  issues: { index: number; kind?: string; key?: string; message: string }[];
} {
  const header = z
    .object({
      format: z.literal(TRIANGLE_BOOK_PACK_FORMAT),
      version: z.literal(TRIANGLE_BOOK_PACK_VERSION),
      book: triangleBookInfoSchema,
      entries: z.array(z.unknown()).max(3000),
    })
    .parse(input);
  const baseSchema = z.object({
    kind: z.enum(TRIANGLE_BOOK_ENTRY_KINDS),
    key: bookKey,
    name: z.string().trim().min(1).max(200),
    data: z.unknown(),
  });
  const issues: { index: number; kind?: string; key?: string; message: string }[] = [];
  const entries: TriangleBookEntry[] = [];
  const seen = new Set<string>();
  header.entries.forEach((item, index) => {
    const base = baseSchema.safeParse(item);
    if (!base.success) {
      issues.push({ index, message: base.error.issues[0]?.message ?? 'Entrada inválida.' });
      return;
    }
    const { kind, key, name } = base.data;
    if (seen.has(`${kind}:${key}`)) {
      issues.push({ index, kind, key, message: 'Entrada repetida.' });
      return;
    }
    const data = triangleBookEntryDataSchemas[kind].safeParse(base.data.data);
    if (!data.success) {
      const issue = data.error.issues[0];
      issues.push({
        index,
        kind,
        key,
        message: `${issue?.path.join('.') || 'dados'}: ${issue?.message ?? 'inválido'}`,
      });
      return;
    }
    seen.add(`${kind}:${key}`);
    entries.push({ kind, key, name, data: data.data });
  });
  return {
    pack: {
      format: TRIANGLE_BOOK_PACK_FORMAT,
      version: TRIANGLE_BOOK_PACK_VERSION,
      book: header.book,
      entries,
    },
    issues,
  };
}
