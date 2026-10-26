/**
 * Estrutura da ficha de D&D 5e (SRD 5.2) armazenada em `characters.sheet`.
 *
 * Só guarda valores informados pelo usuário. Tudo o que pode ser calculado (modificadores,
 * bônus de perícias, CD de magia, percepção passiva...) vem de `computeDnd5eDerived` e nunca
 * é persistido — assim não há valores derivados desatualizados no banco.
 *
 * Vida, dados de vida, espaços de magia e usos de habilidades são trilhas de recurso
 * (tabela `character_resources`), atualizadas atomicamente durante a sessão.
 */
import { z } from 'zod';
import {
  ABILITIES,
  ABILITY_SCORE_MAX,
  ABILITY_SCORE_MIN,
  DEFAULT_ABILITY_SCORE,
  type Ability,
} from './abilities';
import { MAX_LEVEL, MIN_LEVEL } from './progression';
import { PROFICIENCY_LEVELS, SKILLS, type Skill } from './skills';

export const DND5E_SHEET_VERSION = 1;

export const HIT_DICE = ['d6', 'd8', 'd10', 'd12'] as const;
export type HitDie = (typeof HIT_DICE)[number];

export const SPELLCASTING_ABILITIES = ['int', 'wis', 'cha'] as const;
export const SPEED_UNITS = ['m', 'ft'] as const;
export const ADVANCEMENT_MODES = ['milestone', 'experience'] as const;

const text = (max: number) => z.string().trim().max(max).default('');
const bonus = z.number().int().min(-30).max(30).default(0);

function recordOf<K extends string, S extends z.ZodType>(keys: readonly K[], schema: S) {
  return z.object(Object.fromEntries(keys.map((key) => [key, schema])) as Record<K, S>);
}

const abilityScore = z
  .number()
  .int()
  .min(ABILITY_SCORE_MIN)
  .max(ABILITY_SCORE_MAX)
  .default(DEFAULT_ABILITY_SCORE);

const savingThrow = z
  .object({
    proficient: z.boolean().default(false),
    bonus,
  })
  .prefault({});

const skill = z
  .object({
    proficiency: z.enum(PROFICIENCY_LEVELS).default('none'),
    bonus,
  })
  .prefault({});

export const dnd5eClassSchema = z.object({
  name: text(40),
  subclass: text(60),
  level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL).default(1),
  hitDie: z.enum(HIT_DICE).default('d8'),
});
export type Dnd5eClass = z.output<typeof dnd5eClassSchema>;

export const dnd5eSheetSchema = z.object({
  schemaVersion: z.literal(DND5E_SHEET_VERSION).default(DND5E_SHEET_VERSION),
  identity: z
    .object({
      species: text(60),
      background: text(60),
      alignment: text(40),
      classes: z
        .array(dnd5eClassSchema)
        .min(1)
        .max(4)
        .default([{ name: '', subclass: '', level: 1, hitDie: 'd8' }]),
      advancement: z.enum(ADVANCEMENT_MODES).default('milestone'),
      experience: z.number().int().min(0).max(1_000_000).default(0),
      /** Livros oficiais usados pela ficha (ids de `DND5E_SOURCEBOOKS`); vazio = só o SRD. */
      sourcebooks: z.array(z.string().max(40)).max(80).default([]).catch([]),
    })
    .prefault({}),
  abilities: recordOf(ABILITIES, abilityScore).prefault({}),
  savingThrows: recordOf(ABILITIES, savingThrow).prefault({}),
  skills: recordOf(SKILLS, skill).prefault({}),
  combat: z
    .object({
      armorClass: z.number().int().min(0).max(50).default(10),
      initiativeBonus: bonus,
      /** Proficiência na Iniciativa (talento Alerta; meia proficiência do bardo). */
      initiativeProficiency: z.enum(PROFICIENCY_LEVELS).default('none'),
      speed: z.number().min(0).max(1000).default(9),
      speedUnit: z.enum(SPEED_UNITS).default('m'),
    })
    .prefault({}),
  spellcasting: z
    .object({
      ability: z.enum(SPELLCASTING_ABILITIES).nullable().default(null),
      saveDcBonus: bonus,
      attackBonus: bonus,
    })
    .prefault({}),
  proficiencies: z
    .object({
      armor: text(300),
      weapons: text(300),
      tools: text(300),
      languages: text(300),
    })
    .prefault({}),
  details: z
    .object({
      height: text(40),
      age: text(40),
      appearance: text(4000),
      personality: text(4000),
      ideals: text(2000),
      bonds: text(2000),
      flaws: text(2000),
      goals: text(4000),
      backstory: text(20000),
      notes: text(20000),
    })
    .prefault({}),
});

export type Dnd5eSheet = z.output<typeof dnd5eSheetSchema>;
export type Dnd5eSheetInput = z.input<typeof dnd5eSheetSchema>;
export type Dnd5eAbilityScores = Record<Ability, number>;
export type Dnd5eSkillEntry = Dnd5eSheet['skills'][Skill];

/**
 * Moedas não ficam na ficha: são trilhas de recurso (`currency_<moeda>`), porque fazem
 * parte do estado de jogo — o jogador as gasta mesmo quando o mestre trava a edição da
 * ficha, e o banco ajusta os valores de forma atômica.
 */
export const CURRENCIES = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const currencyLabels: Record<Currency, { name: string; abbreviation: string }> = {
  cp: { name: 'Peças de cobre', abbreviation: 'PC' },
  sp: { name: 'Peças de prata', abbreviation: 'PP' },
  ep: { name: 'Peças de electro', abbreviation: 'PE' },
  gp: { name: 'Peças de ouro', abbreviation: 'PO' },
  pp: { name: 'Peças de platina', abbreviation: 'PL' },
};

export function createDefaultDnd5eSheet(): Dnd5eSheet {
  return dnd5eSheetSchema.parse({});
}

/**
 * Atualiza fichas salvas em versões antigas do esquema para a versão atual.
 * Hoje só existe a versão 1; novas versões devem adicionar passos aqui, nunca
 * reinterpretar dados antigos silenciosamente.
 */
function migrateDnd5eSheet(data: unknown): unknown {
  if (data === null || data === undefined) return {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('A ficha de D&D 5e precisa ser um objeto JSON.');
  }
  const version = (data as { schemaVersion?: unknown }).schemaVersion;
  if (version !== undefined && version !== DND5E_SHEET_VERSION) {
    throw new RangeError(`Versão de ficha D&D 5e não suportada: ${JSON.stringify(version)}.`);
  }
  return data;
}

/** Valida dados vindos do banco, aplicando migrações e valores padrão. Lança ZodError se inválido. */
export function parseDnd5eSheet(data: unknown): Dnd5eSheet {
  return dnd5eSheetSchema.parse(migrateDnd5eSheet(data));
}

/** Nível total do personagem (soma das classes, limitado entre 1 e 20). */
export function totalLevel(sheet: Pick<Dnd5eSheet, 'identity'>): number {
  const sum = sheet.identity.classes.reduce((total, entry) => total + entry.level, 0);
  return Math.min(Math.max(sum, MIN_LEVEL), MAX_LEVEL);
}
