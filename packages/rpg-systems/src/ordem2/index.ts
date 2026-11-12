import type { RpgSystem } from '../types';
import { ordem2SkillPenalty } from './rules';
import {
  ORDEM2_SHEET_VERSION,
  createDefaultOrdem2Sheet,
  ordem2SheetSchema,
  parseOrdem2Sheet,
  type Ordem2Sheet,
} from './sheet';
import {
  ORDEM2_CONDITIONS,
  createDefaultOrdem2StatBlock,
  defaultOrdem2CampaignRules,
  describeOrdem2CampaignRules,
  formatOrdem2ConditionRounds,
  ordem2ArmorPoints,
  ordem2CampaignRulesSchema,
  ordem2ConditionDurations,
  ordem2DefaultResources,
  ordem2License,
  ordem2OfficialLinks,
  ordem2StatBlockSchema,
  parseOrdem2CampaignRules,
  parseOrdem2StatBlock,
  summarizeOrdem2,
  type Ordem2CampaignRules,
  type Ordem2StatBlock,
} from './system';

export * from './books/mission';
export * from './books/pack';
export * from './rules';
export * from './sheet';
export * from './system';

export interface Ordem2Derived {
  armorPoints: number;
  /** Modificador fixo por perícia (lesões, traumas e ajustes da ficha). */
  skillModifiers: Record<string, number>;
}

export const ordem2System: RpgSystem<
  Ordem2Sheet,
  Ordem2Derived,
  Ordem2StatBlock,
  Ordem2CampaignRules
> = {
  id: 'ordem2',
  name: 'Ordem Paranormal RPG 2 (playtest)',
  shortName: 'OP2',
  rulesReference: 'Ordem Paranormal RPG 2 — Playtests Alpha e Beta',
  sheetSchemaVersion: ORDEM2_SHEET_VERSION,
  license: ordem2License,
  conditions: ORDEM2_CONDITIONS,
  officialLinks: ordem2OfficialLinks,
  conditionDurations: ordem2ConditionDurations,
  formatConditionRounds: formatOrdem2ConditionRounds,
  sheetSchema: ordem2SheetSchema,
  statBlockSchema: ordem2StatBlockSchema,
  campaignRulesSchema: ordem2CampaignRulesSchema,
  defaultCampaignRules: defaultOrdem2CampaignRules,
  parseCampaignRules: parseOrdem2CampaignRules,
  describeCampaignRules: describeOrdem2CampaignRules,
  createDefaultSheet: () => createDefaultOrdem2Sheet(),
  parseSheet: parseOrdem2Sheet,
  computeDerived: (sheet) => ({
    armorPoints: ordem2ArmorPoints(sheet),
    skillModifiers: Object.fromEntries(
      Object.keys(sheet.skills).map((key) => [key, ordem2SkillPenalty(sheet, key)]),
    ),
  }),
  summarize: summarizeOrdem2,
  defaultResources: ordem2DefaultResources,
  createDefaultStatBlock: createDefaultOrdem2StatBlock,
  parseStatBlock: parseOrdem2StatBlock,
  // Sem iniciativa: o combate é dividido em fases (geral, à distância, corpo a corpo).
  combatDefaults: (block) => ({ hitPoints: block.hitPoints, armorClass: null, initiativeBonus: 0 }),
  initiativeBonus: () => 0,
};
