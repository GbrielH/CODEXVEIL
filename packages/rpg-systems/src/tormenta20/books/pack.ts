/**
 * Pacote de livro do Tormenta20 (`codexveil.tormenta20.book`): o conteúdo do exemplar do
 * usuário (raças, classes, origens, poderes, magias, deuses, equipamento, itens mágicos e
 * ameaças), gerado por `scripts/books/t20.py` e importado em "Meus livros". Nada disto fica no
 * código do app; aqui só os esquemas que validam o pacote.
 */
import { z } from 'zod';
import { T20_ATTRIBUTES } from '../attributes';
import { T20_SKILL_IDS, type T20Skill } from '../skills';
import { T20_SIZES } from '../sheet';
import { t20StatBlockSchema } from '../stat-block';

export const T20_BOOK_PACK_FORMAT = 'codexveil.tormenta20.book';
export const T20_BOOK_PACK_VERSION = 1;

/** Tipos de entrada (os nomes coincidem com `book_entries.kind`). */
export const T20_BOOK_ENTRY_KINDS = [
  'section',
  'class',
  'species',
  'background',
  'feat',
  'spell',
  'deity',
  'equipment',
  'magic_item',
  'monster',
] as const;
export type T20BookEntryKind = (typeof T20_BOOK_ENTRY_KINDS)[number];

export const t20BookEntryKindLabels: Record<T20BookEntryKind, { one: string; many: string }> = {
  section: { one: 'Texto', many: 'Texto' },
  class: { one: 'Classe', many: 'Classes' },
  species: { one: 'Raça', many: 'Raças' },
  background: { one: 'Origem', many: 'Origens' },
  feat: { one: 'Poder', many: 'Poderes' },
  spell: { one: 'Magia', many: 'Magias' },
  deity: { one: 'Divindade', many: 'Divindades' },
  equipment: { one: 'Equipamento', many: 'Equipamento' },
  magic_item: { one: 'Item mágico', many: 'Itens mágicos' },
  monster: { one: 'Ameaça', many: 'Ameaças' },
};

/** Tipos usados na criação e na subida de nível. */
export const T20_CHARACTER_BOOK_KINDS = ['class', 'species', 'background', 'feat', 'spell', 'deity', 'equipment'] as const satisfies readonly T20BookEntryKind[];

const text = (max: number) => z.string().trim().max(max).default('');
const skill = z.enum(T20_SKILL_IDS as [T20Skill, ...T20Skill[]]);
const attribute = z.enum(T20_ATTRIBUTES);
const named = z.object({ name: z.string().trim().min(1).max(200), text: z.string().trim().max(8000).default('') });

export const t20RaceSchema = z.object({
  summary: text(4000),
  /** Modificadores fixos ({ con: 2, sab: 1, des: -1 }). */
  attributes: z.partialRecord(attribute, z.number().int().min(-4).max(4)).default({}),
  /** "+1 em três atributos diferentes (exceto Car)". */
  attributeChoice: z
    .object({ count: z.number().int().min(1).max(6), value: z.number().int().min(1).max(2), exclude: z.array(attribute).max(5).default([]) })
    .optional(),
  /** Variantes com atributos próprios (Suraggel: aggelus e sulfure). */
  variants: z
    .array(z.object({ name: z.string().trim().min(1).max(80), attributes: z.partialRecord(attribute, z.number().int().min(-4).max(4)).default({}) }))
    .max(6)
    .default([]),
  size: z.enum(T20_SIZES).default('medio'),
  /** Deslocamento em metros. */
  speed: z.number().min(0).max(30).default(9),
  abilities: z.array(named).max(30).default([]),
});

export const t20ClassSchema = z.object({
  summary: text(6000),
  pvInitial: z.number().int().min(1).max(60),
  pvPerLevel: z.number().int().min(1).max(20),
  pmPerLevel: z.number().int().min(0).max(20),
  skillsFixed: z.array(skill).max(8).default([]),
  /** Perícias fixas com alternativa ("Luta ou Pontaria"). */
  skillsFixedChoices: z.array(z.array(skill).min(2).max(4)).max(4).default([]),
  skillsChoice: z.object({ count: z.number().int().min(0).max(12), options: z.array(skill).max(29) }).default({ count: 0, options: [] }),
  proficiencies: z
    .object({
      weapons: z.array(z.enum(['simples', 'marciais', 'exoticas', 'fogo'])).max(4).default(['simples']),
      armors: z.array(z.enum(['leves', 'pesadas', 'escudos'])).max(3).default(['leves']),
      text: text(400),
    })
    .prefault({}),
  /** Habilidades por nível ("Poder de X" marca o nível em que se escolhe um poder da classe). */
  abilities: z
    .array(named.extend({ level: z.number().int().min(1).max(20), options: z.array(named).max(40).default([]) }))
    .max(60)
    .default([]),
  /** Tabela da classe: o que se ganha em cada nível. */
  table: z.record(z.string(), z.string().trim().max(300)).default({}),
  powers: z.array(named.extend({ prerequisite: text(400) })).max(80).default([]),
  /** Seções extras (Linhagens, Forma Selvagem, Engenhocas, Golpe Pessoal…). */
  sections: z.array(z.object({ title: z.string().trim().min(1).max(160), text: text(20000), entries: z.array(named).max(60).default([]) })).max(10).default([]),
  spellcasting: z
    .object({
      type: z.enum(['arcana', 'divina', 'universal']),
      attribute,
      /** Nível de classe em que cada círculo é liberado ({ 1: 1, 2: 5, … }). */
      circles: z.record(z.string(), z.number().int().min(1).max(20)).default({}),
      /** Magias conhecidas no 1º nível. */
      initial: z.number().int().min(0).max(10).default(0),
      /** Aprende uma magia a cada N níveis (1 = todo nível; 2 = níveis pares). */
      learnEvery: z.number().int().min(1).max(4).default(1),
      /** Escolas de magia escolhidas na criação (Bardo e Druida: 3); 0 = todas. */
      schoolsChoice: z.number().int().min(0).max(8).default(0),
      /** Soma o atributo-chave ao total de PM. */
      addsAttributeToPm: z.boolean().default(true),
    })
    .optional(),
});

export const t20OriginSchema = z.object({
  summary: text(4000),
  items: text(1000),
  /** Texto dos benefícios (perícias e poderes que a origem oferece). */
  benefitsText: text(1000),
  benefitSkills: z.array(skill).max(10).default([]),
  benefitPowers: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  uniquePowers: z.array(named).max(4).default([]),
});

export const T20_POWER_GROUPS = ['combate', 'destino', 'magia', 'concedidos', 'tormenta', 'classe', 'origem', 'raca'] as const;

export const t20PowerSchema = z.object({
  group: z.enum(T20_POWER_GROUPS),
  /** Classe dona do poder (para `classe`) ou divindades que o concedem (para `concedidos`). */
  owners: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  text: z.string().trim().max(8000),
  prerequisite: text(400),
});

export const t20SpellSchema = z.object({
  type: z.enum(['arcana', 'divina', 'universal']),
  circle: z.number().int().min(1).max(5),
  school: text(40),
  execution: text(120),
  range: text(120),
  target: text(200),
  area: text(200),
  effect: text(200),
  duration: text(160),
  resistance: text(200),
  text: z.string().trim().max(12000),
  upgrades: z.array(z.object({ cost: z.number().int().min(0).max(30), text: z.string().trim().max(2000) })).max(20).default([]),
});

export const t20DeitySchema = z.object({
  summary: text(4000),
  energy: text(40),
  grantedPowers: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  details: z.record(z.string(), z.string().trim().max(4000)).default({}),
});

export const t20EquipmentSchema = z.object({
  group: z.enum(['arma', 'armadura', 'item', 'melhoria']),
  category: text(80),
  price: text(60),
  spaces: text(20),
  // Armas
  damage: text(40),
  critical: text(20),
  range: text(40),
  damageType: text(60),
  /** Empunhadura da tabela de armas: leve, uma mão ou duas mãos (livros antigos não trazem). */
  grip: z.enum(['leve', 'uma', 'duas']).optional(),
  /** Seção da tabela: corpo a corpo ou ataque à distância. */
  attack: z.enum(['corpo', 'distancia']).optional(),
  // Armaduras e escudos
  defense: z.number().int().min(0).max(20).optional(),
  penalty: z.number().int().min(-20).max(0).optional(),
  effect: text(300),
  text: text(8000),
});

export const t20MagicItemSchema = z.object({
  kind: z.enum(['encanto-arma', 'arma-especifica', 'encanto-armadura', 'armadura-especifica', 'pocao', 'acessorio-menor', 'acessorio-medio', 'acessorio-maior', 'artefato']),
  price: text(60),
  effect: text(300),
  text: text(12000),
});

export const t20SectionSchema = z.object({
  chapter: text(160),
  order: z.number().int().min(0).max(100000).default(0),
  body: text(60000),
});

export const t20BookEntryDataSchemas = {
  section: t20SectionSchema,
  class: t20ClassSchema,
  species: t20RaceSchema,
  background: t20OriginSchema,
  feat: t20PowerSchema,
  spell: t20SpellSchema,
  deity: t20DeitySchema,
  equipment: t20EquipmentSchema,
  magic_item: t20MagicItemSchema,
  monster: t20StatBlockSchema,
} as const satisfies Record<T20BookEntryKind, z.ZodType>;

export type T20BookEntryData<K extends T20BookEntryKind> = z.output<(typeof t20BookEntryDataSchemas)[K]>;

export interface T20BookEntry<K extends T20BookEntryKind = T20BookEntryKind> {
  kind: K;
  key: string;
  name: string;
  data: T20BookEntryData<K>;
}

const bookKey = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífens.');

export const t20BookInfoSchema = z.object({
  id: bookKey,
  name: z.string().trim().min(1).max(120),
  category: z.enum(['core', 'player', 'monsters', 'gm', 'setting', 'adventure']),
  edition: text(40),
  origin: text(300),
});

export interface T20BookPack {
  format: typeof T20_BOOK_PACK_FORMAT;
  version: typeof T20_BOOK_PACK_VERSION;
  book: z.output<typeof t20BookInfoSchema>;
  entries: T20BookEntry[];
}

export const T20_MAX_BOOK_ENTRIES = 6000;

/** Valida um pacote; entradas inválidas ficam de fora e voltam em `issues`. */
export function parseT20BookPack(input: unknown): { pack: T20BookPack; issues: { index: number; kind?: string; key?: string; message: string }[] } {
  const header = z
    .object({
      format: z.literal(T20_BOOK_PACK_FORMAT, { error: 'Este arquivo não é um pacote de livro de Tormenta20.' }),
      version: z.literal(T20_BOOK_PACK_VERSION, { error: 'Versão de pacote não suportada.' }),
      book: t20BookInfoSchema,
      entries: z.array(z.unknown()).max(T20_MAX_BOOK_ENTRIES),
    })
    .parse(input);
  const raw = z.object({ kind: z.enum(T20_BOOK_ENTRY_KINDS), key: bookKey, name: z.string().trim().min(1).max(200), data: z.unknown() });
  const issues: { index: number; kind?: string; key?: string; message: string }[] = [];
  const entries: T20BookEntry[] = [];
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
    const data = t20BookEntryDataSchemas[kind].safeParse(base.data.data);
    if (!data.success) {
      const issue = data.error.issues[0];
      issues.push({ index, kind, key, message: `${issue?.path.join('.') || 'dados'}: ${issue?.message ?? 'inválido'}` });
      return;
    }
    seen.add(`${kind}:${key}`);
    entries.push({ kind, key, name, data: data.data });
  });
  return { pack: { format: T20_BOOK_PACK_FORMAT, version: T20_BOOK_PACK_VERSION, book: header.book, entries }, issues };
}

/** Lê o conteúdo salvo no banco sem lançar: `null` se a entrada não for válida. */
export function safeT20BookEntryData<K extends T20BookEntryKind>(kind: K, data: unknown): T20BookEntryData<K> | null {
  const parsed = t20BookEntryDataSchemas[kind].safeParse(data);
  return parsed.success ? (parsed.data as T20BookEntryData<K>) : null;
}
