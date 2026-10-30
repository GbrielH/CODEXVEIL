/**
 * Pacote de livro do Assimilação RPG (`codexveil.assimilacao.book`): o texto do exemplar do
 * usuário (regras, cenário, Características, cartas de Assimilação e de Eventos, Artefatos),
 * gerado por `scripts/books/assimilacao.py` + `assimilacao_pack.py` e importado em "Meus livros".
 * Nada disto fica no código do app; aqui só os esquemas que validam o pacote.
 *
 * Os textos usam marcadores para os ícones do jogo ({A} Sucesso, {B} Adaptação, {C} Pressão,
 * {d}/{e}/{s} pontos, {D}/{E}/{S} níveis, {6}/{1}/{2} dados, {F}–{I} naipes, {P} penalidade).
 */
import { z } from 'zod';
import { ASSIMILATION_KINDS } from '../sheet';

export const ASSIMILACAO_BOOK_PACK_FORMAT = 'codexveil.assimilacao.book';
export const ASSIMILACAO_BOOK_PACK_VERSION = 1;

/** Tipos de entrada (os nomes coincidem com `book_entries.kind`). */
export const ASSIMILACAO_BOOK_ENTRY_KINDS = [
  'section',
  'characteristic',
  'assimilation',
  'artifact',
  'event',
] as const;
export type AssimilacaoBookEntryKind = (typeof ASSIMILACAO_BOOK_ENTRY_KINDS)[number];

export const assimilacaoBookEntryKindLabels: Record<
  AssimilacaoBookEntryKind,
  { one: string; many: string }
> = {
  section: { one: 'Texto', many: 'Texto' },
  characteristic: { one: 'Característica', many: 'Características' },
  assimilation: { one: 'Assimilação', many: 'Assimilações' },
  artifact: { one: 'Artefato', many: 'Artefatos' },
  event: { one: 'Evento', many: 'Eventos' },
};

/** Tipos que os jogadores consultam (os Eventos são do Assimilador). */
export const ASSIMILACAO_PLAYER_BOOK_KINDS = [
  'characteristic',
  'assimilation',
  'artifact',
] as const satisfies readonly AssimilacaoBookEntryKind[];

const text = (max: number) => z.string().trim().max(max).default('');
export const CARD_RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;
export const CARD_SUITS = ['F', 'G', 'H', 'I'] as const;
const cost = z
  .object({
    A: z.number().int().min(0).max(12).default(0),
    B: z.number().int().min(0).max(12).default(0),
    C: z.number().int().min(0).max(12).default(0),
  })
  .prefault({});

export const assimilacaoSectionSchema = z.object({
  chapter: text(160),
  order: z.number().int().min(0).max(100000).default(0),
  page: z.number().int().min(0).max(1000).default(0),
  body: text(60000),
});

export const assimilacaoCharacteristicSchema = z.object({
  cost: z.number().int().min(1).max(10),
  requirement: text(300),
  text: text(4000),
  page: z.number().int().min(0).max(1000).default(0),
});

export const assimilacaoCardSchema = z.object({
  kind: z.enum(ASSIMILATION_KINDS),
  rank: z.enum(CARD_RANKS),
  suit: z.enum(CARD_SUITS),
  text: text(4000),
  page: z.number().int().min(0).max(1000).default(0),
  levels: z
    .array(
      z.object({
        cost,
        name: z.string().trim().min(1).max(120),
        requirement: text(120),
        text: text(4000),
      }),
    )
    .max(10)
    .default([]),
});

export const assimilacaoArtifactSchema = z.object({
  scarcity: z.number().int().min(-5).max(20),
  text: text(4000),
  page: z.number().int().min(0).max(1000).default(0),
});

export const assimilacaoEventSchema = z.object({
  category: text(120),
  rank: z.enum(CARD_RANKS),
  suit: z.enum(CARD_SUITS),
  text: text(4000),
  page: z.number().int().min(0).max(1000).default(0),
});

export const assimilacaoBookEntryDataSchemas = {
  section: assimilacaoSectionSchema,
  characteristic: assimilacaoCharacteristicSchema,
  assimilation: assimilacaoCardSchema,
  artifact: assimilacaoArtifactSchema,
  event: assimilacaoEventSchema,
} as const satisfies Record<AssimilacaoBookEntryKind, z.ZodType>;

export type AssimilacaoBookEntryData<K extends AssimilacaoBookEntryKind> = z.output<
  (typeof assimilacaoBookEntryDataSchemas)[K]
>;

export interface AssimilacaoBookEntry<
  K extends AssimilacaoBookEntryKind = AssimilacaoBookEntryKind,
> {
  kind: K;
  key: string;
  name: string;
  data: AssimilacaoBookEntryData<K>;
}

const bookKey = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífens.');

export const assimilacaoBookInfoSchema = z.object({
  id: bookKey,
  name: z.string().trim().min(1).max(120),
  category: z.enum(['core', 'player', 'monsters', 'gm', 'setting', 'adventure']),
  edition: text(40),
  origin: text(300),
});

export interface AssimilacaoBookPack {
  format: typeof ASSIMILACAO_BOOK_PACK_FORMAT;
  version: typeof ASSIMILACAO_BOOK_PACK_VERSION;
  book: z.output<typeof assimilacaoBookInfoSchema>;
  entries: AssimilacaoBookEntry[];
}

export const ASSIMILACAO_MAX_BOOK_ENTRIES = 2000;

/** Valida um pacote; entradas inválidas ficam de fora e voltam em `issues`. */
export function parseAssimilacaoBookPack(input: unknown): {
  pack: AssimilacaoBookPack;
  issues: { index: number; kind?: string; key?: string; message: string }[];
} {
  const header = z
    .object({
      format: z.literal(ASSIMILACAO_BOOK_PACK_FORMAT, {
        error: 'Este arquivo não é um pacote de livro do Assimilação RPG.',
      }),
      version: z.literal(ASSIMILACAO_BOOK_PACK_VERSION, {
        error: 'Versão de pacote não suportada.',
      }),
      book: assimilacaoBookInfoSchema,
      entries: z.array(z.unknown()).max(ASSIMILACAO_MAX_BOOK_ENTRIES),
    })
    .parse(input);
  const raw = z.object({
    kind: z.enum(ASSIMILACAO_BOOK_ENTRY_KINDS),
    key: bookKey,
    name: z.string().trim().min(1).max(200),
    data: z.unknown(),
  });
  const issues: { index: number; kind?: string; key?: string; message: string }[] = [];
  const entries: AssimilacaoBookEntry[] = [];
  const seen = new Set<string>();
  header.entries.forEach((item, index) => {
    const base = raw.safeParse(item);
    if (!base.success) {
      issues.push({ index, message: base.error.issues[0]?.message ?? 'Entrada inválida.' });
      return;
    }
    const { kind, key, name } = base.data;
    if (seen.has(`${kind}:${key}`)) {
      issues.push({ index, kind, key, message: 'Entrada repetida.' });
      return;
    }
    const data = assimilacaoBookEntryDataSchemas[kind].safeParse(base.data.data);
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
      format: ASSIMILACAO_BOOK_PACK_FORMAT,
      version: ASSIMILACAO_BOOK_PACK_VERSION,
      book: header.book,
      entries,
    },
    issues,
  };
}

/** Lê o conteúdo salvo no banco sem lançar: `null` se a entrada não for válida. */
export function safeAssimilacaoBookEntryData<K extends AssimilacaoBookEntryKind>(
  kind: K,
  data: unknown,
): AssimilacaoBookEntryData<K> | null {
  const parsed = assimilacaoBookEntryDataSchemas[kind].safeParse(data);
  return parsed.success ? (parsed.data as AssimilacaoBookEntryData<K>) : null;
}
