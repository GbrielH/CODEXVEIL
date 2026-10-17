import type { RpgSystem } from '../types';
import { abilityModifier } from './abilities';
import {
  defaultDnd5eCampaignRules,
  describeDnd5eCampaignRules,
  dnd5eCampaignRulesSchema,
  parseDnd5eCampaignRules,
  type Dnd5eCampaignRules,
} from './campaign-rules';
import { dnd5eConditionDurations, dnd5eConditions, formatDnd5eConditionRounds } from './conditions';
import { computeDnd5eDerived, type Dnd5eDerived } from './derived';
import { srd52License } from './license';
import { dnd5eDefaultResources } from './resources';
import {
  DND5E_SHEET_VERSION,
  createDefaultDnd5eSheet,
  dnd5eSheetSchema,
  parseDnd5eSheet,
  totalLevel,
  type Dnd5eSheet,
} from './sheet';
import {
  createDefaultDnd5eStatBlock,
  dnd5eStatBlockSchema,
  parseDnd5eStatBlock,
  type Dnd5eStatBlock,
} from './stat-block';

function summarize(sheet: Dnd5eSheet) {
  const classes = sheet.identity.classes
    .filter((entry) => entry.name.length > 0)
    .map((entry) => `${entry.name} ${entry.level}`)
    .join(' / ');
  const parts = [sheet.identity.species, classes].filter((part) => part.length > 0);
  const level = totalLevel(sheet);
  return {
    subtitle: parts.length > 0 ? parts.join(' · ') : `Nível ${level}`,
    level,
  };
}

export const dnd5eSystem: RpgSystem<Dnd5eSheet, Dnd5eDerived, Dnd5eStatBlock, Dnd5eCampaignRules> = {
  id: 'dnd5e',
  name: 'Dungeons & Dragons 5ª Edição',
  shortName: 'D&D 5e',
  rulesReference: 'SRD 5.2.1',
  sheetSchemaVersion: DND5E_SHEET_VERSION,
  license: srd52License,
  conditions: dnd5eConditions,
  conditionDurations: dnd5eConditionDurations,
  formatConditionRounds: formatDnd5eConditionRounds,
  sheetSchema: dnd5eSheetSchema,
  statBlockSchema: dnd5eStatBlockSchema,
  campaignRulesSchema: dnd5eCampaignRulesSchema,
  defaultCampaignRules: defaultDnd5eCampaignRules,
  parseCampaignRules: parseDnd5eCampaignRules,
  describeCampaignRules: describeDnd5eCampaignRules,
  createDefaultSheet: createDefaultDnd5eSheet,
  parseSheet: parseDnd5eSheet,
  computeDerived: computeDnd5eDerived,
  summarize,
  defaultResources: dnd5eDefaultResources,
  createDefaultStatBlock: createDefaultDnd5eStatBlock,
  parseStatBlock: parseDnd5eStatBlock,
  combatDefaults: (statBlock) => ({
    hitPoints: statBlock.hitPoints,
    armorClass: statBlock.armorClass,
    initiativeBonus: abilityModifier(statBlock.abilities.dex),
  }),
  initiativeBonus: (sheet) => computeDnd5eDerived(sheet).initiative,
};

export * from './abilities';
export * from './skills';
export * from './progression';
export * from './conditions';
export * from './sheet';
export * from './derived';
export * from './resources';
export * from './entries';
export * from './stat-block';
export * from './creation';
export * from './campaign-rules';
export * from './srd';
export { srd52License } from './license';
