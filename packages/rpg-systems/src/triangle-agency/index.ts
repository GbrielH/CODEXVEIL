import type { RpgSystem } from '../types';
import { resolveTriangleRoll } from './rules';
import {
  TRIANGLE_AGENCY_SHEET_VERSION,
  createDefaultTriangleAgencySheet,
  parseTriangleAgencySheet,
  triangleAgencySheetSchema,
  type TriangleAgencySheet,
} from './sheet';
import {
  createDefaultTriangleAgencyStatBlock,
  defaultTriangleAgencyCampaignRules,
  describeTriangleAgencyCampaignRules,
  formatTriangleAgencyConditionRounds,
  parseTriangleAgencyCampaignRules,
  parseTriangleAgencyStatBlock,
  summarizeTriangleAgency,
  triangleAgencyCampaignRulesSchema,
  triangleAgencyConditionDurations,
  triangleAgencyDefaultResources,
  triangleAgencyLicense,
  triangleAgencyOfficialLinks,
  triangleAgencyStatBlockSchema,
  type TriangleAgencyCampaignRules,
  type TriangleAgencyStatBlock,
} from './system';

export * from './books/pack';
export * from './rules';
export * from './sheet';
export * from './system';

export interface TriangleAgencyDerived {
  totalAssurances: number;
  remainingAssurances: number;
  meritDebt: number;
}

export const triangleAgencySystem: RpgSystem<
  TriangleAgencySheet,
  TriangleAgencyDerived,
  TriangleAgencyStatBlock,
  TriangleAgencyCampaignRules
> = {
  id: 'triangle-agency',
  name: 'Triangle Agency',
  shortName: 'TA',
  rulesReference: 'Triangle Agency: O Jogo de Interpretação — Primeira edição',
  sheetSchemaVersion: TRIANGLE_AGENCY_SHEET_VERSION,
  license: triangleAgencyLicense,
  conditions: [],
  officialLinks: triangleAgencyOfficialLinks,
  conditionDurations: triangleAgencyConditionDurations,
  formatConditionRounds: formatTriangleAgencyConditionRounds,
  sheetSchema: triangleAgencySheetSchema,
  statBlockSchema: triangleAgencyStatBlockSchema,
  campaignRulesSchema: triangleAgencyCampaignRulesSchema,
  defaultCampaignRules: defaultTriangleAgencyCampaignRules,
  parseCampaignRules: parseTriangleAgencyCampaignRules,
  describeCampaignRules: describeTriangleAgencyCampaignRules,
  createDefaultSheet: createDefaultTriangleAgencySheet,
  parseSheet: parseTriangleAgencySheet,
  computeDerived: (sheet) => ({
    totalAssurances: Object.values(sheet.qualityAssurances.maximum).reduce(
      (sum, value) => sum + value,
      0,
    ),
    remainingAssurances: Object.values(sheet.qualityAssurances.current).reduce(
      (sum, value) => sum + value,
      0,
    ),
    meritDebt: Math.max(0, -sheet.merits),
  }),
  summarize: summarizeTriangleAgency,
  defaultResources: triangleAgencyDefaultResources,
  createDefaultStatBlock: createDefaultTriangleAgencyStatBlock,
  parseStatBlock: parseTriangleAgencyStatBlock,
  combatDefaults: (block) => ({ hitPoints: null, armorClass: null, initiativeBonus: block.chaos }),
  initiativeBonus: () => 0,
};

// Mantém a regra fundamental visível no módulo e evita regressão acidental no alvo dos dados.
void resolveTriangleRoll;
