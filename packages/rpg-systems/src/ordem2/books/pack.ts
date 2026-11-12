/**
 * Pacote de livro do Ordem Paranormal RPG 2 (playtests). Gerado do PDF do próprio usuário por
 * `scripts/books/ordem2.py`; nunca vai para o repositório.
 *
 * O texto para jogadores fica em `section` (introdução, ficha, regras) e `tool` (ferramentas da
 * Ordo Realitas). Missões, cenas, pontos de interesse, criaturas, mapas e imagens são do mestre.
 * As imagens viajam em `assets` (base64) e, na importação, vão para o bucket privado
 * `book-assets`; as entradas as citam pela chave.
 */
import { z } from 'zod';
import { ordem2StatBlockSchema } from '../system';

export const ORDEM2_BOOK_PACK_FORMAT = 'codexveil.ordem2.book';
export const ORDEM2_BOOK_PACK_VERSION = 1;

export const ORDEM2_BOOK_ENTRY_KINDS = [
  'section',
  'tool',
  'mission',
  'scene',
  'point_of_interest',
  'creature',
  'map',
  'handout',
] as const;
export type Ordem2BookEntryKind = (typeof ORDEM2_BOOK_ENTRY_KINDS)[number];

export const ordem2BookEntryKindLabels: Record<Ordem2BookEntryKind, { one: string; many: string }> =
  {
    section: { one: 'Página', many: 'Livro completo' },
    tool: { one: 'Ferramenta', many: 'Ferramentas da Ordem' },
    mission: { one: 'Missão', many: 'Missões' },
    scene: { one: 'Cena', many: 'Cenas' },
    point_of_interest: { one: 'Ponto de interesse', many: 'Pontos de interesse' },
    creature: { one: 'Criatura', many: 'Criaturas e NPCs' },
    map: { one: 'Mapa', many: 'Mapas' },
    handout: { one: 'Imagem', many: 'Imagens e handouts' },
  };

/** Entradas que os jogadores da campanha leem; o resto é só do mestre. */
export const ORDEM2_PLAYER_BOOK_KINDS = ['tool'] as const satisfies readonly Ordem2BookEntryKind[];

const text = (max: number) => z.string().trim().max(max).default('');
const page = z.number().int().min(0).max(1000).default(0);
const assetKey = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const entryKey = assetKey;

export const ordem2PoiRowSchema = z.object({
  /** Perícia como o livro escreve ("Percepção", "Aptidão (artes)", "Medicina ou Sobrevivência"). */
  skill: z.string().trim().min(1).max(160),
  /** Chaves das perícias citadas (para conferir a ficha). */
  skillKeys: z.array(z.string().trim().max(40)).max(6).default([]),
  dc: z.number().int().min(0).max(40),
  text: z.string().trim().min(1).max(4000),
  /** Restrição ("apenas Victor", "requer ter destrancado o freezer"). */
  requirement: text(400),
});
export type Ordem2PoiRow = z.output<typeof ordem2PoiRowSchema>;

export const ordem2BookEntryDataSchemas = {
  section: z.object({
    chapter: text(160),
    order: z.number().int().min(0).max(10000),
    page,
    body: text(60000),
  }),
  tool: z.object({
    page,
    body: text(12000),
    mechanics: text(12000),
    image: assetKey.nullable().default(null),
  }),
  mission: z.object({
    page,
    order: z.number().int().min(0).max(100).default(0),
    /** Resumo para o mestre (preparação, vitória e derrota, o que aconteceu). */
    summary: text(20000),
    /** Texto completo que não pertence a uma cena (preparação, epílogo, bastidores). */
    body: text(60000),
    scenes: z.array(entryKey).max(40).default([]),
  }),
  scene: z.object({
    page,
    mission: entryKey,
    order: z.number().int().min(0).max(100).default(0),
    /** Texto de leitura para os jogadores (narração em voz alta). */
    readAloud: text(20000),
    /** Roteiro do mestre: regras da cena, rodadas, eventos. */
    body: text(60000),
    pointsOfInterest: z.array(entryKey).max(80).default([]),
    creatures: z.array(entryKey).max(40).default([]),
    maps: z.array(entryKey).max(10).default([]),
  }),
  point_of_interest: z.object({
    page,
    mission: entryKey,
    scene: entryKey.nullable().default(null),
    /** Descrição básica, narrada a quem investiga. */
    description: text(4000),
    rows: z.array(ordem2PoiRowSchema).max(40).default([]),
    /** Descrição contextual: só o mestre lê. */
    context: text(20000),
    /** Número no mapa da cena, quando houver. */
    mapLabel: text(20),
    keyEvidence: z.boolean().default(false),
    image: assetKey.nullable().default(null),
  }),
  creature: z.object({
    page,
    mission: entryKey.nullable().default(null),
    stats: ordem2StatBlockSchema,
    image: assetKey.nullable().default(null),
  }),
  map: z.object({
    page,
    mission: entryKey.nullable().default(null),
    image: assetKey,
    /** Legenda dos números do mapa. */
    legend: text(4000),
  }),
  handout: z.object({
    page,
    mission: entryKey.nullable().default(null),
    image: assetKey,
    caption: text(4000),
  }),
} as const satisfies Record<Ordem2BookEntryKind, z.ZodType>;

export type Ordem2BookEntryData<K extends Ordem2BookEntryKind> = z.output<
  (typeof ordem2BookEntryDataSchemas)[K]
>;
export interface Ordem2BookEntry<K extends Ordem2BookEntryKind = Ordem2BookEntryKind> {
  kind: K;
  key: string;
  name: string;
  data: Ordem2BookEntryData<K>;
}

export const ORDEM2_ASSET_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ordem2BookAssetSchema = z.object({
  key: assetKey,
  mime: z.enum(ORDEM2_ASSET_MIME),
  /** Conteúdo em base64 (sem o prefixo `data:`); até ~10 MB por imagem. */
  data: z.string().min(16).max(14_000_000),
});
export type Ordem2BookAsset = z.output<typeof ordem2BookAssetSchema>;

const bookKey = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const ordem2BookInfoSchema = z.object({
  id: bookKey,
  name: z.string().trim().min(1).max(120),
  category: z.enum(['core', 'player', 'monsters', 'gm', 'setting', 'adventure']),
  /** O banco aceita até 40 caracteres. */
  edition: text(40),
  origin: text(300),
});

export interface Ordem2BookPack {
  format: typeof ORDEM2_BOOK_PACK_FORMAT;
  version: typeof ORDEM2_BOOK_PACK_VERSION;
  book: z.output<typeof ordem2BookInfoSchema>;
  entries: Ordem2BookEntry[];
  assets: Ordem2BookAsset[];
}

export interface Ordem2PackIssue {
  index: number;
  kind?: string;
  key?: string;
  message: string;
}

export function parseOrdem2BookPack(input: unknown): {
  pack: Ordem2BookPack;
  issues: Ordem2PackIssue[];
} {
  const header = z
    .object({
      format: z.literal(ORDEM2_BOOK_PACK_FORMAT),
      version: z.literal(ORDEM2_BOOK_PACK_VERSION),
      book: ordem2BookInfoSchema,
      entries: z.array(z.unknown()).max(3000),
      assets: z.array(z.unknown()).max(300).default([]),
    })
    .parse(input);
  const baseSchema = z.object({
    kind: z.enum(ORDEM2_BOOK_ENTRY_KINDS),
    key: entryKey.min(1),
    name: z.string().trim().min(1).max(200),
    data: z.unknown(),
  });
  const issues: Ordem2PackIssue[] = [];
  const entries: Ordem2BookEntry[] = [];
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
    const data = ordem2BookEntryDataSchemas[kind].safeParse(base.data.data);
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
  const assets: Ordem2BookAsset[] = [];
  const assetKeys = new Set<string>();
  header.assets.forEach((item, index) => {
    const parsed = ordem2BookAssetSchema.safeParse(item);
    if (!parsed.success || assetKeys.has(parsed.data.key)) {
      issues.push({
        index,
        kind: 'asset',
        message: parsed.success ? 'Imagem repetida.' : 'Imagem inválida.',
      });
      return;
    }
    assetKeys.add(parsed.data.key);
    assets.push(parsed.data);
  });
  return {
    pack: {
      format: ORDEM2_BOOK_PACK_FORMAT,
      version: ORDEM2_BOOK_PACK_VERSION,
      book: header.book,
      entries,
      assets,
    },
    issues,
  };
}

/** Extensão do arquivo de uma imagem do pacote. */
export function ordem2AssetExtension(mime: (typeof ORDEM2_ASSET_MIME)[number]): string {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}

/** Caminho da imagem no bucket `book-assets`: `{livro}/{chave}.{ext}`. */
export function ordem2AssetPath(
  packId: string,
  key: string,
  mime: (typeof ORDEM2_ASSET_MIME)[number],
): string {
  return `${packId}/${key}.${ordem2AssetExtension(mime)}`;
}

/** Chaves de imagem citadas por uma entrada. */
export function ordem2EntryImages(entry: Ordem2BookEntry): string[] {
  const data = entry.data as { image?: string | null };
  return data.image ? [data.image] : [];
}
