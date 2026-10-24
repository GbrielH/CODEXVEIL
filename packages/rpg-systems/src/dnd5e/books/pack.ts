/**
 * Pacote de livro: o conteúdo de um livro de D&D 5e que o próprio usuário importa para a conta
 * (espécies, subclasses, talentos, magias, monstros, itens mágicos e o texto dos capítulos).
 *
 * O Codexveil não traz nenhum texto de livro comercial. O pacote é um arquivo JSON que o dono
 * do livro gera a partir do próprio exemplar e importa na página "Meus livros"; o conteúdo fica
 * no banco, visível só para ele e para os participantes das campanhas em que ele liberar o livro.
 */
import { z } from 'zod';
import { ABILITIES } from '../abilities';
import { SPELL_SCHOOLS } from '../entries';
import { SKILLS } from '../skills';
import { SOURCEBOOK_CATEGORIES } from '../sourcebooks';

export const BOOK_PACK_FORMAT = 'codexveil.dnd5e.book';
export const BOOK_PACK_VERSION = 1;

export const BOOK_ENTRY_KINDS = [
  'section',
  'class',
  'subclass',
  'species',
  'background',
  'feat',
  'spell',
  'spell_list',
  'monster',
  'magic_item',
] as const;
export type BookEntryKind = (typeof BOOK_ENTRY_KINDS)[number];

export const bookEntryKindLabels: Record<BookEntryKind, { one: string; many: string }> = {
  section: { one: 'Capítulo', many: 'Texto do livro' },
  class: { one: 'Classe', many: 'Classes' },
  subclass: { one: 'Subclasse', many: 'Subclasses' },
  species: { one: 'Espécie', many: 'Espécies' },
  background: { one: 'Antecedente', many: 'Antecedentes' },
  feat: { one: 'Talento', many: 'Talentos' },
  spell: { one: 'Magia', many: 'Magias' },
  spell_list: { one: 'Lista de magias', many: 'Listas de magias' },
  monster: { one: 'Monstro', many: 'Monstros' },
  magic_item: { one: 'Item mágico', many: 'Itens mágicos' },
};

/** Tipos usados na criação e na subida de nível dos personagens. */
export const CHARACTER_BOOK_KINDS = [
  'class',
  'subclass',
  'species',
  'background',
  'feat',
  'spell',
  'spell_list',
] as const satisfies readonly BookEntryKind[];

/** Categorias cujo texto os jogadores leem (as outras podem ter surpresas da mesa). */
export const PLAYER_TEXT_CATEGORIES = ['core', 'player', 'setting'] as const;

/**
 * Tipos de entrada que alguém da mesa lê (a mesma regra do RLS de `book_entries`): o dono e os
 * mestres leem tudo; os jogadores, o conteúdo de personagem e o texto dos livros de jogador.
 */
export function visibleBookKinds(category: string, canReadAll: boolean): BookEntryKind[] {
  if (canReadAll) return [...BOOK_ENTRY_KINDS];
  const text = (PLAYER_TEXT_CATEGORIES as readonly string[]).includes(category);
  return BOOK_ENTRY_KINDS.filter(
    (kind) =>
      (CHARACTER_BOOK_KINDS as readonly string[]).includes(kind) || (kind === 'section' && text),
  );
}

/** Identificador de livro ou de entrada: minúsculas, números e hífens. */
export const bookKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífens.');

const text = (max: number) => z.string().trim().max(max).default('');
const paragraphs = z.array(z.string().trim().max(8000)).max(200).default([]);
const level = z.number().int().min(1).max(20);

const featureSchema = z.object({
  level: level.default(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(8000).default(''),
});
export type BookFeature = z.output<typeof featureSchema>;

const levelTable = z.array(z.number().int().min(0).max(30)).length(20);

export const bookSectionSchema = z.object({
  /** Capítulo (o primeiro nível do sumário). */
  chapter: text(160),
  /** Títulos até esta seção, do capítulo ao título da própria seção. */
  path: z.array(z.string().trim().max(200)).max(8).default([]),
  /** Ordem no livro. */
  order: z.number().int().min(0).max(1_000_000),
  page: z.number().int().min(0).max(5000).default(0),
  /** Texto em Markdown simples: parágrafos, listas com "- " e tabelas com "|". */
  body: z.string().max(60_000).default(''),
});

export const bookClassSchema = z.object({
  summary: text(2000),
  hitDie: z.enum(['d6', 'd8', 'd10', 'd12']),
  primaryAbilities: z.array(z.enum(ABILITIES)).min(1).max(3),
  savingThrows: z.tuple([z.enum(ABILITIES), z.enum(ABILITIES)]),
  skillChoices: z.object({
    count: z.number().int().min(0).max(6),
    options: z.array(z.enum(SKILLS)).max(18),
  }),
  armor: z
    .array(z.enum(['light', 'medium', 'heavy', 'shield']))
    .max(4)
    .default([]),
  weapons: z.object({
    simple: z.boolean(),
    martial: z.enum(['all', 'light', 'finesse_or_light', 'none']),
  }),
  tools: text(300),
  /** Equipamento inicial descrito pelo livro (o ouro alternativo vira a opção do assistente). */
  equipment: text(2000),
  startingGold: z.number().int().min(0).max(1000).default(0),
  asiLevels: z.array(level).max(10).default([4, 8, 12, 16, 19]),
  subclassLevel: level.default(3),
  subclassLabel: text(80),
  spellcasting: z
    .object({
      ability: z.enum(['int', 'wis', 'cha']),
      list: bookKeySchema,
      progression: z.enum(['full', 'half', 'pact']),
      cantrips: levelTable.nullable(),
      prepared: levelTable,
    })
    .optional(),
  features: z.array(featureSchema).max(120).default([]),
});

export const bookSubclassSchema = z.object({
  /** Classe do SRD (`wizard`, `cleric`…) ou a chave de uma classe de livro (`artificer`). */
  classId: z.string().trim().min(1).max(40),
  summary: text(2000),
  features: z.array(featureSchema).max(60).default([]),
  /** Magias sempre preparadas (domínio, juramento, círculo, patrono), pelo nome. */
  alwaysPrepared: z
    .array(z.object({ level, spells: z.array(z.string().trim().max(120)).max(10) }))
    .max(10)
    .default([]),
  /** Escolha de terreno com magias próprias (Círculo da Terra do Livro do Jogador 2014). */
  landOptions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        spells: z.array(z.object({ level, spells: z.array(z.string().trim().max(120)).max(10) })).max(10),
      }),
    )
    .max(12)
    .default([]),
});

export const bookSpeciesSchema = z.object({
  summary: text(2000),
  creatureType: text(60),
  sizes: z
    .array(z.enum(['small', 'medium']))
    .min(1)
    .max(2)
    .default(['medium']),
  /** Deslocamento em pés. */
  speed: z.number().int().min(0).max(120).default(30),
  traits: z.array(featureSchema).max(40).default([]),
  lineage: z
    .object({
      label: z.string().trim().min(1).max(80),
      options: z
        .array(
          z.object({
            id: bookKeySchema,
            name: z.string().trim().min(1).max(120),
            description: text(4000),
            speed: z.number().int().min(0).max(120).optional(),
          }),
        )
        .min(1)
        .max(20),
    })
    .optional(),
  /** Truques fixos da espécie, pelo nome. */
  cantrips: z.array(z.string().trim().max(120)).max(6).default([]),
});

export const bookBackgroundSchema = z.object({
  summary: text(4000),
  skills: z.array(z.enum(SKILLS)).max(4).default([]),
  tools: text(300),
  languages: text(300),
  equipment: text(1000),
  feature: z.object({ name: text(120), description: text(4000) }).optional(),
});

export const bookFeatSchema = z.object({
  category: z.enum(['origin', 'general', 'fighting_style', 'epic']).default('general'),
  description: z.string().trim().max(8000),
  prerequisite: text(300),
  minLevel: level.optional(),
  minScore: z
    .object({
      abilities: z.array(z.enum(ABILITIES)).min(1).max(6),
      value: z.number().int().min(1).max(30),
    })
    .optional(),
  /** Aumenta em 1 um destes atributos (o jogador escolhe). */
  abilityIncrease: z.array(z.enum(ABILITIES)).max(6).default([]),
  repeatable: z.boolean().default(false),
});

export const bookSpellSchema = z.object({
  /** 0 = truque. */
  level: z.number().int().min(0).max(9),
  school: z.enum(SPELL_SCHOOLS),
  /** Listas de classe (`wizard`, `cleric`…, ou a lista de uma classe de livro). */
  classes: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  castingTime: text(120),
  range: text(120),
  components: text(400),
  duration: text(120),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  description: paragraphs,
  /** Nome original em inglês, quando o livro informa (evita repetir uma magia do SRD). */
  original: text(120),
  /** Livro de origem indicado no texto (ex.: "Guia de Xanathar"). */
  source: text(200),
});

export const bookSpellListSchema = z.object({
  list: z.string().trim().min(1).max(40),
  /** Magias acrescentadas à lista, pelo nome (português do livro ou original do SRD). */
  spells: z
    .array(
      z.object({ name: z.string().trim().min(1).max(120), level: z.number().int().min(0).max(9) }),
    )
    .max(400),
});

const namedEntries = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(200),
      description: z.string().trim().max(8000).default(''),
    }),
  )
  .max(60)
  .default([]);

export const bookMonsterSchema = z.object({
  size: text(60),
  type: text(120),
  alignment: text(80),
  ac: z.number().int().min(0).max(50).default(10),
  acNote: text(200),
  hp: z.number().int().min(0).max(9999).default(1),
  hpFormula: text(80),
  speed: text(200),
  abilities: z
    .object(
      Object.fromEntries(
        ABILITIES.map((ability) => [ability, z.number().int().min(1).max(30).default(10)]),
      ) as Record<(typeof ABILITIES)[number], z.ZodDefault<z.ZodNumber>>,
    )
    .prefault({}),
  savingThrows: text(300),
  skills: text(400),
  vulnerabilities: text(300),
  resistances: text(400),
  damageImmunities: text(400),
  conditionImmunities: text(300),
  senses: text(300),
  languages: text(400),
  cr: text(20),
  xp: text(40),
  traits: namedEntries,
  actions: namedEntries,
  bonusActions: namedEntries,
  reactions: namedEntries,
  legendaryActions: namedEntries,
  /** Texto de ambientação que acompanha a criatura. */
  lore: paragraphs,
});

export const bookMagicItemSchema = z.object({
  /** Ex.: "Item maravilhoso", "Arma (qualquer espada)". */
  type: text(200),
  rarity: text(80),
  attunement: text(200),
  description: paragraphs,
});

export const bookEntryDataSchemas = {
  section: bookSectionSchema,
  class: bookClassSchema,
  subclass: bookSubclassSchema,
  species: bookSpeciesSchema,
  background: bookBackgroundSchema,
  feat: bookFeatSchema,
  spell: bookSpellSchema,
  spell_list: bookSpellListSchema,
  monster: bookMonsterSchema,
  magic_item: bookMagicItemSchema,
} as const satisfies Record<BookEntryKind, z.ZodType>;

export type BookEntryData<K extends BookEntryKind> = z.output<(typeof bookEntryDataSchemas)[K]>;

export interface BookEntry<K extends BookEntryKind = BookEntryKind> {
  kind: K;
  key: string;
  name: string;
  data: BookEntryData<K>;
}

const rawEntrySchema = z.object({
  kind: z.enum(BOOK_ENTRY_KINDS),
  key: bookKeySchema,
  name: z.string().trim().min(1).max(200),
  data: z.unknown(),
});

export const bookInfoSchema = z.object({
  /** Livro oficial (`tcoe`, `xgte`…, veja `DND5E_SOURCEBOOKS`) ou um identificador próprio. */
  id: bookKeySchema,
  name: z.string().trim().min(1).max(120),
  category: z.enum(SOURCEBOOK_CATEGORIES),
  edition: z.enum(['2024', '2014']).default('2014'),
  /** De onde veio o conteúdo (ex.: "PDF do exemplar do usuário, tradução da comunidade"). */
  origin: text(300),
});
export type BookInfo = z.output<typeof bookInfoSchema>;

export const MAX_BOOK_ENTRIES = 6000;

export interface BookPack {
  format: typeof BOOK_PACK_FORMAT;
  version: typeof BOOK_PACK_VERSION;
  book: BookInfo;
  entries: BookEntry[];
}

export interface BookPackIssue {
  index: number;
  kind?: string;
  key?: string;
  message: string;
}

export function parseBookEntryData<K extends BookEntryKind>(
  kind: K,
  data: unknown,
): BookEntryData<K> {
  return bookEntryDataSchemas[kind].parse(data) as BookEntryData<K>;
}

/** Lê o conteúdo salvo no banco sem lançar: devolve `null` se a entrada não for válida. */
export function safeBookEntryData<K extends BookEntryKind>(
  kind: K,
  data: unknown,
): BookEntryData<K> | null {
  const parsed = bookEntryDataSchemas[kind].safeParse(data);
  return parsed.success ? (parsed.data as BookEntryData<K>) : null;
}

/**
 * Valida um pacote inteiro. Entradas inválidas não derrubam o pacote: ficam de fora e voltam
 * em `issues`, para a tela dizer o que não entrou.
 */
export function parseBookPack(input: unknown): { pack: BookPack; issues: BookPackIssue[] } {
  const header = z
    .object({
      format: z.literal(BOOK_PACK_FORMAT, {
        error: 'Este arquivo não é um pacote de livro do Codexveil.',
      }),
      version: z.literal(BOOK_PACK_VERSION, { error: 'Versão de pacote não suportada.' }),
      book: bookInfoSchema,
      entries: z
        .array(z.unknown())
        .max(MAX_BOOK_ENTRIES, `O pacote pode ter no máximo ${MAX_BOOK_ENTRIES} entradas.`),
    })
    .parse(input);
  const issues: BookPackIssue[] = [];
  const entries: BookEntry[] = [];
  const seen = new Set<string>();
  header.entries.forEach((raw, index) => {
    const base = rawEntrySchema.safeParse(raw);
    if (!base.success) {
      issues.push({ index, message: base.error.issues[0]?.message ?? 'Entrada inválida.' });
      return;
    }
    const { kind, key, name } = base.data;
    const id = `${kind}:${key}`;
    if (seen.has(id)) {
      issues.push({ index, kind, key, message: 'Entrada repetida.' });
      return;
    }
    const data = bookEntryDataSchemas[kind].safeParse(base.data.data);
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
    seen.add(id);
    entries.push({ kind, key, name, data: data.data });
  });
  return {
    pack: { format: BOOK_PACK_FORMAT, version: BOOK_PACK_VERSION, book: header.book, entries },
    issues,
  };
}
