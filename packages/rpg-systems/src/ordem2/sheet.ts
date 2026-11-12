/**
 * Ficha do Ordem Paranormal RPG 2 (playtests Alpha e Beta).
 *
 * Atributos e perícias são dados (d4 a d12; d20 só com efeitos paranormais). O playtest Alpha
 * se passa no mundo moderno e o Beta na Idade Média: as duas listas têm 20 perícias, 16 em
 * comum. As que mudam de nome entre os cenários usam a mesma chave (Pesquisar/Inspecionar,
 * Ocultismo/Bruxaria) para a ficha continuar válida se a campanha trocar de cenário.
 */
import { z } from 'zod';

export const ORDEM2_SHEET_VERSION = 1;

export const ORDEM2_DICE = [4, 6, 8, 10, 12, 20] as const;
export type Ordem2Die = (typeof ORDEM2_DICE)[number];
export const ordem2DieSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(20),
]);

export const ORDEM2_SETTINGS = ['moderno', 'medieval'] as const;
export type Ordem2Setting = (typeof ORDEM2_SETTINGS)[number];
export const ordem2SettingLabels: Record<Ordem2Setting, string> = {
  moderno: 'Moderno (playtest Alpha)',
  medieval: 'Medieval (playtest Beta)',
};

export const ORDEM2_ATTRIBUTES = ['fisico', 'mente', 'emocao'] as const;
export type Ordem2Attribute = (typeof ORDEM2_ATTRIBUTES)[number];
export const ordem2AttributeLabels: Record<Ordem2Attribute, string> = {
  fisico: 'Físico',
  mente: 'Mente',
  emocao: 'Emoção',
};
export const ordem2AttributeDescriptions: Record<Ordem2Attribute, string> = {
  fisico: 'Força muscular, coordenação motora, velocidade e fôlego.',
  mente: 'Raciocínio, educação e percepção.',
  emocao: 'Força de vontade, magnetismo social e instintos.',
};

export const ORDEM2_PROFILES = ['executor', 'analista', 'vigilante'] as const;
export type Ordem2Profile = (typeof ORDEM2_PROFILES)[number];
export const ordem2ProfileLabels: Record<Ordem2Profile, string> = {
  executor: 'Executor',
  analista: 'Analista',
  vigilante: 'Vigilante',
};
export const ordem2ProfileDescriptions: Record<Ordem2Profile, string> = {
  executor: 'Age primeiro e pensa depois; vence pela perseverança.',
  analista: 'Observa, entende e se prepara antes de agir, com precisão.',
  vigilante: 'Atento aos arredores, aproveita brechas e decide sob pressão.',
};

/** Patamares de experiência: dão +1 por patamar acima de iniciante nas tabelas de lesão e trauma. */
export const ORDEM2_TIERS = ['iniciante', 'veterano', 'elite', 'lenda'] as const;
export type Ordem2Tier = (typeof ORDEM2_TIERS)[number];
export const ordem2TierLabels: Record<Ordem2Tier, string> = {
  iniciante: 'Iniciante',
  veterano: 'Veterano',
  elite: 'Elite',
  lenda: 'Lenda',
};

export interface Ordem2SkillDefinition {
  key: string;
  attribute: Ordem2Attribute;
  /** Nome em cada cenário; ausente = a perícia não existe nesse cenário. */
  labels: Partial<Record<Ordem2Setting, string>>;
  description: string;
}

export const ORDEM2_SKILLS: readonly Ordem2SkillDefinition[] = [
  {
    key: 'acrobacia',
    attribute: 'fisico',
    labels: { moderno: 'Acrobacia', medieval: 'Acrobacia' },
    description: 'Ginástica, equilíbrio, saltos e quedas.',
  },
  {
    key: 'animais',
    attribute: 'emocao',
    labels: { medieval: 'Animais' },
    description: 'Manejar e acalmar animais, cavalgar.',
  },
  {
    key: 'aptidao',
    attribute: 'mente',
    labels: { moderno: 'Aptidão', medieval: 'Aptidão' },
    description: 'Conhecimento num campo específico (veja os campos de aptidão).',
  },
  {
    key: 'atletismo',
    attribute: 'fisico',
    labels: { moderno: 'Atletismo', medieval: 'Atletismo' },
    description: 'Correr, saltar, escalar, nadar e remar.',
  },
  {
    key: 'crime',
    attribute: 'fisico',
    labels: { moderno: 'Crime', medieval: 'Crime' },
    description: 'Furtar, abrir fechaduras, falsificar.',
  },
  {
    key: 'disciplina',
    attribute: 'emocao',
    labels: { moderno: 'Disciplina', medieval: 'Disciplina' },
    description: 'Estudar, meditar, resistir a traumas e sustos.',
  },
  {
    key: 'enganacao',
    attribute: 'emocao',
    labels: { moderno: 'Enganação', medieval: 'Enganação' },
    description: 'Mentir, disfarçar-se, seduzir.',
  },
  {
    key: 'furtividade',
    attribute: 'fisico',
    labels: { moderno: 'Furtividade', medieval: 'Furtividade' },
    description: 'Esconder-se e mover-se sem ser notado.',
  },
  {
    key: 'intimidar',
    attribute: 'emocao',
    labels: { moderno: 'Intimidar', medieval: 'Intimidar' },
    description: 'Assustar e coagir pessoas.',
  },
  {
    key: 'intuicao',
    attribute: 'emocao',
    labels: { moderno: 'Intuição', medieval: 'Intuição' },
    description: '“Sexto sentido” para pessoas e ambientes.',
  },
  {
    key: 'luta',
    attribute: 'fisico',
    labels: { moderno: 'Luta', medieval: 'Luta' },
    description: 'Ataques desarmados e corpo a corpo.',
  },
  {
    key: 'maquinas',
    attribute: 'mente',
    labels: { moderno: 'Máquinas' },
    description: 'Operar e consertar máquinas, dirigir veículos.',
  },
  {
    key: 'medicina',
    attribute: 'mente',
    labels: { moderno: 'Medicina', medieval: 'Medicina' },
    description: 'Primeiros socorros e tratamentos.',
  },
  {
    key: 'metalurgia',
    attribute: 'mente',
    labels: { medieval: 'Ofício (metalurgia)' },
    description: 'Fabricar e consertar itens.',
  },
  {
    key: 'ocultismo',
    attribute: 'mente',
    labels: { moderno: 'Ocultismo', medieval: 'Bruxaria' },
    description: 'Conhecimento sobre o paranormal.',
  },
  {
    key: 'percepcao',
    attribute: 'mente',
    labels: { moderno: 'Percepção', medieval: 'Percepção' },
    description: 'Notar coisas pelos sentidos, revistar lugares.',
  },
  {
    key: 'persuasao',
    attribute: 'emocao',
    labels: { moderno: 'Persuasão', medieval: 'Persuasão' },
    description: 'Convencer com argumentos e lábia.',
  },
  {
    key: 'pesquisar',
    attribute: 'mente',
    labels: { moderno: 'Pesquisar', medieval: 'Inspecionar' },
    description: 'Analisar documentos e evidências.',
  },
  {
    key: 'pontaria',
    attribute: 'fisico',
    labels: { moderno: 'Pontaria', medieval: 'Pontaria' },
    description: 'Ataques com armas de arremesso ou disparo.',
  },
  {
    key: 'sobrevivencia',
    attribute: 'mente',
    labels: { moderno: 'Sobrevivência', medieval: 'Sobrevivência' },
    description: 'Acampar, rastrear, lidar com a natureza.',
  },
  {
    key: 'tecnologia',
    attribute: 'mente',
    labels: { moderno: 'Tecnologia' },
    description: 'Operar dispositivos tecnológicos, hackear.',
  },
  {
    key: 'vigor',
    attribute: 'fisico',
    labels: { moderno: 'Vigor', medieval: 'Vigor' },
    description: 'Fôlego, resistir a venenos e ferimentos.',
  },
];
export const ORDEM2_SKILL_KEYS = ORDEM2_SKILLS.map((skill) => skill.key);

/** Campos de Aptidão de cada cenário (Aptidão com d6 ou mais em Erudição = alfabetizado). */
export const ORDEM2_APTITUDE_FIELDS: Record<
  Ordem2Setting,
  readonly { key: string; label: string }[]
> = {
  moderno: [
    { key: 'artes', label: 'Artes' },
    { key: 'atualidades', label: 'Atualidades' },
    { key: 'burocracia', label: 'Burocracia' },
    { key: 'exatas', label: 'Exatas' },
    { key: 'humanas', label: 'Humanas' },
    { key: 'tatica', label: 'Tática' },
  ],
  medieval: [
    { key: 'artes', label: 'Artes' },
    { key: 'erudicao', label: 'Erudição' },
    { key: 'folclore', label: 'Folclore' },
    { key: 'guerra', label: 'Guerra' },
    { key: 'nobreza', label: 'Nobreza' },
    { key: 'religiao', label: 'Religião' },
  ],
};

export function ordem2SkillsFor(setting: Ordem2Setting): Ordem2SkillDefinition[] {
  return ORDEM2_SKILLS.filter((skill) => skill.labels[setting]);
}

export function ordem2SkillLabel(key: string, setting: Ordem2Setting): string {
  const skill = ORDEM2_SKILLS.find((entry) => entry.key === key);
  return skill?.labels[setting] ?? skill?.labels.moderno ?? skill?.labels.medieval ?? key;
}

const text = (max: number) => z.string().trim().max(max).default('');
const skillSchema = z
  .object({
    die: ordem2DieSchema.default(4),
    /** Modificador fixo permanente (lesões e traumas: –1, –2, +1). */
    modifier: z.number().int().min(-10).max(10).default(0),
  })
  .prefault({});

export const ORDEM2_RELATION_GRADES = [1, 2, 3] as const;
export const ordem2RelationGradeLabels: Record<1 | 2 | 3, string> = {
  1: 'Afinidade',
  2: 'Vínculo',
  3: 'Devoção',
};

export const ORDEM2_EQUIPMENT_KINDS = [
  'corpo-a-corpo',
  'distancia',
  'protecao',
  'ferramenta',
  'outro',
] as const;
export type Ordem2EquipmentKind = (typeof ORDEM2_EQUIPMENT_KINDS)[number];
export const ordem2EquipmentKindLabels: Record<Ordem2EquipmentKind, string> = {
  'corpo-a-corpo': 'Arma corpo a corpo',
  distancia: 'Arma à distância',
  protecao: 'Proteção',
  ferramenta: 'Ferramenta',
  outro: 'Outro',
};

export const ordem2SheetSchema = z.object({
  schemaVersion: z.literal(ORDEM2_SHEET_VERSION).default(ORDEM2_SHEET_VERSION),
  setting: z.enum(ORDEM2_SETTINGS).default('moderno'),
  profile: z.enum(ORDEM2_PROFILES).nullable().default(null),
  vocation: text(120),
  level: z.number().int().min(1).max(10).default(1),
  tier: z.enum(ORDEM2_TIERS).default('iniciante'),
  /**
   * PV e PD máximos. O playtest não traz regra de cálculo (só personagens prontos): os valores
   * vêm da ficha pronta ou do mestre. As trilhas da ficha guardam os valores atuais.
   */
  maxHitPoints: z.number().int().min(1).max(999).default(20),
  maxDetermination: z.number().int().min(1).max(999).default(12),
  attributes: z
    .object({
      fisico: ordem2DieSchema.default(6),
      mente: ordem2DieSchema.default(6),
      emocao: ordem2DieSchema.default(6),
    })
    .prefault({}),
  skills: z
    .object(
      Object.fromEntries(ORDEM2_SKILL_KEYS.map((key) => [key, skillSchema])) as Record<
        string,
        typeof skillSchema
      >,
    )
    .prefault({}),
  /** Campos de Aptidão com dado próprio; os demais usam o dado de Aptidão. */
  aptitudes: z
    .array(z.object({ field: z.string().trim().min(1).max(60), die: ordem2DieSchema.default(6) }))
    .max(20)
    .default([]),
  abilities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        /** De onde vem: perfil, vocação, treino, item… */
        source: text(80),
        text: text(6000),
      }),
    )
    .max(60)
    .default([]),
  equipment: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        kind: z.enum(ORDEM2_EQUIPMENT_KINDS).default('outro'),
        /** Dano no formato do livro: "RA+3", "RB", "RA+1 não letal". */
        damage: text(80),
        /** Pontos de armadura que o item fornece. */
        armor: z.number().int().min(0).max(20).default(0),
        notes: text(2000),
      }),
    )
    .max(80)
    .default([]),
  relations: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
        description: text(2000),
        /** Cada relação só pode ser invocada uma vez por missão. */
        invoked: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
  /** Lesões e traumas permanentes (chaves das tabelas em `rules.ts`). */
  injuries: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  traumas: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  /** Dado de pavor ativo (0 = nenhum). */
  fearDie: z.union([z.literal(0), ordem2DieSchema]).default(0),
  /** Parte do dano sofrido que é não letal (os PV ficam nas trilhas). */
  nonLethal: z.number().int().min(0).max(999).default(0),
  /** Quantos testes de lesão e de trauma já foram feitos na cena (DT 7, +3 por teste). */
  sceneInjuryTests: z.number().int().min(0).max(20).default(0),
  sceneTraumaTests: z.number().int().min(0).max(20).default(0),
  identity: z
    .object({
      fullName: text(160),
      appearance: text(4000),
      history: text(12000),
      notes: text(12000),
    })
    .prefault({}),
});

export type Ordem2Sheet = z.output<typeof ordem2SheetSchema>;

export function createDefaultOrdem2Sheet(setting: Ordem2Setting = 'moderno'): Ordem2Sheet {
  return ordem2SheetSchema.parse({ setting });
}

export function parseOrdem2Sheet(data: unknown): Ordem2Sheet {
  return ordem2SheetSchema.parse(data ?? {});
}

/** Dado de uma perícia, considerando o campo de Aptidão quando houver. */
export function ordem2SkillDie(sheet: Ordem2Sheet, key: string, aptitudeField?: string): Ordem2Die {
  if (key === 'aptidao' && aptitudeField) {
    const own = sheet.aptitudes.find((entry) => entry.field === aptitudeField);
    if (own) return own.die;
  }
  return sheet.skills[key]?.die ?? 4;
}
