/**
 * Peças do Assimilação RPG exigidas pelo contrato `RpgSystem`: regras da campanha, condições,
 * Ameaças (ficha de criatura), trilhas iniciais, licença e links oficiais.
 */
import { z } from 'zod';
import type {
  ConditionDefinition,
  ConditionDurationPreset,
  ContentLicense,
  OfficialLink,
  ResourceTemplate,
} from '../types';
import { CREATION, healthPerLevel, tugOfWar } from './rules';
import { generationLabels, type AssimilacaoSheet } from './sheet';

export const ASSIMILACAO_RESOURCE_KEYS = {
  health: 'saude',
  determination: 'determinacao',
  assimilation: 'assimilacao',
} as const;

/** Trilhas de um Infectado novo: Saúde (6 Níveis), Determinação e Assimilação (Cabo de Guerra). */
export function assimilacaoDefaultResources(sheet: AssimilacaoSheet): ResourceTemplate[] {
  const health = healthPerLevel(sheet) * 6;
  const { determinationLevel, assimilationLevel } = tugOfWar(sheet);
  return [
    {
      key: ASSIMILACAO_RESOURCE_KEYS.health,
      label: 'Pontos de Saúde',
      current: health,
      max: health,
      recovery: 'manual',
      display: 'health',
      sortOrder: 0,
    },
    {
      key: ASSIMILACAO_RESOURCE_KEYS.determination,
      label: 'Pontos de Determinação',
      current: determinationLevel,
      max: determinationLevel,
      recovery: 'long_rest',
      display: 'checkboxes',
      sortOrder: 1,
    },
    {
      key: ASSIMILACAO_RESOURCE_KEYS.assimilation,
      label: 'Pontos de Assimilação',
      current: assimilationLevel,
      max: assimilationLevel,
      recovery: 'short_rest',
      display: 'checkboxes',
      sortOrder: 2,
    },
  ];
}

export const assimilacaoCampaignRulesSchema = z.object({
  /** Nível inicial de Determinação (o livro recomenda 9; a Assimilação começa em 10 menos ele). */
  startingDetermination: z.number().int().min(1).max(9).default(9),
  /** Experiência para Características na criação (o livro dá 7). */
  startingExperience: z.number().int().min(0).max(60).default(CREATION.experience),
  /** Teto de Escassez dos equipamentos e Artefatos iniciais. */
  scarcityCap: z.number().int().min(0).max(10).default(2),
  /** Livros liberados (ids dos pacotes importados, ex.: `assimilacao-rpg`). */
  sourcebooks: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
});
export type AssimilacaoCampaignRules = z.output<typeof assimilacaoCampaignRulesSchema>;

export function defaultAssimilacaoCampaignRules(): AssimilacaoCampaignRules {
  return assimilacaoCampaignRulesSchema.parse({});
}

export function parseAssimilacaoCampaignRules(data: unknown): AssimilacaoCampaignRules {
  const parsed = assimilacaoCampaignRulesSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : defaultAssimilacaoCampaignRules();
}

export function describeAssimilacaoCampaignRules(rules: AssimilacaoCampaignRules): string[] {
  return [
    `Cabo de Guerra inicial: Determinação ${rules.startingDetermination} e Assimilação ${10 - rules.startingDetermination}.`,
    `${rules.startingExperience} pontos de Experiência na criação.`,
    `Teto de Escassez inicial: ${rules.scarcityCap}.`,
  ];
}

/** O que impede um Infectado pronto de entrar numa campanha (lista vazia = pode entrar). */
export function assimilacaoCampaignIssues(
  character: { name: string; sheet: AssimilacaoSheet },
  rules: AssimilacaoCampaignRules,
): string[] {
  const issues: string[] = [];
  if (!character.name.trim()) issues.push('Dê um nome ao Infectado.');
  if (character.sheet.tugOfWar.determinationLevel > rules.startingDetermination)
    issues.push(
      `A campanha começa com Determinação ${rules.startingDetermination}; a ficha está com ${character.sheet.tugOfWar.determinationLevel}.`,
    );
  return issues;
}

export const assimilacaoConditions: readonly ConditionDefinition[] = [
  {
    key: 'suscetivel',
    label: 'Suscetível',
    summary: 'Sem Pontos de Determinação: não pode gastá-los, e qualquer perda derruba um Nível.',
  },
  {
    key: 'agindo-por-instinto',
    label: 'Agindo por Instinto',
    summary: 'Fez uma Rolagem Assimilada: não pode ser alvo de ações de apoio nesta rodada.',
  },
  {
    key: 'inconsciente',
    label: 'Inconsciente',
    summary: 'Nível de Saúde 1 sem gastar Determinação para manter a consciência.',
  },
  {
    key: 'surpreendido',
    label: 'Surpreendido',
    summary: 'Pego desprevenido: reage com Reação, sem preparação.',
  },
];

export const assimilacaoConditionDurations: readonly ConditionDurationPreset[] = [
  { rounds: 1, label: '1 rodada' },
  { rounds: 3, label: '3 rodadas' },
  { rounds: null, label: 'Até ser removida' },
];

export function formatAssimilacaoConditionRounds(rounds: number | null): string {
  if (rounds === null) return 'até ser removida';
  return rounds === 1 ? '1 rodada' : `${rounds} rodadas`;
}

/** Ameaça de Conflito: pilha de dados, Saúde e ativações (custos em Sucessos/Adaptações/Pressões). */
export const assimilacaoStatBlockSchema = z.object({
  name: z.string().trim().max(120).default(''),
  kind: z.string().trim().max(120).default(''),
  pool: z
    .object({
      d6: z.number().int().min(0).max(20).default(0),
      d10: z.number().int().min(0).max(20).default(2),
      d12: z.number().int().min(0).max(20).default(0),
    })
    .prefault({}),
  /** Sucessos para neutralizar a Ameaça no Conflito. */
  neutralize: z.number().int().min(0).max(99).default(3),
  health: z.number().int().min(0).max(999).nullable().default(null),
  activations: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        cost: z.string().trim().max(40).default(''),
        text: z.string().trim().max(2000).default(''),
      }),
    )
    .max(30)
    .default([]),
  notes: z.string().trim().max(8000).default(''),
});
export type AssimilacaoStatBlock = z.output<typeof assimilacaoStatBlockSchema>;

export function createDefaultAssimilacaoStatBlock(): AssimilacaoStatBlock {
  return assimilacaoStatBlockSchema.parse({});
}

export function parseAssimilacaoStatBlock(data: unknown): AssimilacaoStatBlock {
  const parsed = assimilacaoStatBlockSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : createDefaultAssimilacaoStatBlock();
}

/**
 * Só as mecânicas ficam no código. O livro não tem licença aberta: os textos (regras completas,
 * cenário, Características, cartas) vêm do pacote que cada usuário importa do próprio exemplar.
 */
export const assimilacaoLicense: ContentLicense = {
  work: 'Assimilação RPG — Livro de Regras (mecânicas)',
  licenseName: 'Uso do exemplar do usuário (sem licença aberta)',
  licenseUrl: 'https://newordereditora.com/',
  sourceUrl: 'https://newordereditora.com/loja/?categorias=assimilacao-rpg',
  attribution:
    'Assimilação RPG © New Order Editora e autores. O Codexveil implementa as mecânicas de jogo; os textos do livro não ' +
    'são reproduzidos e só aparecem a partir do pacote importado do exemplar de cada usuário.',
};

export const assimilacaoOfficialLinks: readonly OfficialLink[] = [
  {
    label: 'Assimilação RPG (New Order Editora)',
    description: 'Livro de regras, baralhos e dados especiais na loja da editora.',
    url: 'https://newordereditora.com/loja/?categorias=assimilacao-rpg',
    access: 'paid',
  },
];

export function summarizeAssimilacao(sheet: AssimilacaoSheet) {
  const generation = sheet.identity.generation ? generationLabels[sheet.identity.generation] : '';
  const occupation = sheet.origins.occupation;
  const parts = [occupation, generation].filter((part) => part.length > 0);
  const { determinationLevel, assimilationLevel } = tugOfWar(sheet);
  return {
    subtitle: parts.length
      ? `${parts.join(' · ')} · D${determinationLevel}/A${assimilationLevel}`
      : `Determinação ${determinationLevel} · Assimilação ${assimilationLevel}`,
    level: null,
  };
}
