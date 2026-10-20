import type { RpgSystem } from '../types';
import {
  defaultT20CampaignRules,
  describeT20CampaignRules,
  parseT20CampaignRules,
  t20CampaignRulesSchema,
  type T20CampaignRules,
} from './campaign-rules';
import { formatT20ConditionRounds, t20ConditionDurations, t20Conditions } from './conditions';
import { computeT20Derived, type T20Derived } from './derived';
import { tormenta20License } from './license';
import { t20OfficialLinks } from './links';
import { t20DefaultResources } from './resources';
import { T20_SHEET_VERSION, createDefaultT20Sheet, parseT20Sheet, t20Level, t20SheetSchema, type T20Sheet } from './sheet';
import { createDefaultT20StatBlock, parseT20StatBlock, t20StatBlockSchema, type T20StatBlock } from './stat-block';

function summarize(sheet: T20Sheet) {
  const classes = sheet.identity.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / ');
  const parts = [sheet.identity.race, classes].filter((part) => part.length > 0);
  const level = t20Level(sheet);
  return { subtitle: parts.length > 0 ? parts.join(' · ') : `Nível ${level}`, level };
}

export const tormenta20System: RpgSystem<T20Sheet, T20Derived, T20StatBlock, T20CampaignRules> = {
  id: 'tormenta20',
  name: 'Tormenta20',
  shortName: 'T20',
  rulesReference: 'Tormenta20 — Edição Jogo do Ano',
  sheetSchemaVersion: T20_SHEET_VERSION,
  license: tormenta20License,
  conditions: t20Conditions,
  officialLinks: t20OfficialLinks,
  conditionDurations: t20ConditionDurations,
  formatConditionRounds: formatT20ConditionRounds,
  sheetSchema: t20SheetSchema,
  statBlockSchema: t20StatBlockSchema,
  campaignRulesSchema: t20CampaignRulesSchema,
  defaultCampaignRules: defaultT20CampaignRules,
  parseCampaignRules: parseT20CampaignRules,
  describeCampaignRules: (rules) => describeT20CampaignRules(rules),
  createDefaultSheet: createDefaultT20Sheet,
  parseSheet: parseT20Sheet,
  computeDerived: (sheet) => computeT20Derived(sheet),
  summarize,
  defaultResources: (sheet) => t20DefaultResources(sheet),
  createDefaultStatBlock: createDefaultT20StatBlock,
  parseStatBlock: parseT20StatBlock,
  combatDefaults: (statBlock) => ({ hitPoints: statBlock.hitPoints, armorClass: statBlock.defense, initiativeBonus: statBlock.initiative }),
  initiativeBonus: (sheet) => computeT20Derived(sheet).initiative,
};

export * from './attributes';
export * from './skills';
export * from './progression';
export * from './conditions';
export * from './sheet';
export * from './derived';
export * from './resources';
export * from './stat-block';
export * from './campaign-rules';
export * from './books/pack';
export { tormenta20License } from './license';
export { t20OfficialLinks } from './links';
export * from './content';
export * from './creation';
export * from './level-up';
