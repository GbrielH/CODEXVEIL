import { z } from 'zod';
import type {
  ConditionDefinition,
  ConditionDurationPreset,
  ContentLicense,
  OfficialLink,
  ResourceTemplate,
} from '../types';
import {
  ORDEM2_ATTRIBUTES,
  ORDEM2_SETTINGS,
  ordem2DieSchema,
  ordem2ProfileLabels,
  ordem2SettingLabels,
  type Ordem2Sheet,
} from './sheet';

export const ordem2License: ContentLicense = {
  work: 'Ordem Paranormal RPG 2 — Playtests Alpha e Beta (Arquivos Secretos)',
  licenseName: 'Todos os direitos reservados',
  licenseUrl: 'https://jamboeditora.com.br',
  sourceUrl: 'https://jamboeditora.com.br',
  attribution:
    'Ordem Paranormal © Cellbit e Jambô Editora. Regras resumidas pelo Codexveil; o texto integral, mapas e missões vêm apenas do pacote importado do exemplar do usuário.',
};

export const ordem2OfficialLinks: readonly OfficialLink[] = [
  {
    label: 'Jambô Editora',
    description: 'Editora do Ordem Paranormal RPG e dos Arquivos Secretos.',
    url: 'https://jamboeditora.com.br',
    access: 'paid',
  },
];

export const ordem2CampaignRulesSchema = z.object({
  setting: z.enum(ORDEM2_SETTINGS).default('moderno'),
  /** DT padrão dos testes (o playtest usa 7). */
  defaultDc: z.number().int().min(2).max(30).default(7),
  sourcebooks: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
});
export type Ordem2CampaignRules = z.output<typeof ordem2CampaignRulesSchema>;

export const defaultOrdem2CampaignRules = (): Ordem2CampaignRules =>
  ordem2CampaignRulesSchema.parse({});

export function parseOrdem2CampaignRules(data: unknown): Ordem2CampaignRules {
  const parsed = ordem2CampaignRulesSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : defaultOrdem2CampaignRules();
}

export function describeOrdem2CampaignRules(rules: Ordem2CampaignRules): string[] {
  return [`Cenário: ${ordem2SettingLabels[rules.setting]}`, `DT padrão ${rules.defaultDc}`];
}

/** Ficha de NPCs e criaturas, como nos quadros das missões. */
export const ordem2StatBlockSchema = z.object({
  description: z.string().trim().max(4000).default(''),
  strategy: z.string().trim().max(4000).default(''),
  hitPoints: z.number().int().min(0).max(9999).default(10),
  determination: z.number().int().min(0).max(9999).nullable().default(null),
  armor: z.number().int().min(0).max(99).default(0),
  attributes: z
    .object(
      Object.fromEntries(
        ORDEM2_ATTRIBUTES.map((key) => [key, ordem2DieSchema.default(4)]),
      ) as Record<(typeof ORDEM2_ATTRIBUTES)[number], z.ZodDefault<typeof ordem2DieSchema>>,
    )
    .prefault({}),
  skills: z
    .array(z.object({ key: z.string().trim().min(1).max(40), die: ordem2DieSchema }))
    .max(30)
    .default([]),
  actions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        kind: z.enum(['corpo-a-corpo', 'distancia', 'geral', 'outro']).default('corpo-a-corpo'),
        /** Dados do teste no formato do livro ("1d8+1d6"). */
        dice: z.string().trim().max(60).default(''),
        damage: z.string().trim().max(80).default(''),
        text: z.string().trim().max(4000).default(''),
      }),
    )
    .max(20)
    .default([]),
  abilities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        text: z.string().trim().max(6000).default(''),
      }),
    )
    .max(20)
    .default([]),
  notes: z.string().trim().max(8000).default(''),
});
export type Ordem2StatBlock = z.output<typeof ordem2StatBlockSchema>;

export const createDefaultOrdem2StatBlock = (): Ordem2StatBlock => ordem2StatBlockSchema.parse({});
export const parseOrdem2StatBlock = (data: unknown): Ordem2StatBlock =>
  ordem2StatBlockSchema.parse(data ?? {});

export function ordem2ArmorPoints(sheet: Ordem2Sheet): number {
  return sheet.equipment.reduce((sum, item) => sum + item.armor, 0);
}

export function ordem2DefaultResources(sheet: Ordem2Sheet): ResourceTemplate[] {
  const hp = sheet.maxHitPoints;
  const pd = sheet.maxDetermination;
  const armor = ordem2ArmorPoints(sheet);
  return [
    {
      key: 'hp',
      label: 'Pontos de Vida',
      current: hp,
      max: hp,
      recovery: 'manual',
      display: 'health',
      sortOrder: 0,
    },
    {
      key: 'pd',
      label: 'Pontos de Determinação',
      current: pd,
      max: pd,
      recovery: 'manual',
      display: 'pool',
      sortOrder: 10,
    },
    {
      key: 'armor',
      label: 'Pontos de Armadura',
      current: armor,
      max: armor,
      recovery: 'manual',
      display: 'checkboxes',
      sortOrder: 20,
    },
  ];
}

export function summarizeOrdem2(sheet: Ordem2Sheet) {
  const parts = [sheet.profile ? ordem2ProfileLabels[sheet.profile] : '', sheet.vocation].filter(
    Boolean,
  );
  return {
    subtitle: `${parts.join(' · ') || 'Agente'} · Nível ${sheet.level}`,
    level: sheet.level,
  };
}

/** Condições do playtest, em resumos próprios. */
export const ORDEM2_CONDITIONS: readonly ConditionDefinition[] = [
  {
    key: 'caido',
    label: 'Caído',
    summary:
      'Redução de passo em testes físicos; ataques corpo a corpo contra ele ganham um aumento de passo, à distância a DT sobe +3.',
  },
  {
    key: 'agarrado',
    label: 'Agarrado',
    summary:
      'Imóvel, redução de passo em ataques e só ataca com armas pequenas. Solta-se com uma ação e um teste de manobra.',
  },
  { key: 'inconsciente', label: 'Inconsciente', summary: 'Não age.' },
  {
    key: 'moribundo',
    label: 'Moribundo',
    summary: 'No fim de cada rodada faz teste de lesão (DT 7, +3 por teste na cena).',
    includes: ['inconsciente'],
  },
  {
    key: 'desequilibrado',
    label: 'Desequilibrado',
    summary: 'Redução de passo no próximo teste (até o fim da próxima rodada).',
  },
  {
    key: 'atrapalhado',
    label: 'Atrapalhado',
    summary: 'Redução de passo em todos os testes até o fim da rodada.',
  },
  { key: 'machucado', label: 'Machucado', summary: 'Físico um passo abaixo até o fim da cena.' },
  { key: 'desatento', label: 'Desatento', summary: 'Mente um passo abaixo até o fim da cena.' },
  { key: 'irritado', label: 'Irritado', summary: 'Emoção um passo abaixo até o fim da cena.' },
  { key: 'estupor', label: 'Estupor', summary: 'Perde a ação na próxima rodada.' },
  {
    key: 'pavor',
    label: 'Pavor',
    summary:
      'Rola o dado de pavor em todo teste; ele anula resultados menores. Tirar 1 encerra o pavor.',
  },
];

export const ordem2ConditionDurations: readonly ConditionDurationPreset[] = [
  { rounds: 1, label: '1 rodada' },
  { rounds: null, label: 'até o fim da cena / ser removida' },
];

export const formatOrdem2ConditionRounds = (rounds: number | null): string =>
  rounds === null ? 'até ser removida' : rounds === 1 ? '1 rodada' : `${rounds} rodadas`;
