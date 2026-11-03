import { z } from 'zod';
import type {
  ConditionDurationPreset,
  ContentLicense,
  OfficialLink,
  ResourceTemplate,
} from '../types';
import type { TriangleAgencySheet } from './sheet';

export const triangleAgencyLicense: ContentLicense = {
  work: 'Triangle Agency: O Jogo de Interpretação — Primeira edição',
  licenseName: 'Todos os direitos reservados',
  licenseUrl: 'https://shop.hauntedtable.games/pages/contact',
  sourceUrl:
    'https://shop.hauntedtable.games/products/digital-triangle-agency-core-rulebook-preorder',
  attribution:
    'Triangle Agency © 2024 Haunted Table, LLC. Conteúdo integral disponível apenas por importação do exemplar do usuário.',
};

export const triangleAgencyOfficialLinks: readonly OfficialLink[] = [
  {
    label: 'Triangle Agency',
    description: 'Página oficial do jogo e de seus materiais.',
    url: 'https://shop.hauntedtable.games/products/digital-triangle-agency-core-rulebook-preorder',
    access: 'paid',
  },
];

export const triangleAgencyCampaignRulesSchema = z.object({
  timePerMission: z.number().int().min(1).max(5).default(1),
  conflictResolution: z.enum(['dice', 'vote', 'rotating-judge', 'gm', 'birthday']).default('dice'),
  vetoPoints: z.boolean().default(false),
  sourcebooks: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
});
export type TriangleAgencyCampaignRules = z.output<typeof triangleAgencyCampaignRulesSchema>;

export function defaultTriangleAgencyCampaignRules(): TriangleAgencyCampaignRules {
  return triangleAgencyCampaignRulesSchema.parse({});
}

export function parseTriangleAgencyCampaignRules(data: unknown): TriangleAgencyCampaignRules {
  const parsed = triangleAgencyCampaignRulesSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : defaultTriangleAgencyCampaignRules();
}

export function describeTriangleAgencyCampaignRules(rules: TriangleAgencyCampaignRules): string[] {
  const methods: Record<TriangleAgencyCampaignRules['conflictResolution'], string> = {
    dice: '6d4 cumulativos',
    vote: 'votação',
    'rotating-judge': 'juiz rotativo',
    gm: 'palavra final do Diretor',
    birthday: 'regra do aniversário',
  };
  return [
    `${rules.timePerMission} ${rules.timePerMission === 1 ? 'unidade' : 'unidades'} de Tempo após cada missão`,
    `Conflitos: ${methods[rules.conflictResolution]}${rules.vetoPoints ? ' com Pontos de Veto' : ''}`,
  ];
}

export const triangleAgencyStatBlockSchema = z.object({
  codename: z.string().trim().max(160).default(''),
  focus: z.string().trim().max(2000).default(''),
  domain: z.string().trim().max(2000).default(''),
  behavior: z.string().trim().max(6000).default(''),
  chaos: z.number().int().min(0).max(999).default(0),
  harm: z.number().int().min(0).max(99).default(1),
  notes: z.string().trim().max(8000).default(''),
});
export type TriangleAgencyStatBlock = z.output<typeof triangleAgencyStatBlockSchema>;

export const createDefaultTriangleAgencyStatBlock = (): TriangleAgencyStatBlock =>
  triangleAgencyStatBlockSchema.parse({});
export const parseTriangleAgencyStatBlock = (data: unknown): TriangleAgencyStatBlock =>
  triangleAgencyStatBlockSchema.parse(data ?? {});

export function triangleAgencyDefaultResources(sheet: TriangleAgencySheet): ResourceTemplate[] {
  const current = Object.values(sheet.qualityAssurances.current).reduce(
    (sum, value) => sum + value,
    0,
  );
  const maximum = Object.values(sheet.qualityAssurances.maximum).reduce(
    (sum, value) => sum + value,
    0,
  );
  return [
    {
      key: 'quality_assurances',
      label: 'Garantias de Qualidade (total)',
      current,
      max: maximum,
      recovery: 'manual',
      display: 'pool',
      sortOrder: 10,
    },
  ];
}

export function summarizeTriangleAgency(sheet: TriangleAgencySheet) {
  const arc = [sheet.arc.anomaly, sheet.arc.reality, sheet.arc.competency].filter(Boolean);
  return { subtitle: arc.length ? arc.join(' · ') : 'Agente em integração', level: null };
}

export const triangleAgencyConditionDurations: readonly ConditionDurationPreset[] = [
  { rounds: null, label: 'até ser removido' },
];

export const formatTriangleAgencyConditionRounds = (rounds: number | null): string =>
  rounds === null ? 'até ser removido' : rounds === 1 ? '1 rodada' : `${rounds} rodadas`;
