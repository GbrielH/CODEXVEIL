/**
 * Assimilação RPG: dados especiais, ficha de Infectado, Cabo de Guerra e Saúde. Os textos do
 * livro vêm do pacote importado do exemplar do usuário (`books/pack.ts`).
 * Plano e decisões em `docs/ASSIMILACAO.md`.
 */
import type { RpgSystem } from '../types';
import {
  ASSIMILACAO_SHEET_VERSION,
  assimilacaoSheetSchema,
  createDefaultAssimilacaoSheet,
  parseAssimilacaoSheet,
  type AssimilacaoSheet,
} from './sheet';
import { healthPerLevel, tugOfWar } from './rules';
import {
  assimilacaoCampaignRulesSchema,
  assimilacaoConditionDurations,
  assimilacaoConditions,
  assimilacaoDefaultResources,
  assimilacaoLicense,
  assimilacaoOfficialLinks,
  assimilacaoStatBlockSchema,
  createDefaultAssimilacaoStatBlock,
  defaultAssimilacaoCampaignRules,
  describeAssimilacaoCampaignRules,
  formatAssimilacaoConditionRounds,
  parseAssimilacaoCampaignRules,
  parseAssimilacaoStatBlock,
  summarizeAssimilacao,
  type AssimilacaoCampaignRules,
  type AssimilacaoStatBlock,
} from './system';

export * from './books/pack';
export * from './dice';
export * from './rules';
export * from './sheet';
export * from './system';

export interface AssimilacaoDerived {
  healthPerLevel: number;
  healthTotal: number;
  determinationLevel: number;
  assimilationLevel: number;
}

export const assimilacaoSystem: RpgSystem<
  AssimilacaoSheet,
  AssimilacaoDerived,
  AssimilacaoStatBlock,
  AssimilacaoCampaignRules
> = {
  id: 'assimilacao',
  name: 'Assimilação RPG',
  shortName: 'ASRPG',
  rulesReference: 'Assimilação RPG — Livro de Regras',
  sheetSchemaVersion: ASSIMILACAO_SHEET_VERSION,
  license: assimilacaoLicense,
  conditions: assimilacaoConditions,
  officialLinks: assimilacaoOfficialLinks,
  conditionDurations: assimilacaoConditionDurations,
  formatConditionRounds: formatAssimilacaoConditionRounds,
  sheetSchema: assimilacaoSheetSchema,
  statBlockSchema: assimilacaoStatBlockSchema,
  campaignRulesSchema: assimilacaoCampaignRulesSchema,
  defaultCampaignRules: defaultAssimilacaoCampaignRules,
  parseCampaignRules: parseAssimilacaoCampaignRules,
  describeCampaignRules: describeAssimilacaoCampaignRules,
  createDefaultSheet: createDefaultAssimilacaoSheet,
  parseSheet: parseAssimilacaoSheet,
  computeDerived: (sheet) => {
    const perLevel = healthPerLevel(sheet);
    return { healthPerLevel: perLevel, healthTotal: perLevel * 6, ...tugOfWar(sheet) };
  },
  summarize: summarizeAssimilacao,
  defaultResources: assimilacaoDefaultResources,
  createDefaultStatBlock: createDefaultAssimilacaoStatBlock,
  parseStatBlock: parseAssimilacaoStatBlock,
  combatDefaults: (block) => ({ hitPoints: block.health, armorClass: null, initiativeBonus: 0 }),
  // Sem iniciativa numérica: no Conflito, quem inicia a Ação age primeiro.
  initiativeBonus: (sheet) => sheet.instincts.reacao,
};
